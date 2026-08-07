'use client'

import { useState, useMemo, useRef } from 'react'
import { read, utils } from 'xlsx'
import {
    PiUploadSimple, PiCheckCircle, PiWarning, PiX, PiPlus,
    PiBank, PiArrowsLeftRight,
    PiFileText, PiLightning, PiInfo, PiSpinner
} from 'react-icons/pi'
import { cn } from '@/lib/utils'
import { useToast } from '@/components/ui/ToastProvider'

interface JournalLine {
    id: string; entryId: string; date: string; description: string; reference: string;
    debit: number; credit: number; amount: number;
}

interface BankTransaction {
    id: string; date: string; description: string; amount: number;
}

interface Props {
    bankAccountId: string; glBalance: number; journalLines: JournalLine[]; currency?: string;
    initialStatementLines?: BankTransaction[];
}

const CARD_STYLE: React.CSSProperties = { border: '1px solid rgba(0,0,0,0.09)' };

function readAsBinaryString(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = evt => resolve(evt.target?.result as string);
        reader.onerror = () => reject(new Error('Could not read the file'));
        reader.readAsBinaryString(file);
    });
}

export function BankReconciliationClient({
    bankAccountId, glBalance, journalLines, currency = 'KES', initialStatementLines = [],
}: Props) {
    const { showToast } = useToast();
    const [step, setStep] = useState<'upload' | 'match' | 'review'>(initialStatementLines.length > 0 ? 'match' : 'upload')
    const [bankTransactions, setBankTransactions] = useState<BankTransaction[]>(initialStatementLines)
    const [bookLines, setBookLines] = useState<JournalLine[]>(journalLines)
    const [sessionMatches, setSessionMatches] = useState<{ bankTx: BankTransaction; bookLine: JournalLine }[]>([])
    const [openingBalance, setOpeningBalance] = useState('0')
    const [closingBalance, setClosingBalance] = useState('0')
    const [isUploading, setIsUploading] = useState(false)
    const [isMatching, setIsMatching] = useState(false)
    const [searchBank, setSearchBank] = useState('')
    const [searchBooks, setSearchBooks] = useState('')
    const [selectedBankTx, setSelectedBankTx] = useState<string | null>(null)
    const [selectedBookLine, setSelectedBookLine] = useState<string | null>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)

    const fmt = (amount: number) =>
        `${currency} ${amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}`

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        setIsUploading(true)
        try {
            const bstr = await readAsBinaryString(file)
            const wb = read(bstr, { type: 'binary' })
            const ws = wb.Sheets[wb.SheetNames[0]]
            const rows = utils.sheet_to_json(ws) as any[]

            if (rows.length === 0) throw new Error('That file has no rows we could read')

            const parsed = rows.map(row => {
                const rawDate = row.Date || row.date || new Date().toISOString()
                const rawAmount = row.Amount ?? row.amount ?? row.Credit ?? row.credit ?? row.Debit ?? row.debit ?? 0
                return {
                    date: new Date(rawDate),
                    description: row.Description || row.description || row.Narration || row.narration || 'Unknown',
                    amount: parseFloat(rawAmount) || 0,
                }
            })

            const validDates = parsed.map(p => p.date.getTime()).filter(t => !Number.isNaN(t))
            const periodStart = validDates.length ? new Date(Math.min(...validDates)) : new Date()
            const periodEnd = validDates.length ? new Date(Math.max(...validDates)) : new Date()

            const res = await fetch(`/api/accounting/bank-accounts/${bankAccountId}/statements`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    periodStart: periodStart.toISOString().slice(0, 10),
                    periodEnd: periodEnd.toISOString().slice(0, 10),
                    openingBalance: parseFloat(openingBalance) || 0,
                    closingBalance: parseFloat(closingBalance) || 0,
                    lines: parsed.map(p => ({
                        transactionDate: p.date.toISOString(),
                        description: p.description,
                        debit: p.amount < 0 ? Math.abs(p.amount) : 0,
                        credit: p.amount > 0 ? p.amount : 0,
                    })),
                }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Failed to import the statement')

            const recRes = await fetch(`/api/accounting/bank-accounts/${bankAccountId}/reconciliation?statementId=${data.id}`)
            const recData = await recRes.json()
            if (!recRes.ok) throw new Error(recData.error || 'Statement saved, but could not load it back')

            const imported: BankTransaction[] = (recData.unmatchedStatementLines || []).map((l: any) => ({
                id: l.id,
                date: l.transactionDate,
                description: l.description,
                amount: l.credit > 0 ? l.credit : -l.debit,
            }))

            setBankTransactions(prev => [...prev, ...imported])
            setStep('match')
            showToast(`Imported ${imported.length} transaction${imported.length !== 1 ? 's' : ''}`, 'success')
        } catch (err: any) {
            showToast(err.message || 'Could not import that file', 'error')
        } finally {
            setIsUploading(false)
            if (fileInputRef.current) fileInputRef.current.value = ''
        }
    }

    const refreshUnmatched = async () => {
        const res = await fetch(`/api/accounting/bank-accounts/${bankAccountId}/reconciliation`)
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Could not refresh')
        setBankTransactions((data.unmatchedStatementLines || []).map((l: any) => ({
            id: l.id, date: l.transactionDate, description: l.description,
            amount: l.credit > 0 ? l.credit : -l.debit,
        })))
        setBookLines((data.unmatchedGlLines || []).map((l: any) => ({
            id: l.id, entryId: l.entryId, date: l.date, description: l.description,
            reference: l.reference || '', debit: l.debit, credit: l.credit, amount: l.net,
        })))
    }

    const autoMatch = async () => {
        setIsMatching(true)
        try {
            const res = await fetch(`/api/accounting/bank-accounts/${bankAccountId}/reconciliation`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'AUTO_MATCH' }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Auto-match failed')
            await refreshUnmatched()
            showToast(data.matched > 0 ? `${data.matched} matched automatically` : 'No confident matches found', data.matched > 0 ? 'success' : 'info')
        } catch (err: any) {
            showToast(err.message || 'Auto-match failed', 'error')
        } finally {
            setIsMatching(false)
        }
    }

    const createMatch = async () => {
        const bankTx = bankTransactions.find(t => t.id === selectedBankTx)
        const bookLine = bookLines.find(l => l.id === selectedBookLine)
        if (!bankTx || !bookLine) return
        setIsMatching(true)
        try {
            const res = await fetch(`/api/accounting/bank-accounts/${bankAccountId}/reconciliation`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'MATCH', statementLineId: bankTx.id, journalEntryId: bookLine.entryId, matchType: 'MANUAL' }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Could not match those')
            setBankTransactions(prev => prev.filter(t => t.id !== bankTx.id))
            setBookLines(prev => prev.filter(l => l.id !== bookLine.id))
            setSessionMatches(prev => [...prev, { bankTx, bookLine }])
            setSelectedBankTx(null)
            setSelectedBookLine(null)
        } catch (err: any) {
            showToast(err.message || 'Could not match those', 'error')
        } finally {
            setIsMatching(false)
        }
    }

    const unmatch = async (bankTxId: string) => {
        const entry = sessionMatches.find(m => m.bankTx.id === bankTxId)
        if (!entry) return
        setIsMatching(true)
        try {
            const res = await fetch(`/api/accounting/bank-accounts/${bankAccountId}/reconciliation`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'UNMATCH', statementLineId: bankTxId }),
            })
            if (!res.ok) { const data = await res.json().catch(() => ({})); throw new Error(data.error || 'Could not unmatch') }
            setBankTransactions(prev => [...prev, entry.bankTx])
            setBookLines(prev => [...prev, entry.bookLine])
            setSessionMatches(prev => prev.filter(m => m.bankTx.id !== bankTxId))
        } catch (err: any) {
            showToast(err.message || 'Could not unmatch', 'error')
        } finally {
            setIsMatching(false)
        }
    }

    const filteredBankTx = useMemo(() =>
        bankTransactions.filter(tx => tx.description.toLowerCase().includes(searchBank.toLowerCase())),
        [bankTransactions, searchBank])

    const filteredBookLines = useMemo(() =>
        bookLines.filter(line => line.description.toLowerCase().includes(searchBooks.toLowerCase())),
        [bookLines, searchBooks])

    const matchedCount = sessionMatches.length
    const unmatchedBankCount = bankTransactions.length
    const unmatchedBookCount = bookLines.length
    const unmatchedBankTotal = bankTransactions.reduce((s, tx) => s + tx.amount, 0)
    const unmatchedBookTotal = bookLines.reduce((s, l) => s + l.amount, 0)
    const difference = Math.abs(unmatchedBankTotal - unmatchedBookTotal)
    const isReconciled = difference < 0.01 && unmatchedBankCount === 0 && unmatchedBookCount === 0

    const searchInputCls = "w-full pl-3 pr-3 py-[9px] rounded-[6px] text-[12.5px] text-gray-900 placeholder:text-gray-300 outline-none focus:ring-1 focus:ring-[#6366F1] transition-colors bg-white"

    const finishSession = () => {
        setStep('upload')
        setSessionMatches([])
        setSelectedBankTx(null)
        setSelectedBookLine(null)
        showToast('All matches for this session are saved', 'success')
    }

    return (
        <div className="space-y-5">
            {/* Info banner */}
            <div className="bg-white rounded-[8px] p-5 flex items-start gap-4" style={CARD_STYLE}>
                <div className="w-9 h-9 rounded-[7px] bg-blue-50 flex items-center justify-center shrink-0">
                    <PiInfo className="text-blue-500 text-[16px]" />
                </div>
                <div className="flex-1">
                    <h2 className="text-[13px] font-[600] text-gray-900 mb-1">What is Bank Reconciliation?</h2>
                    <p className="text-[12.5px] text-gray-500 mb-4 leading-relaxed">
                        This tool verifies that your <strong className="text-gray-700">bank statement</strong> matches
                        your <strong className="text-gray-700">accounting books</strong>. Each match is saved immediately —
                        you can leave and come back without losing progress.
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-[6px] px-4 py-3 flex items-center gap-3"
                            style={{ border: '1px solid rgba(59,130,246,0.15)', background: 'rgba(239,246,255,0.5)' }}>
                            <PiBank className="text-blue-500 text-[15px] shrink-0" />
                            <div>
                                <p className="text-[11px] font-[500] text-gray-500 uppercase tracking-[0.06em]">Bank Statement</p>
                                <p className="text-[11.5px] text-gray-600">What the bank says you have</p>
                            </div>
                        </div>
                        <div className="rounded-[6px] px-4 py-3 flex items-center gap-3"
                            style={{ border: '1px solid rgba(99,102,241,0.15)', background: 'rgba(238,242,255,0.5)' }}>
                            <PiFileText className="text-[#6366F1] text-[15px] shrink-0" />
                            <div>
                                <p className="text-[11px] font-[500] text-gray-500 uppercase tracking-[0.06em]">Your Books</p>
                                <p className="text-[11.5px] text-gray-600">What your accounting records show</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Progress Steps */}
            <div className="bg-white rounded-[8px] px-6 py-5" style={CARD_STYLE}>
                <div className="flex items-center">
                    {(['upload', 'match', 'review'] as const).map((s, idx) => {
                        const labels = ['Upload Bank Statement', 'Match Transactions', 'Review & Complete']
                        const subs = ['Import your CSV or Excel file', 'Connect bank items to your books', 'Verify everything matches']
                        const isActive = step === s
                        const isDone = (step === 'match' && s === 'upload') || (step === 'review' && s !== 'review')
                        return (
                            <div key={s} className="flex items-center flex-1">
                                <div className={cn('flex items-center gap-3', !isActive && !isDone && 'opacity-40')}>
                                    <div className={cn(
                                        'w-8 h-8 rounded-[7px] flex items-center justify-center text-[13px] font-[600] shrink-0',
                                        isActive ? 'bg-[#6366F1] text-white' : isDone ? 'bg-emerald-500 text-white' : 'bg-gray-100 text-gray-500'
                                    )}>
                                        {isDone ? <PiCheckCircle className="text-[14px]" /> : idx + 1}
                                    </div>
                                    <div className="hidden sm:block">
                                        <p className="text-[12.5px] font-[600] text-gray-900">{labels[idx]}</p>
                                        <p className="text-[11px] text-gray-400">{subs[idx]}</p>
                                    </div>
                                </div>
                                {idx < 2 && (
                                    <div className="flex-1 mx-4 h-px" style={{ background: 'rgba(0,0,0,0.09)' }} />
                                )}
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* Step 1: Upload */}
            {step === 'upload' && (
                <div className="bg-white rounded-[8px] py-16 flex flex-col items-center" style={CARD_STYLE}>
                    <div className="w-12 h-12 rounded-[8px] bg-indigo-50 flex items-center justify-center mb-5"
                        style={{ border: '1px solid rgba(99,102,241,0.15)' }}>
                        {isUploading ? <PiSpinner className="text-[#6366F1] text-[22px] animate-spin" /> : <PiUploadSimple className="text-[#6366F1] text-[22px]" />}
                    </div>
                    <h3 className="text-[15px] font-[600] text-gray-900 mb-1.5">Upload Your Bank Statement</h3>
                    <p className="text-[12.5px] text-gray-400 mb-6 text-center max-w-md leading-relaxed">
                        Download your bank statement as a CSV or Excel file from your bank's website, then upload it here.
                    </p>

                    <div className="grid grid-cols-2 gap-3 w-full max-w-xs mb-6">
                        <div>
                            <label className="block text-[10.5px] font-[500] text-gray-400 uppercase tracking-[0.06em] mb-1.5">Opening balance</label>
                            <input type="number" step="0.01" value={openingBalance} onChange={e => setOpeningBalance(e.target.value)}
                                className="w-full rounded-[6px] px-3 py-2 text-[12.5px] text-gray-900 outline-none focus:ring-1 focus:ring-[#6366F1] bg-white"
                                style={{ border: '1px solid rgba(0,0,0,0.09)' }} />
                        </div>
                        <div>
                            <label className="block text-[10.5px] font-[500] text-gray-400 uppercase tracking-[0.06em] mb-1.5">Closing balance</label>
                            <input type="number" step="0.01" value={closingBalance} onChange={e => setClosingBalance(e.target.value)}
                                className="w-full rounded-[6px] px-3 py-2 text-[12.5px] text-gray-900 outline-none focus:ring-1 focus:ring-[#6366F1] bg-white"
                                style={{ border: '1px solid rgba(0,0,0,0.09)' }} />
                        </div>
                    </div>

                    <label className={cn("cursor-pointer", isUploading && "pointer-events-none opacity-60")}>
                        <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleFileUpload} disabled={isUploading} />
                        <div className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-[6px] bg-[#6366F1] text-white text-[13px] font-[500] hover:bg-indigo-600 transition-colors">
                            {isUploading ? <PiSpinner className="text-[15px] animate-spin" /> : <PiUploadSimple className="text-[15px]" />}
                            {isUploading ? 'Importing…' : 'Choose Bank Statement File'}
                        </div>
                    </label>
                    <p className="text-[11px] text-gray-400 mt-3">Supported: CSV, XLSX, XLS</p>
                </div>
            )}

            {/* Step 2: Match */}
            {step === 'match' && (
                <>
                    {/* Stats */}
                    <div className="grid grid-cols-4 gap-3">
                        {[
                            { label: 'Bank Transactions', value: bankTransactions.length, cls: '' },
                            { label: 'Book Entries', value: bookLines.length, cls: '' },
                            { label: 'Matched this session', value: matchedCount, cls: 'text-emerald-600', bg: 'rgba(240,253,244,0.7)', bdr: 'rgba(16,185,129,0.2)' },
                            { label: 'Remaining', value: unmatchedBankCount + unmatchedBookCount, cls: 'text-orange-600', bg: 'rgba(255,247,237,0.7)', bdr: 'rgba(249,115,22,0.2)' },
                        ].map(({ label, value, cls, bg, bdr }) => (
                            <div key={label} className="bg-white rounded-[8px] px-4 py-4"
                                style={{ border: bdr ? `1px solid ${bdr}` : '1px solid rgba(0,0,0,0.09)', background: bg || 'white' }}>
                                <p className="text-[10.5px] font-[500] text-gray-400 uppercase tracking-[0.06em] mb-1">{label}</p>
                                <p className={cn('text-[22px] font-[600]', cls || 'text-gray-900')}>{value}</p>
                            </div>
                        ))}
                    </div>

                    {/* Auto-match + import more */}
                    <div className="bg-white rounded-[8px] px-5 py-4 flex items-center justify-between flex-wrap gap-3" style={CARD_STYLE}>
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-[7px] bg-purple-50 flex items-center justify-center shrink-0">
                                <PiLightning className="text-purple-500 text-[15px]" />
                            </div>
                            <div>
                                <p className="text-[13px] font-[600] text-gray-900">Try Auto-Match First</p>
                                <p className="text-[12px] text-gray-400">Matches same amount within 3 days, saved instantly</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <label className={cn("cursor-pointer", isUploading && "pointer-events-none opacity-60")}>
                                <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleFileUpload} disabled={isUploading} />
                                <div className="flex items-center gap-1.5 px-3.5 py-2 rounded-[6px] text-[12.5px] font-[500] text-gray-600 bg-white hover:bg-gray-50 transition-colors" style={CARD_STYLE}>
                                    {isUploading ? <PiSpinner className="text-[13px] animate-spin" /> : <PiUploadSimple className="text-[13px]" />}
                                    Import more
                                </div>
                            </label>
                            <button onClick={autoMatch} disabled={isMatching || bankTransactions.length === 0}
                                className="flex items-center gap-1.5 px-4 py-2 rounded-[6px] text-[12.5px] font-[500] text-white bg-purple-600 hover:bg-purple-700 transition-colors shrink-0 disabled:opacity-50">
                                {isMatching ? <PiSpinner className="text-[14px] animate-spin" /> : <PiLightning className="text-[14px]" />}
                                Auto-Match
                            </button>
                        </div>
                    </div>

                    {/* Matching Interface */}
                    <div className="grid grid-cols-12 gap-4">
                        {/* Bank Transactions */}
                        <div className="col-span-5 bg-white rounded-[8px] overflow-hidden" style={CARD_STYLE}>
                            <div className="px-4 py-3" style={{ borderBottom: '1px solid rgba(0,0,0,0.07)', background: 'rgba(239,246,255,0.5)' }}>
                                <div className="flex items-center gap-2 mb-3">
                                    <PiBank className="text-blue-500 text-[15px]" />
                                    <h3 className="text-[13px] font-[600] text-gray-900">Bank Statement</h3>
                                    <span className="ml-auto text-[11px] text-gray-400">{filteredBankTx.length} tx</span>
                                </div>
                                <div>
                                    <input type="text" placeholder="Search..." value={searchBank}
                                        onChange={e => setSearchBank(e.target.value)}
                                        className={searchInputCls} style={CARD_STYLE} />
                                </div>
                            </div>
                            <div className="h-[420px] overflow-y-auto p-3 space-y-2">
                                {filteredBankTx.length === 0 && (
                                    <p className="text-[12px] text-gray-400 text-center py-8">Nothing unmatched here</p>
                                )}
                                {filteredBankTx.map(tx => {
                                    const isSelected = selectedBankTx === tx.id
                                    return (
                                        <div key={tx.id}
                                            className="p-3 rounded-[6px] cursor-pointer transition-colors hover:bg-gray-50"
                                            style={{
                                                border: isSelected ? '1px solid rgba(99,102,241,0.4)' : '1px solid rgba(0,0,0,0.09)',
                                                background: isSelected ? 'rgba(238,242,255,0.6)' : 'white'
                                            }}
                                            onClick={() => setSelectedBankTx(isSelected ? null : tx.id)}
                                        >
                                            <div className="flex justify-between items-start gap-2">
                                                <div className="min-w-0">
                                                    <p className="text-[12.5px] font-[500] text-gray-900 truncate">{tx.description}</p>
                                                    <p className="text-[11px] text-gray-400 mt-0.5">
                                                        {new Date(tx.date).toLocaleDateString()}
                                                    </p>
                                                </div>
                                                <p className="text-[12.5px] font-mono font-[600] text-gray-900 shrink-0">
                                                    {fmt(tx.amount)}
                                                </p>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>

                        {/* Center */}
                        <div className="col-span-2 flex flex-col justify-center">
                            <div className="bg-white rounded-[8px] p-5 text-center" style={CARD_STYLE}>
                                <PiArrowsLeftRight className="text-gray-300 text-[28px] mx-auto mb-4" />
                                <p className="text-[10px] font-[500] text-gray-400 uppercase tracking-[0.07em] mb-4">Select & Match</p>
                                {selectedBankTx && selectedBookLine ? (
                                    <button onClick={createMatch} disabled={isMatching}
                                        className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-[6px] text-[12px] font-[500] text-white bg-emerald-600 hover:bg-emerald-700 transition-colors disabled:opacity-50">
                                        {isMatching ? <PiSpinner className="text-[13px] animate-spin" /> : <PiCheckCircle className="text-[13px]" />}
                                        Match
                                    </button>
                                ) : (
                                    <div className="space-y-2">
                                        <div className={cn('px-3 py-2 rounded-[6px] text-[11px] font-[500] text-center')}
                                            style={{
                                                border: selectedBankTx ? '1px solid rgba(99,102,241,0.3)' : '1px solid rgba(0,0,0,0.09)',
                                                background: selectedBankTx ? 'rgba(238,242,255,0.6)' : 'white',
                                                color: selectedBankTx ? '#6366F1' : '#9ca3af'
                                            }}>
                                            {selectedBankTx ? '✓ Bank' : 'Pick from bank'}
                                        </div>
                                        <div className={cn('px-3 py-2 rounded-[6px] text-[11px] font-[500] text-center')}
                                            style={{
                                                border: selectedBookLine ? '1px solid rgba(99,102,241,0.3)' : '1px solid rgba(0,0,0,0.09)',
                                                background: selectedBookLine ? 'rgba(238,242,255,0.6)' : 'white',
                                                color: selectedBookLine ? '#6366F1' : '#9ca3af'
                                            }}>
                                            {selectedBookLine ? '✓ Books' : 'Pick from books'}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Book Entries */}
                        <div className="col-span-5 bg-white rounded-[8px] overflow-hidden" style={CARD_STYLE}>
                            <div className="px-4 py-3" style={{ borderBottom: '1px solid rgba(0,0,0,0.07)', background: 'rgba(238,242,255,0.4)' }}>
                                <div className="flex items-center gap-2 mb-3">
                                    <PiFileText className="text-[#6366F1] text-[15px]" />
                                    <h3 className="text-[13px] font-[600] text-gray-900">Your Books</h3>
                                    <span className="ml-auto text-[11px] text-gray-400">{filteredBookLines.length} entries</span>
                                </div>
                                <div>
                                    <input type="text" placeholder="Search..." value={searchBooks}
                                        onChange={e => setSearchBooks(e.target.value)}
                                        className={searchInputCls} style={CARD_STYLE} />
                                </div>
                            </div>
                            <div className="h-[420px] overflow-y-auto p-3 space-y-2">
                                {filteredBookLines.length === 0 && (
                                    <p className="text-[12px] text-gray-400 text-center py-8">Nothing unmatched here</p>
                                )}
                                {filteredBookLines.map(line => {
                                    const isSelected = selectedBookLine === line.id
                                    return (
                                        <div key={line.id}
                                            className="p-3 rounded-[6px] cursor-pointer transition-colors hover:bg-gray-50"
                                            style={{
                                                border: isSelected ? '1px solid rgba(99,102,241,0.4)' : '1px solid rgba(0,0,0,0.09)',
                                                background: isSelected ? 'rgba(238,242,255,0.6)' : 'white'
                                            }}
                                            onClick={() => setSelectedBookLine(isSelected ? null : line.id)}
                                        >
                                            <div className="flex justify-between items-start gap-2">
                                                <div className="min-w-0">
                                                    <p className="text-[12.5px] font-[500] text-gray-900 truncate">{line.description}</p>
                                                    <p className="text-[11px] text-gray-400 mt-0.5">
                                                        {new Date(line.date).toLocaleDateString()}
                                                        {line.reference ? ` · ${line.reference}` : ''}
                                                    </p>
                                                </div>
                                                <p className="text-[12.5px] font-mono font-[600] text-gray-900 shrink-0">
                                                    {fmt(line.amount)}
                                                </p>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    </div>

                    {/* Matched this session */}
                    {sessionMatches.length > 0 && (
                        <div className="bg-white rounded-[8px] overflow-hidden" style={CARD_STYLE}>
                            <div className="px-5 py-3 flex items-center gap-2" style={{ borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
                                <PiCheckCircle className="text-emerald-500 text-[14px]" />
                                <h3 className="text-[12.5px] font-[600] text-gray-900">Matched this session</h3>
                            </div>
                            <div className="p-3 space-y-1.5 max-h-[180px] overflow-y-auto">
                                {sessionMatches.map(m => (
                                    <div key={m.bankTx.id} className="flex items-center justify-between px-3 py-2 rounded-[5px] bg-emerald-50/40">
                                        <p className="text-[11.5px] text-gray-700 truncate">
                                            {m.bankTx.description} <span className="text-gray-400">↔</span> {m.bookLine.description}
                                        </p>
                                        <div className="flex items-center gap-3 shrink-0">
                                            <span className="text-[11.5px] font-mono text-gray-600">{fmt(m.bankTx.amount)}</span>
                                            <button onClick={() => unmatch(m.bankTx.id)} disabled={isMatching}
                                                className="text-[11px] font-[500] text-rose-500 hover:underline disabled:opacity-50">
                                                Unmatch
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Proceed to review */}
                    {matchedCount > 0 && (
                        <div className="bg-white rounded-[8px] px-5 py-4 flex items-center justify-between" style={CARD_STYLE}>
                            <div>
                                <p className="text-[13px] font-[600] text-gray-900 mb-0.5">
                                    {isReconciled ? 'Everything is matched!' : `${matchedCount} transaction${matchedCount !== 1 ? 's' : ''} matched`}
                                </p>
                                <p className="text-[12px] text-gray-400">
                                    {isReconciled
                                        ? 'Your bank statement and books are in sync.'
                                        : `${unmatchedBankCount + unmatchedBookCount} items still need attention.`
                                    }
                                </p>
                            </div>
                            <button onClick={() => setStep('review')}
                                className="flex items-center gap-1.5 px-4 py-2 rounded-[6px] text-[12.5px] font-[500] text-white bg-[#6366F1] hover:bg-indigo-600 transition-colors shrink-0">
                                Review Reconciliation
                            </button>
                        </div>
                    )}
                </>
            )}

            {/* Step 3: Review */}
            {step === 'review' && (
                <div className="bg-white rounded-[8px] p-8" style={CARD_STYLE}>
                    <div className="max-w-2xl mx-auto">
                        <div className={cn('text-center py-10 px-8 rounded-[8px] mb-6')}
                            style={{
                                background: isReconciled ? 'rgba(240,253,244,0.7)' : 'rgba(255,247,237,0.7)',
                                border: isReconciled ? '1px solid rgba(16,185,129,0.25)' : '1px solid rgba(249,115,22,0.25)'
                            }}>
                            {isReconciled ? (
                                <>
                                    <PiCheckCircle className="text-[52px] text-emerald-500 mx-auto mb-4" />
                                    <h2 className="text-[18px] font-[600] text-gray-900 mb-1">Reconciliation Complete</h2>
                                    <p className="text-[12.5px] text-gray-500">Your bank statement and books match perfectly.</p>
                                </>
                            ) : (
                                <>
                                    <PiWarning className="text-[52px] text-orange-500 mx-auto mb-4" />
                                    <h2 className="text-[18px] font-[600] text-gray-900 mb-1">Reconciliation In Progress</h2>
                                    <p className="text-[12.5px] text-gray-500">
                                        {unmatchedBankCount + unmatchedBookCount} unmatched items remaining — they're saved and will still be here next time.
                                    </p>
                                </>
                            )}
                        </div>

                        <div className="grid grid-cols-2 gap-4 mb-6">
                            <div className="rounded-[8px] px-5 py-4 text-center" style={{ background: '#FAFAFA', border: '1px solid rgba(0,0,0,0.07)' }}>
                                <p className="text-[10.5px] font-[500] text-gray-400 uppercase tracking-[0.06em] mb-1">Matched This Session</p>
                                <p className="text-[28px] font-[600] text-emerald-600">{matchedCount}</p>
                            </div>
                            <div className="rounded-[8px] px-5 py-4 text-center" style={{ background: '#FAFAFA', border: '1px solid rgba(0,0,0,0.07)' }}>
                                <p className="text-[10.5px] font-[500] text-gray-400 uppercase tracking-[0.06em] mb-1">Unmatched Items</p>
                                <p className="text-[28px] font-[600] text-orange-500">{unmatchedBankCount + unmatchedBookCount}</p>
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <button onClick={() => setStep('match')}
                                className="flex-1 px-4 py-2.5 rounded-[6px] text-[12.5px] font-[500] text-gray-600 bg-white hover:bg-gray-50 transition-colors"
                                style={CARD_STYLE}>
                                Back to Matching
                            </button>
                            <button onClick={finishSession}
                                className="flex-1 px-4 py-2.5 rounded-[6px] text-[12.5px] font-[500] text-white bg-[#6366F1] hover:bg-indigo-600 transition-colors">
                                {isReconciled ? 'Done' : 'Finish for Now'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
