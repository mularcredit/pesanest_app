import { AccountingActions } from "@/components/accounting/AccountingActions";
import { LedgerMoveToAccount } from "./LedgerMoveToAccount";
import { PiBookOpenText, PiPaperclip } from "react-icons/pi";

const HAIRLINE = '1px solid rgba(0,0,0,0.07)';

function fmt(n: number) {
    return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

function fmtDate(d: Date | string) {
    return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

const STATUS_STYLE: Record<string, { bg: string; color: string; dot: string }> = {
    POSTED:  { bg: 'rgba(5,150,105,0.08)',  color: '#059669', dot: '#059669' },
    VOID:    { bg: 'rgba(225,29,72,0.08)',  color: '#e11d48', dot: '#e11d48' },
    DRAFT:   { bg: 'rgba(0,0,0,0.05)',      color: '#6b7280', dot: '#9ca3af' },
};

const STATUS_BORDER: Record<string, string> = {
    POSTED: '#059669',
    VOID:   '#e11d48',
    DRAFT:  '#d1d5db',
};

interface LedgerEntryListProps {
    entries: any[];
    /** Trash entries (voided originals / their reversals) are shown for audit only — no Edit/Void/Move actions. */
    readOnly?: boolean;
    emptyTitle: string;
    emptySubtitle: string;
}

export function LedgerEntryList({ entries, readOnly, emptyTitle, emptySubtitle }: LedgerEntryListProps) {
    if (entries.length === 0) {
        return (
            <div className="bg-white rounded-[8px] py-20 flex flex-col items-center gap-3" style={{ border: HAIRLINE }}>
                <div className="w-10 h-10 rounded-[8px] bg-gray-50 flex items-center justify-center" style={{ border: HAIRLINE }}>
                    <PiBookOpenText className="text-gray-300 text-[18px]" />
                </div>
                <p className="text-[13px] font-[500] text-gray-900">{emptyTitle}</p>
                <p className="text-[12px] text-gray-400">{emptySubtitle}</p>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {entries.map((entry: any) => {
                const status   = entry.status || 'DRAFT';
                const st       = STATUS_STYLE[status] ?? STATUS_STYLE.DRAFT;
                const accentBorder = STATUS_BORDER[status] ?? '#d1d5db';
                const entryDr  = entry.lines.reduce((s: number, l: any) => s + l.debit, 0);
                const entryCr  = entry.lines.reduce((s: number, l: any) => s + l.credit, 0);
                const balanced = Math.abs(entryDr - entryCr) < 0.01;

                return (
                    <div key={entry.id} className="bg-white rounded-[8px] overflow-hidden group"
                        style={{ border: HAIRLINE, borderLeft: `3px solid ${accentBorder}` }}>

                        {/* Entry header */}
                        <div className="flex items-center justify-between gap-4 px-5 py-3"
                            style={{ borderBottom: HAIRLINE, background: 'rgba(0,0,0,0.012)' }}>
                            <div className="flex items-center gap-4 min-w-0">
                                {/* Date chip */}
                                <div className="shrink-0 text-center">
                                    <p className="text-[11px] font-[600] font-mono text-gray-500 whitespace-nowrap">
                                        {fmtDate(entry.date)}
                                    </p>
                                </div>

                                <div className="w-px h-5 shrink-0" style={{ background: 'rgba(0,0,0,0.08)' }} />

                                <div className="min-w-0">
                                    <p className="text-[12.5px] font-[600] text-gray-900 truncate">{entry.description}</p>
                                    <p className="text-[10.5px] font-mono text-gray-400 mt-0.5">
                                        {entry.entryNumber || entry.reference || entry.id.slice(0, 12)}
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                                {/* Receipt/supporting document, if one was attached */}
                                {entry.receiptUrl && (
                                    <a href={entry.receiptUrl} target="_blank" rel="noopener noreferrer"
                                        title="View attached receipt"
                                        className="inline-flex items-center gap-1 text-[10px] font-[600] px-2 py-0.5 rounded-full text-emerald-700 hover:bg-emerald-50 transition-colors"
                                        style={{ background: 'rgba(5,150,105,0.07)' }}>
                                        <PiPaperclip className="text-[11px]" /> Receipt
                                    </a>
                                )}
                                {/* Balance indicator */}
                                <span className="text-[10px] font-[600] px-2 py-0.5 rounded-full"
                                    style={{
                                        background: balanced ? 'rgba(5,150,105,0.07)' : 'rgba(225,29,72,0.07)',
                                        color: balanced ? '#059669' : '#e11d48',
                                    }}>
                                    {balanced ? 'Balanced' : 'Unbalanced'}
                                </span>

                                {/* Status badge */}
                                <span className="inline-flex items-center gap-1.5 text-[10px] font-[600] px-2.5 py-1 rounded-full"
                                    style={{ background: st.bg, color: st.color }}>
                                    <span className="w-[5px] h-[5px] rounded-full shrink-0" style={{ background: st.dot }} />
                                    {status}
                                </span>

                                {!readOnly && (
                                    <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1.5">
                                        {(status === 'DRAFT' || status === 'POSTED') && (
                                            <AccountingActions
                                                type="EDIT_ENTRY"
                                                entryId={entry.id}
                                                entryStatus={status}
                                                initialEntry={{
                                                    date: new Date(entry.date).toISOString().split('T')[0],
                                                    description: entry.description,
                                                    reference: entry.reference || '',
                                                    receiptUrl: entry.receiptUrl || '',
                                                    lines: entry.lines.map((l: any) => ({
                                                        accountId: l.accountId,
                                                        debit: l.debit,
                                                        credit: l.credit,
                                                    })),
                                                }}
                                            />
                                        )}
                                        {status === 'POSTED' && (
                                            <LedgerMoveToAccount entryId={entry.id} description={entry.description} />
                                        )}
                                        {status === 'POSTED' && (
                                            <AccountingActions type="VOID_ENTRY" entryId={entry.id} entryNumber={entry.entryNumber} />
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Lines table */}
                        <table className="w-full">
                            <thead>
                                <tr style={{ borderBottom: HAIRLINE, background: 'rgba(0,0,0,0.008)' }}>
                                    <th className="px-5 py-2 text-left text-[10px] font-[600] uppercase tracking-[0.08em] text-gray-400 w-[60px]">Code</th>
                                    <th className="px-5 py-2 text-left text-[10px] font-[600] uppercase tracking-[0.08em] text-gray-400">Account</th>
                                    <th className="px-5 py-2 text-right text-[10px] font-[600] uppercase tracking-[0.08em] text-rose-500 w-[140px]">Debit</th>
                                    <th className="px-5 py-2 text-right text-[10px] font-[600] uppercase tracking-[0.08em] text-emerald-600 w-[140px]">Credit</th>
                                </tr>
                            </thead>
                            <tbody>
                                {entry.lines.map((line: any, li: number) => (
                                    <tr key={line.id}
                                        className="hover:bg-gray-50/40 transition-colors"
                                        style={li > 0 ? { borderTop: '1px solid rgba(0,0,0,0.04)' } : {}}>
                                        <td className="px-5 py-2.5 text-[11px] font-mono text-gray-400">{line.account.code}</td>
                                        <td className="px-5 py-2.5">
                                            <p className="text-[12.5px] font-[500] text-gray-900">{line.account.name}</p>
                                            {line.description && line.description !== entry.description && (
                                                <p className="text-[10.5px] text-gray-400 mt-0.5">{line.description}</p>
                                            )}
                                        </td>
                                        <td className="px-5 py-2.5 text-right tabular-nums">
                                            {line.debit > 0
                                                ? <span className="text-[12.5px] font-[500] font-mono text-gray-700">{fmt(line.debit)}</span>
                                                : <span className="text-[12px] text-gray-200">—</span>}
                                        </td>
                                        <td className="px-5 py-2.5 text-right tabular-nums">
                                            {line.credit > 0
                                                ? <span className="text-[12.5px] font-[500] font-mono text-gray-700">{fmt(line.credit)}</span>
                                                : <span className="text-[12px] text-gray-200">—</span>}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                            {/* Entry totals */}
                            <tfoot>
                                <tr style={{ borderTop: HAIRLINE, background: 'rgba(0,0,0,0.012)' }}>
                                    <td colSpan={2} className="px-5 py-2.5">
                                        <span className="text-[10px] font-[600] uppercase tracking-[0.08em] text-gray-400">
                                            {entry.lines.length} line{entry.lines.length !== 1 ? 's' : ''}
                                        </span>
                                    </td>
                                    <td className="px-5 py-2.5 text-right tabular-nums">
                                        <span className="text-[12px] font-[700] font-mono text-rose-600">{fmt(entryDr)}</span>
                                    </td>
                                    <td className="px-5 py-2.5 text-right tabular-nums">
                                        <span className="text-[12px] font-[700] font-mono text-emerald-600">{fmt(entryCr)}</span>
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                );
            })}
        </div>
    );
}
