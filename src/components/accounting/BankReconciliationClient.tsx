'use client'

import { useState, useMemo, useRef } from 'react'
import { read, utils } from 'xlsx'
import {
    PiUploadSimple, PiCheckCircle, PiWarning, PiX, PiPlus,
    PiBank, PiArrowsLeftRight,
    PiFileText, PiLightning, PiInfo, PiSpinner, PiTrash, PiFloppyDisk
} from 'react-icons/pi'
import { cn } from '@/lib/utils'
import { useToast } from '@/components/ui/ToastProvider'

interface JournalLine {
    id: string; entryId: string; date: string; description: string; reference: string;
    debit: number; credit: number; amount: number;
}

interface BankTransaction {
    id: string; date: string; description: string; amount: number; statementId: string;
}

interface ReconciliationDraft {
    id: string; label: string | null; createdAt: string; originalCount: number; lines: BankTransaction[];
}

interface Props {
    /** A BankAccount or PaybillAccount id — both are reconcilable accounts, see reconcilable-accounts.ts */
    bankAccountId: string; glBalance: number; journalLines: JournalLine[]; currency?: string;
    initialStatementLines?: BankTransaction[];
    initialDrafts?: ReconciliationDraft[];
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

// Statement exports rarely agree on column names — M-Pesa paybill statements
// use "Completion Time" / "Details" / "Paid In" / "Withdrawn"; bank exports
// tend to use "Date" / "Description" / "Amount" or split "Debit"/"Credit".
const HEADER_ALIASES = {
    date: ['completion time', 'transaction date', 'trans date', 'date', 'value date', 'posting date'],
    description: ['details', 'description', 'narration', 'particulars', 'transaction details'],
    amount: ['amount'],
    credit: ['paid in', 'credit', 'money in', 'cr'],
    debit: ['withdrawn', 'debit', 'money out', 'dr'],
};

const normalizeHeader = (h: unknown) => String(h ?? '').trim().toLowerCase();

/** M-Pesa/bank exports often prefix a few metadata rows before the real header row. */
function findHeaderRow(rows: any[][]): number {
    for (let i = 0; i < Math.min(rows.length, 30); i++) {
        const cells = (rows[i] || []).map(normalizeHeader);
        const hasDate = HEADER_ALIASES.date.some(a => cells.includes(a));
        const hasAmount = HEADER_ALIASES.amount.some(a => cells.includes(a));
        const hasCredit = HEADER_ALIASES.credit.some(a => cells.includes(a));
        const hasDebit = HEADER_ALIASES.debit.some(a => cells.includes(a));
        if (hasDate && (hasAmount || hasCredit || hasDebit)) return i;
    }
    return -1;
}

function findCol(headerCells: string[], aliases: string[]): number {
    for (const a of aliases) {
        const idx = headerCells.indexOf(a);
        if (idx !== -1) return idx;
    }
    return -1;
}

const toNum = (v: unknown) => {
    const n = parseFloat(String(v ?? '').replace(/,/g, ''));
    return Number.isNaN(n) ? 0 : n;
};

/** Handles ISO strings, native Date cells, and the DD-MM-YYYY[ HH:mm:ss] format M-Pesa exports use. */
function parseStatementDate(raw: unknown): Date | null {
    if (raw == null || raw === '') return null;
    if (raw instanceof Date) return Number.isNaN(raw.getTime()) ? null : raw;

    const s = String(raw).trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
        const d = new Date(s);
        return Number.isNaN(d.getTime()) ? null : d;
    }

    const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
    if (m) {
        const [, dd, mm, yyyy, hh = '0', min = '0', ss = '0'] = m;
        const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd), Number(hh), Number(min), Number(ss));
        return Number.isNaN(d.getTime()) ? null : d;
    }

    const fallback = new Date(s);
    return Number.isNaN(fallback.getTime()) ? null : fallback;
}

