'use client'

import { useState, useMemo } from 'react'
import { read, utils } from 'xlsx'
import {
    PiUploadSimple, PiCheckCircle, PiWarning, PiX, PiPlus,
    PiBank, PiMagnifyingGlass, PiArrowsLeftRight,
    PiFileText, PiLightning, PiInfo
} from 'react-icons/pi'
import { cn } from '@/lib/utils'

interface JournalLine {
    id: string; date: string; description: string; reference: string;
    debit: number; credit: number; amount: number;
}

interface BankTransaction {
    id: string; date: string; description: string; amount: number;
    matched: boolean; matchedLineId?: string;
}

interface Props {
    cashAccountId: string; glBalance: number; journalLines: JournalLine[]; currency?: string;
}

const CARD_STYLE: React.CSSProperties = { border: '1px solid rgba(0,0,0,0.09)' };

export function BankReconciliationClient({ cashAccountId, glBalance, journalLines, currency = 'KES' }: Props) {
    const [step, setStep] = useState<'upload' | 'match' | 'review'>('upload')
    const [bankTransactions, setBankTransactions] = useState<BankTransaction[]>([])
    const [matches, setMatches] = useState<Map<string, string>>(new Map())
    const [searchBank, setSearchBank] = useState('')
    const [searchBooks, setSearchBooks] = useState('')
    const [selectedBankTx, setSelectedBankTx] = useState<string | null>(null)
    const [selectedBookLine, setSelectedBookLine] = useState<string | null>(null)

    const fmt = (amount: number) =>
        `KES ${amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}`

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        const reader = new FileReader()
        reader.onload = (evt) => {
            const bstr = evt.target?.result
            const wb = read(bstr, { type: 'binary' })
            const ws = wb.Sheets[wb.SheetNames[0]]
            const data = utils.sheet_to_json(ws)
            const transactions: BankTransaction[] = data.map((row: any, index) => ({
                id: `bank-${index}`,
                date: row.Date || row.date || new Date().toISOString(),
                description: row.Description || row.description || row.Narration || 'Unknown',
                amount: parseFloat(row.Amount || row.amount || row.Debit || row.Credit || 0),
                matched: false
            }))
            setBankTransactions(transactions)
            setStep('match')
        }
        reader.readAsBinaryString(file)
    }

    const autoMatch = () => {
        const newMatches = new Map<string, string>()
        bankTransactions.forEach(bankTx => {
            const match = journalLines.find(bookLine => {
                const amountMatch = Math.abs(bookLine.amount - bankTx.amount) < 0.01
                const dateMatch = new Date(bookLine.date).toDateString() === new Date(bankTx.date).toDateString()
                const notAlreadyMatched = !Array.from(newMatches.values()).includes(bookLine.id)
                return amountMatch && dateMatch && notAlreadyMatched
            })
            if (match) newMatches.set(bankTx.id, match.id)
        })
        setMatches(newMatches)
    }

    const createMatch = () => {
        if (!selectedBankTx || !selectedBookLine) return
        const newMatches = new Map(matches)
        newMatches.set(selectedBankTx, selectedBookLine)
        setMatches(newMatches)
        setSelectedBankTx(null)
        setSelectedBookLine(null)
    }

    const unmatch = (bankTxId: string) => {
        const newMatches = new Map(matches)
        newMatches.delete(bankTxId)
        setMatches(newMatches)
    }

    const filteredBankTx = useMemo(() =>
        bankTransactions.filter(tx => tx.description.toLowerCase().includes(searchBank.toLowerCase())),
        [bankTransactions, searchBank])

    const filteredBookLines = useMemo(() =>
        journalLines.filter(line => line.description.toLowerCase().includes(searchBooks.toLowerCase())),
        [journalLines, searchBooks])

    const matchedCount = matches.size
    const unmatchedBankCount = bankTransactions.filter(tx => !matches.has(tx.id)).length
    const unmatchedBookCount = journalLines.filter(line => !Array.from(matches.values()).includes(line.id)).length
    const unmatchedBankTotal = bankTransactions.filter(tx => !matches.has(tx.id)).reduce((s, tx) => s + tx.amount, 0)
    const unmatchedBookTotal = journalLines.filter(line => !Array.from(matches.values()).includes(line.id)).reduce((s, l) => s + l.amount, 0)
    const difference = Math.abs(unmatchedBankTotal - unmatchedBookTotal)
    const isReconciled = difference < 0.01 && unmatchedBankCount === 0 && unmatchedBookCount === 0

    const searchInputCls = "w-full pl-3 pr-3 py-[9px] rounded-[6px] text-[12.5px] text-gray-900 placeholder:text-gray-300 outline-none focus:ring-1 focus:ring-[#6366F1] transition-colors bg-white"

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
                        your <strong className="text-gray-700">accounting books</strong>. Match each bank transaction with
                        the corresponding entry in your books to ensure accuracy.
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
                <div className="bg-white rounded-[8px] py-20 flex flex-col items-center" style={CARD_STYLE}>
                    <div className="w-12 h-12 rounded-[8px] bg-indigo-50 flex items-center justify-center mb-5"
                        style={{ border: '1px solid rgba(99,102,241,0.15)' }}>
                        <PiUploadSimple className="text-[#6366F1] text-[22px]" />
                    </div>
                    <h3 className="text-[15px] font-[600] text-gray-900 mb-1.5">Upload Your Bank Statement</h3>
                    <p className="text-[12.5px] text-gray-400 mb-8 text-center max-w-md leading-relaxed">
                        Download your bank statement as a CSV or Excel file from your bank's website, then upload it here.
                    </p>
                    <label className="cursor-pointer">
                        <input type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleFileUpload} />
                        <div className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-[6px] bg-[#6366F1] text-white text-[13px] font-[500] hover:bg-indigo-600 transition-colors">
                            <PiUploadSimple className="text-[15px]" />
                            Choose Bank Statement File
                        </div>
                    </label>
                    <p className="text-[11px] text-gray-400 mt-3">Supported: CSV, XLSX, XLS</p>
                </div>
            )}

            {/* Step 2: Match */}
            {step === 'match' && bankTransactions.length > 0 && (
                <>
                    {/* Stats */}
                    <div className="grid grid-cols-4 gap-3">
                        {[
                            { label: 'Bank Transactions', value: bankTransactions.length, cls: '' },
                            { label: 'Book Entries', value: journalLines.length, cls: '' },
                            { label: 'Matched', value: matchedCount, cls: 'text-emerald-600', bg: 'rgba(240,253,244,0.7)', bdr: 'rgba(16,185,129,0.2)' },
                            { label: 'Remaining', value: unmatchedBankCount + unmatchedBookCount, cls: 'text-orange-600', bg: 'rgba(255,247,237,0.7)', bdr: 'rgba(249,115,22,0.2)' },
                        ].map(({ label, value, cls, bg, bdr }) => (
                            <div key={label} className="bg-white rounded-[8px] px-4 py-4"
                                style={{ border: bdr ? `1px solid ${bdr}` : '1px solid rgba(0,0,0,0.09)', background: bg || 'white' }}>
                                <p className="text-[10.5px] font-[500] text-gray-400 uppercase tracking-[0.06em] mb-1">{label}</p>
                                <p className={cn('text-[22px] font-[600]', cls || 'text-gray-900')}>{value}</p>
                            </div>
                        ))}
                    </div>

                    {/* Auto-match */}
                    <div className="bg-white rounded-[8px] px-5 py-4 flex items-center justify-between" style={CARD_STYLE}>
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-[7px] bg-purple-50 flex items-center justify-center shrink-0">
                                <PiLightning className="text-purple-500 text-[15px]" />
                            </div>
                            <div>
                                <p className="text-[13px] font-[600] text-gray-900">Try Auto-Match First</p>
                                <p className="text-[12px] text-gray-400">Automatically match transactions with the same amount and date</p>
                            </div>
                        </div>
                        <button onClick={autoMatch}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-[6px] text-[12.5px] font-[500] text-white bg-purple-600 hover:bg-purple-700 transition-colors shrink-0">
                            <PiLightning className="text-[14px]" />
                            Auto-Match
                        </button>
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
                            <div className="h-[480px] overflow-y-auto p-3 space-y-2">
                                {filteredBankTx.map(tx => {
                                    const isMatched = matches.has(tx.id)
                                    const isSelected = selectedBankTx === tx.id
                                    return (
                                        <div key={tx.id}
                                            className={cn('p-3 rounded-[6px] cursor-pointer transition-colors',
                                                isMatched ? 'opacity-50' : 'hover:bg-gray-50'
                                            )}
                                            style={{
                                                border: isSelected
                                                    ? '1px solid rgba(99,102,241,0.4)'
                                                    : isMatched
                                                        ? '1px solid rgba(16,185,129,0.3)'
                                                        : '1px solid rgba(0,0,0,0.09)',
                                                background: isSelected ? 'rgba(238,242,255,0.6)' : isMatched ? 'rgba(240,253,244,0.6)' : 'white'
                                            }}
                                            onClick={() => !isMatched && setSelectedBankTx(isSelected ? null : tx.id)}
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
                                            {isMatched && (
                                                <div className="flex items-center justify-between pt-2 mt-2"
                                                    style={{ borderTop: '1px solid rgba(16,185,129,0.2)' }}>
                                                    <span className="text-[11px] font-[500] text-emerald-600 flex items-center gap-1">
                                                        <PiCheckCircle /> Matched
                                                    </span>
                                                    <button onClick={e => { e.stopPropagation(); unmatch(tx.id) }}
                                                        className="text-[11px] font-[500] text-rose-500 hover:underline">
                                                        Unmatch
                                                    </button>
                                                </div>
                                            )}
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
                                    <button onClick={createMatch}
                                        className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-[6px] text-[12px] font-[500] text-white bg-emerald-600 hover:bg-emerald-700 transition-colors">
                                        <PiCheckCircle className="text-[13px]" />
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
                            <div className="h-[480px] overflow-y-auto p-3 space-y-2">
                                {filteredBookLines.map(line => {
                                    const isMatched = Array.from(matches.values()).includes(line.id)
                                    const isSelected = selectedBookLine === line.id
                                    return (
                                        <div key={line.id}
                                            className={cn('p-3 rounded-[6px] cursor-pointer transition-colors',
                                                isMatched ? 'opacity-50' : 'hover:bg-gray-50'
                                            )}
                                            style={{
                                                border: isSelected
                                                    ? '1px solid rgba(99,102,241,0.4)'
                                                    : isMatched
                                                        ? '1px solid rgba(16,185,129,0.3)'
                                                        : '1px solid rgba(0,0,0,0.09)',
                                                background: isSelected ? 'rgba(238,242,255,0.6)' : isMatched ? 'rgba(240,253,244,0.6)' : 'white'
                                            }}
                                            onClick={() => !isMatched && setSelectedBookLine(isSelected ? null : line.id)}
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
                                            {isMatched && (
                                                <div className="pt-2 mt-2"
                                                    style={{ borderTop: '1px solid rgba(16,185,129,0.2)' }}>
                                                    <span className="text-[11px] font-[500] text-emerald-600 flex items-center gap-1">
                                                        <PiCheckCircle /> Matched
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    </div>

                    {/* Proceed to review */}
                    {matchedCount > 0 && (
                        <div className="bg-white rounded-[8px] px-5 py-4 flex items-center justify-between" style={CARD_STYLE}>
                            <div>
                                <p className="text-[13px] font-[600] text-gray-900 mb-0.5">
                                    {isReconciled ? 'Everything is matched!' : `${matchedCount} transaction${matchedCount !== 1 ? 's' : ''} matched`}
                                </p>
                                <p className="text-[12px] text-gray-400">
                                    {isReconciled
                                        ? 'Your bank statement and books are in perfect sync.'
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
                                        {unmatchedBankCount + unmatchedBookCount} unmatched items remaining.
                                    </p>
                                </>
                            )}
                        </div>

                        <div className="grid grid-cols-2 gap-4 mb-6">
                            <div className="rounded-[8px] px-5 py-4 text-center" style={{ background: '#FAFAFA', border: '1px solid rgba(0,0,0,0.07)' }}>
                                <p className="text-[10.5px] font-[500] text-gray-400 uppercase tracking-[0.06em] mb-1">Total Matched</p>
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
                            <button
                                onClick={() => alert('Reconciliation saved!')}
                                disabled={!isReconciled}
                                className="flex-1 px-4 py-2.5 rounded-[6px] text-[12.5px] font-[500] text-white bg-[#6366F1] hover:bg-indigo-600 transition-colors disabled:opacity-50">
                                {isReconciled ? 'Save & Complete' : 'Complete Anyway'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