/** Finds the real header row, resolves aliased columns, and normalizes rows into {date, description, amount}. */
function parseStatementRows(rawRows: any[][]): { parsed: { date: Date; description: string; amount: number }[]; skipped: number; headerRowIdx: number } {
    const headerRowIdx = findHeaderRow(rawRows);
    if (headerRowIdx === -1) {
        throw new Error("Couldn't find a header row with recognizable date/amount columns in this file");
    }

    const headerCells = rawRows[headerRowIdx].map(normalizeHeader);
    const dateCol = findCol(headerCells, HEADER_ALIASES.date);
    const descCol = findCol(headerCells, HEADER_ALIASES.description);
    const amountCol = findCol(headerCells, HEADER_ALIASES.amount);
    const creditCol = findCol(headerCells, HEADER_ALIASES.credit);
    const debitCol = findCol(headerCells, HEADER_ALIASES.debit);

    if (dateCol === -1) throw new Error("Couldn't find a date column in this file");
    if (amountCol === -1 && creditCol === -1 && debitCol === -1) {
        throw new Error("Couldn't find an amount, or paid-in/withdrawn columns in this file");
    }

    const parsed: { date: Date; description: string; amount: number }[] = [];
    let skipped = 0;

    for (let i = headerRowIdx + 1; i < rawRows.length; i++) {
        const row = rawRows[i] || [];
        if (row.length === 0 || row.every((c: any) => c === undefined || c === null || c === '')) continue;

        const date = parseStatementDate(row[dateCol]);
        if (!date) { skipped++; continue; }

        const description = descCol !== -1 ? String(row[descCol] ?? '').trim() : '';
        const amount = amountCol !== -1
            ? toNum(row[amountCol])
            : (creditCol !== -1 ? toNum(row[creditCol]) : 0) - Math.abs(debitCol !== -1 ? toNum(row[debitCol]) : 0);

        parsed.push({ date, description: description || 'Unknown', amount });
    }

    return { parsed, skipped, headerRowIdx };
}

/** Scans the rows above the header for "Opening/Closing Balance:" labels, e.g. M-Pesa's preamble. */
function detectBalances(rawRows: any[][], headerRowIdx: number): { opening: number | null; closing: number | null } {
    let opening: number | null = null;
    let closing: number | null = null;
    for (let i = 0; i < headerRowIdx; i++) {
        const row = rawRows[i] || [];
        row.forEach((cell: any, idx: number) => {
            const label = normalizeHeader(cell);
            if (label.includes('opening balance') && row[idx + 1] != null) opening = toNum(row[idx + 1]);
            if (label.includes('closing balance') && row[idx + 1] != null) closing = toNum(row[idx + 1]);
        });
    }
    return { opening, closing };
}

export function BankReconciliationClient({
    bankAccountId, glBalance, journalLines, currency = 'KES', initialStatementLines = [], initialDrafts = [],
}: Props) {
    const { showToast } = useToast();
    const [step, setStep] = useState<'upload' | 'match' | 'review'>(initialStatementLines.length > 0 ? 'match' : 'upload')
    const [bankTransactions, setBankTransactions] = useState<BankTransaction[]>(initialStatementLines)
    const [bookLines, setBookLines] = useState<JournalLine[]>(journalLines)
    const [sessionMatches, setSessionMatches] = useState<{ key: string; bankTxs: BankTransaction[]; bookLines: JournalLine[] }[]>([])
    const [drafts, setDrafts] = useState<ReconciliationDraft[]>(initialDrafts)
    const [openingBalance, setOpeningBalance] = useState('0')
    const [closingBalance, setClosingBalance] = useState('0')
    const [isUploading, setIsUploading] = useState(false)
    const [isMatching, setIsMatching] = useState(false)
    const [isSavingDraft, setIsSavingDraft] = useState(false)
    const [revertingId, setRevertingId] = useState<string | null>(null)
    const [discardingDraftId, setDiscardingDraftId] = useState<string | null>(null)
    const [searchBank, setSearchBank] = useState('')
    const [searchBooks, setSearchBooks] = useState('')
    const [selectedBankTxIds, setSelectedBankTxIds] = useState<Set<string>>(new Set())
    const [selectedBookLineIds, setSelectedBookLineIds] = useState<Set<string>>(new Set())

    const toggleBankTx = (id: string) => {
        setSelectedBankTxIds(prev => {
            const next = new Set(prev)
            next.has(id) ? next.delete(id) : next.add(id)
            return next
        })
    }
    const toggleBookLine = (id: string) => {
        setSelectedBookLineIds(prev => {
            const next = new Set(prev)
            next.has(id) ? next.delete(id) : next.add(id)
            return next
        })
    }
    const fileInputRef = useRef<HTMLInputElement>(null)

    const fmt = (amount: number) =>
        `${currency} ${amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}`

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        setIsUploading(true)
        try {
            const bstr = await readAsBinaryString(file)
            const wb = read(bstr, { type: 'binary', cellDates: true })
            const ws = wb.Sheets[wb.SheetNames[0]]
            const rawRows = utils.sheet_to_json(ws, { header: 1 }) as any[][]

            if (rawRows.length === 0) throw new Error('That file has no rows we could read')

            const { parsed, skipped, headerRowIdx } = parseStatementRows(rawRows)
            if (parsed.length === 0) throw new Error('No usable transaction rows were found in that file')

            const { opening, closing } = detectBalances(rawRows, headerRowIdx)

            const validDates = parsed.map(p => p.date.getTime()).filter(t => !Number.isNaN(t))
            const periodStart = validDates.length ? new Date(Math.min(...validDates)) : new Date()
            const periodEnd = validDates.length ? new Date(Math.max(...validDates)) : new Date()

            const res = await fetch(`/api/accounting/bank-accounts/${bankAccountId}/statements`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    periodStart: periodStart.toISOString().slice(0, 10),
                    periodEnd: periodEnd.toISOString().slice(0, 10),
                    openingBalance: opening ?? (parseFloat(openingBalance) || 0),
                    closingBalance: closing ?? (parseFloat(closingBalance) || 0),
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
                statementId: l.statementId,
            }))

            setBankTransactions(prev => [...prev, ...imported])
            setStep('match')
            showToast(
                `Imported ${imported.length} transaction${imported.length !== 1 ? 's' : ''}` +
                (skipped > 0 ? ` — ${skipped} row${skipped !== 1 ? 's' : ''} skipped (no recognizable date)` : ''),
                'success'
            )
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
            amount: l.credit > 0 ? l.credit : -l.debit, statementId: l.statementId,
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
        const bankTxs = bankTransactions.filter(t => selectedBankTxIds.has(t.id))
        const selectedBooks = bookLines.filter(l => selectedBookLineIds.has(l.id))
        if (bankTxs.length === 0 || selectedBooks.length === 0) return
        setIsMatching(true)
        try {
            const res = await fetch(`/api/accounting/bank-accounts/${bankAccountId}/reconciliation`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'MATCH',
                    statementLineIds: bankTxs.map(t => t.id),
                    journalEntryIds: selectedBooks.map(l => l.entryId),
                    matchType: bankTxs.length > 1 || selectedBooks.length > 1 ? 'MANUAL_SPLIT' : 'MANUAL',
                }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Could not match those')
            setBankTransactions(prev => prev.filter(t => !selectedBankTxIds.has(t.id)))
            setBookLines(prev => prev.filter(l => !selectedBookLineIds.has(l.id)))
            const key = [...bankTxs.map(t => t.id), ...selectedBooks.map(l => l.id)].sort().join('|')
            setSessionMatches(prev => [...prev, { key, bankTxs, bookLines: selectedBooks }])
            setSelectedBankTxIds(new Set())
            setSelectedBookLineIds(new Set())
        } catch (err: any) {
            showToast(err.message || 'Could not match those', 'error')
        } finally {
            setIsMatching(false)
        }
    }

    const unmatch = async (groupKey: string) => {
        const entry = sessionMatches.find(m => m.key === groupKey)
        if (!entry) return
        setIsMatching(true)
        try {
            const res = await fetch(`/api/accounting/bank-accounts/${bankAccountId}/reconciliation`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'UNMATCH', statementLineIds: entry.bankTxs.map(t => t.id) }),
            })
            if (!res.ok) { const data = await res.json().catch(() => ({})); throw new Error(data.error || 'Could not unmatch') }
            setBankTransactions(prev => [...prev, ...entry.bankTxs])
            setBookLines(prev => [...prev, ...entry.bookLines])
            setSessionMatches(prev => prev.filter(m => m.key !== groupKey))
        } catch (err: any) {
            showToast(err.message || 'Could not unmatch', 'error')
        } finally {
            setIsMatching(false)
        }
    }

    const importGroups = useMemo(() => {
        const byStatement = new Map<string, BankTransaction[]>()
        for (const tx of bankTransactions) {
            if (!byStatement.has(tx.statementId)) byStatement.set(tx.statementId, [])
            byStatement.get(tx.statementId)!.push(tx)
        }
        return Array.from(byStatement.entries()).map(([statementId, txs]) => {
            const dates = txs.map(t => new Date(t.date).getTime()).filter(t => !Number.isNaN(t))
            return {
                statementId,
                count: txs.length,
                from: dates.length ? new Date(Math.min(...dates)) : null,
                to: dates.length ? new Date(Math.max(...dates)) : null,
            }
        })
    }, [bankTransactions])

    const revertImport = async (statementId: string, force: boolean = false) => {
        if (!force && !confirm('Revert this import? All its unmatched transactions will be removed.')) return
        setRevertingId(statementId)
        try {
            const url = `/api/accounting/bank-accounts/${bankAccountId}/statements/${statementId}${force ? '?force=true' : ''}`
            const res = await fetch(url, { method: 'DELETE' })
            const data = await res.json().catch(() => ({}))

            if (res.status === 409 && data.matchedCount) {
                setRevertingId(null)
                const wantsForce = confirm(
                    `${data.matchedCount} transaction${data.matchedCount !== 1 ? 's' : ''} in this import ${data.matchedCount !== 1 ? 'are' : 'is'} already matched to a journal entry. ` +
                    `Reverting anyway will unmatch ${data.matchedCount !== 1 ? 'them' : 'it'} (the journal entries themselves are untouched) and then delete the import. Continue?`
                )
                if (wantsForce) await revertImport(statementId, true)
                return
            }

            if (!res.ok) throw new Error(data.error || 'Could not revert that import')

            setBankTransactions(prev => prev.filter(t => t.statementId !== statementId))
            if (data.matchesDropped > 0) await refreshUnmatched()
            showToast(
                data.matchesDropped > 0 ? `Import reverted — ${data.matchesDropped} match${data.matchesDropped !== 1 ? 'es' : ''} undone` : 'Import reverted',
                'success'
            )
        } catch (err: any) {
            showToast(err.message || 'Could not revert that import', 'error')
        } finally {
            setRevertingId(null)
        }
    }

    const saveDraft = async () => {
        const ids = Array.from(selectedBankTxIds)
        if (ids.length === 0) return
        const label = prompt('Optional label for this draft (e.g. "August salaries, waiting on entry"):') || undefined
        setIsSavingDraft(true)
        try {
            const res = await fetch(`/api/accounting/bank-accounts/${bankAccountId}/reconciliation-drafts`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ statementLineIds: ids, label }),
            })
            const data = await res.json().catch(() => ({}))
            if (!res.ok) throw new Error(data.error || 'Could not save draft')
            const savedTxs = bankTransactions.filter(t => selectedBankTxIds.has(t.id))
            setDrafts(prev => [{ id: data.id, label: label || null, createdAt: new Date().toISOString(), originalCount: savedTxs.length, lines: savedTxs }, ...prev])
            setSelectedBankTxIds(new Set())
            showToast('Saved as draft — come back to it anytime before matching', 'success')
        } catch (err: any) {
            showToast(err.message || 'Could not save draft', 'error')
        } finally {
            setIsSavingDraft(false)
        }
    }

    const resumeDraft = (draft: ReconciliationDraft) => {
        const stillAvailable = new Set(bankTransactions.map(t => t.id))
        const ids = draft.lines.map(l => l.id).filter(id => stillAvailable.has(id))
        if (ids.length < draft.lines.length) {
            showToast(`${draft.lines.length - ids.length} transaction(s) from this draft are no longer available`, 'info')
        }
        setSelectedBankTxIds(new Set(ids))
        setSelectedBookLineIds(new Set())
    }

    const discardDraft = async (draftId: string) => {
        if (!confirm('Discard this draft? Its transactions stay unmatched and available — only the saved selection is removed.')) return
        setDiscardingDraftId(draftId)
        try {
            const res = await fetch(`/api/accounting/bank-accounts/${bankAccountId}/reconciliation-drafts/${draftId}`, { method: 'DELETE' })
            const data = await res.json().catch(() => ({}))
            if (!res.ok) throw new Error(data.error || 'Could not discard draft')
            setDrafts(prev => prev.filter(d => d.id !== draftId))
        } catch (err: any) {
            showToast(err.message || 'Could not discard draft', 'error')
        } finally {
            setDiscardingDraftId(null)
        }
    }

    const selectedBankSum = useMemo(() =>
        bankTransactions.filter(t => selectedBankTxIds.has(t.id)).reduce((s, t) => s + t.amount, 0),
        [bankTransactions, selectedBankTxIds])
    const selectedBookSum = useMemo(() =>
        bookLines.filter(l => selectedBookLineIds.has(l.id)).reduce((s, l) => s + l.amount, 0),
        [bookLines, selectedBookLineIds])
    const hasBothSides = selectedBankTxIds.size > 0 && selectedBookLineIds.size > 0
    const sumMatches = hasBothSides && Math.abs(selectedBankSum - selectedBookSum) < 0.01
    const canMatch = hasBothSides && sumMatches

    const filteredBankTx = useMemo(() =>
        bankTransactions.filter(tx => tx.description.toLowerCase().includes(searchBank.toLowerCase())),
        [bankTransactions, searchBank])

    const filteredBookLines = useMemo(() =>
        bookLines.filter(line => line.description.toLowerCase().includes(searchBooks.toLowerCase())),
        [bookLines, searchBooks])

    const matchedCount = sessionMatches.reduce((s, m) => s + m.bankTxs.length, 0)
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
        setSelectedBankTxIds(new Set())
        setSelectedBookLineIds(new Set())
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
                            {selectedBankTxIds.size > 0 && (
                                <button onClick={saveDraft} disabled={isSavingDraft}
                                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-[6px] text-[12.5px] font-[500] text-amber-700 bg-amber-50 hover:bg-amber-100 transition-colors disabled:opacity-50">
                                    {isSavingDraft ? <PiSpinner className="text-[13px] animate-spin" /> : <PiFloppyDisk className="text-[13px]" />}
                                    Save as Draft ({selectedBankTxIds.size})
                                </button>
                            )}
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

                    {/* Saved drafts — resume a paused split-match selection */}
                    {drafts.length > 0 && (
                        <div className="bg-white rounded-[8px] overflow-hidden" style={CARD_STYLE}>
                            <div className="px-5 py-3" style={{ borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
                                <h3 className="text-[12.5px] font-[600] text-gray-900">Saved drafts</h3>
                                <p className="text-[11px] text-gray-400 mt-0.5">
                                    Selections you saved to come back to later — resume loads them back into the checklist on the left.
                                </p>
                            </div>
                            <div className="divide-y" style={{ borderColor: 'rgba(0,0,0,0.06)' }}>
                                {drafts.map(d => {
                                    const total = d.lines.reduce((s, l) => s + l.amount, 0)
                                    const missing = d.originalCount - d.lines.length
                                    return (
                                        <div key={d.id} className="flex items-center justify-between px-5 py-3 gap-3">
                                            <div className="min-w-0">
                                                <p className="text-[12.5px] font-[500] text-gray-800 truncate">
                                                    {d.label || `${d.lines.length} transaction${d.lines.length !== 1 ? 's' : ''}`}
                                                </p>
                                                <p className="text-[11px] text-gray-400 mt-0.5">
                                                    {d.lines.length} tx · {fmt(total)}
                                                    {missing > 0 ? ` · ${missing} no longer available` : ''}
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-1.5 shrink-0">
                                                <button onClick={() => resumeDraft(d)} disabled={d.lines.length === 0}
                                                    className="px-3 py-1.5 rounded-[6px] text-[11.5px] font-[500] text-[#6366F1] hover:bg-indigo-50 transition-colors disabled:opacity-40">
                                                    Resume
                                                </button>
                                                <button onClick={() => discardDraft(d.id)} disabled={discardingDraftId === d.id}
                                                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-[6px] text-[11.5px] font-[500] text-gray-400 hover:bg-gray-50 hover:text-rose-500 transition-colors disabled:opacity-50">
                                                    {discardingDraftId === d.id ? <PiSpinner className="text-[12px] animate-spin" /> : <PiTrash className="text-[12px]" />}
                                                </button>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    )}

                    {/* Recent imports — revert a bad or duplicate one */}
                    {importGroups.length > 0 && (
                        <div className="bg-white rounded-[8px] overflow-hidden" style={CARD_STYLE}>
                            <div className="px-5 py-3" style={{ borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
                                <h3 className="text-[12.5px] font-[600] text-gray-900">Imports still open</h3>
                                <p className="text-[11px] text-gray-400 mt-0.5">
                                    Each is reverted independently. If any of its transactions are already matched, you'll be asked to confirm unmatching them first.
                                </p>
                            </div>
                            <div className="divide-y" style={{ borderColor: 'rgba(0,0,0,0.06)' }}>
                                {importGroups.map(g => (
                                    <div key={g.statementId} className="flex items-center justify-between px-5 py-3">
                                        <div>
                                            <p className="text-[12.5px] font-[500] text-gray-800">
                                                {g.count} transaction{g.count !== 1 ? 's' : ''}
                                                {g.from && g.to && (
                                                    <span className="text-gray-400 font-[400]">
                                                        {' '}· {g.from.toLocaleDateString()} – {g.to.toLocaleDateString()}
                                                    </span>
                                                )}
                                            </p>
                                        </div>
                                        <button onClick={() => revertImport(g.statementId)} disabled={revertingId === g.statementId}
                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] text-[11.5px] font-[500] text-rose-600 hover:bg-rose-50 transition-colors disabled:opacity-50">
                                            {revertingId === g.statementId ? <PiSpinner className="text-[12px] animate-spin" /> : <PiTrash className="text-[12px]" />}
                                            Revert
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

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
                                    <p className="text-[12px] text-gray-400 text-center py-8 px-4 leading-relaxed">
                                        {searchBank.trim()
                                            ? 'No bank transactions match your search'
                                            : bankTransactions.length === 0
                                                ? 'No unmatched bank transactions — every imported item has been matched'
                                                : 'Nothing unmatched here'}
                                    </p>
                                )}
                                {filteredBankTx.map(tx => {
                                    const isSelected = selectedBankTxIds.has(tx.id)
                                    return (
                                        <div key={tx.id}
                                            className="p-3 rounded-[6px] cursor-pointer transition-colors hover:bg-gray-50 flex items-start gap-2.5"
                                            style={{
                                                border: isSelected ? '1px solid rgba(99,102,241,0.4)' : '1px solid rgba(0,0,0,0.09)',
                                                background: isSelected ? 'rgba(238,242,255,0.6)' : 'white'
                                            }}
                                            onClick={() => toggleBankTx(tx.id)}
                                        >
                                            {isSelected
                                                ? <PiCheckCircle className="text-[#6366F1] text-[15px] mt-[1px] shrink-0" />
                                                : <span className="w-[15px] h-[15px] rounded-full mt-[1px] shrink-0" style={{ border: '1.5px solid rgba(0,0,0,0.15)' }} />}
                                            <div className="flex justify-between items-start gap-2 flex-1 min-w-0">
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
                                <p className="text-[10px] font-[500] text-gray-400 uppercase tracking-[0.07em] mb-3">Select & Match</p>

                                {hasBothSides && (
                                    <div className="mb-3 px-2.5 py-2 rounded-[6px] bg-gray-50" style={{ border: '1px solid rgba(0,0,0,0.06)' }}>
                                        <div className="flex items-center justify-between gap-2">
                                            <p className="text-[10.5px] text-gray-400">{selectedBankTxIds.size} bank</p>
                                            <p className="text-[12px] font-[600] font-mono text-gray-900">{fmt(selectedBankSum)}</p>
                                        </div>
                                        <div className="flex items-center justify-between gap-2 mt-1">
                                            <p className="text-[10.5px] text-gray-400">{selectedBookLineIds.size} books</p>
                                            <p className="text-[12px] font-[600] font-mono text-gray-900">{fmt(selectedBookSum)}</p>
                                        </div>
                                        <p className={cn('text-[10.5px] font-[500] mt-1.5 pt-1.5', sumMatches ? 'text-emerald-600' : 'text-amber-600')}
                                            style={{ borderTop: '1px solid rgba(0,0,0,0.06)' }}>
                                            {sumMatches ? '✓ Both sides match' : `Diff ${fmt(Math.abs(selectedBankSum - selectedBookSum))}`}
                                        </p>
                                    </div>
                                )}

                                {canMatch ? (
                                    <button onClick={createMatch} disabled={isMatching}
                                        className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-[6px] text-[12px] font-[500] text-white bg-emerald-600 hover:bg-emerald-700 transition-colors disabled:opacity-50">
                                        {isMatching ? <PiSpinner className="text-[13px] animate-spin" /> : <PiCheckCircle className="text-[13px]" />}
                                        Match ({selectedBankTxIds.size} ↔ {selectedBookLineIds.size})
                                    </button>
                                ) : (
                                    <div className="space-y-2">
                                        <div className={cn('px-3 py-2 rounded-[6px] text-[11px] font-[500] text-center')}
                                            style={{
                                                border: selectedBankTxIds.size > 0 ? '1px solid rgba(99,102,241,0.3)' : '1px solid rgba(0,0,0,0.09)',
                                                background: selectedBankTxIds.size > 0 ? 'rgba(238,242,255,0.6)' : 'white',
                                                color: selectedBankTxIds.size > 0 ? '#6366F1' : '#9ca3af'
                                            }}>
                                            {selectedBankTxIds.size > 0 ? `✓ ${selectedBankTxIds.size} from bank` : 'Pick from bank — select as many as needed'}
                                        </div>
                                        <div className={cn('px-3 py-2 rounded-[6px] text-[11px] font-[500] text-center')}
                                            style={{
                                                border: selectedBookLineIds.size > 0 ? '1px solid rgba(99,102,241,0.3)' : '1px solid rgba(0,0,0,0.09)',
                                                background: selectedBookLineIds.size > 0 ? 'rgba(238,242,255,0.6)' : 'white',
                                                color: selectedBookLineIds.size > 0 ? '#6366F1' : '#9ca3af'
                                            }}>
                                            {selectedBookLineIds.size > 0 ? `✓ ${selectedBookLineIds.size} from books` : 'Pick from books — select as many as needed'}
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
                                    <p className="text-[12px] text-gray-400 text-center py-8 px-4 leading-relaxed">
                                        {searchBooks.trim()
                                            ? 'No book entries match your search'
                                            : "No unmatched journal entries for this account — either nothing's been posted to the ledger yet, or everything posted is already matched. Any bank transactions on the left have nothing to match against until an entry exists in the books."}
                                    </p>
                                )}
                                {filteredBookLines.map(line => {
                                    const isSelected = selectedBookLineIds.has(line.id)
                                    return (
                                        <div key={line.id}
                                            className="p-3 rounded-[6px] cursor-pointer transition-colors hover:bg-gray-50 flex items-start gap-2.5"
                                            style={{
                                                border: isSelected ? '1px solid rgba(99,102,241,0.4)' : '1px solid rgba(0,0,0,0.09)',
                                                background: isSelected ? 'rgba(238,242,255,0.6)' : 'white'
                                            }}
                                            onClick={() => toggleBookLine(line.id)}
                                        >
                                            {isSelected
                                                ? <PiCheckCircle className="text-[#6366F1] text-[15px] mt-[1px] shrink-0" />
                                                : <span className="w-[15px] h-[15px] rounded-full mt-[1px] shrink-0" style={{ border: '1.5px solid rgba(0,0,0,0.15)' }} />}
                                            <div className="flex justify-between items-start gap-2 flex-1 min-w-0">
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
                                    <div key={m.key} className="flex items-center justify-between px-3 py-2 rounded-[5px] bg-emerald-50/40">
                                        <p className="text-[11.5px] text-gray-700 truncate">
                                            {m.bankTxs.length > 1
                                                ? `${m.bankTxs.length} transactions (${m.bankTxs.map(t => t.description).join(', ')})`
                                                : m.bankTxs[0].description}
                                            {' '}<span className="text-gray-400">↔</span>{' '}
                                            {m.bookLines.length > 1
                                                ? `${m.bookLines.length} entries (${m.bookLines.map(l => l.description).join(', ')})`
                                                : m.bookLines[0].description}
                                        </p>
                                        <div className="flex items-center gap-3 shrink-0">
                                            <span className="text-[11.5px] font-mono text-gray-600">
                                                {fmt(m.bankTxs.reduce((s, t) => s + t.amount, 0))}
                                            </span>
                                            <button onClick={() => unmatch(m.key)} disabled={isMatching}
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
