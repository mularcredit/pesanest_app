"use client";

import { useMemo, useState } from "react";
import {
    PiListDashes, PiArrowsLeftRight, PiMagnifyingGlass,
    PiDownloadSimple, PiCaretLeft, PiCaretRight,
} from "react-icons/pi";
import { CARD_STYLE, HAIRLINE } from "./SectionHeader";

const STATUS_META: Record<string, { text: string; bg: string }> = {
    APPROVED:         { text: '#059669', bg: '#ECFDF5' },
    PAID:             { text: '#059669', bg: '#ECFDF5' },
    REIMBURSED:       { text: '#059669', bg: '#ECFDF5' },
    PENDING:          { text: '#D97706', bg: '#FFFBEB' },
    PENDING_APPROVAL: { text: '#D97706', bg: '#FFFBEB' },
    SUBMITTED:        { text: '#2563EB', bg: '#EFF6FF' },
    REJECTED:         { text: '#DC2626', bg: '#FEF2F2' },
    DRAFT:            { text: '#6B7280', bg: '#F9FAFB' },
};

const PAGE_SIZE = 8;

/** Builds a compact page-button sequence with ellipses, e.g. « 1 2 3 … 10 » */
function pageSequence(current: number, total: number): (number | '…')[] {
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    const seq = new Set([1, total, current, current - 1, current + 1]);
    const sorted = [...seq].filter(n => n >= 1 && n <= total).sort((a, b) => a - b);
    const out: (number | '…')[] = [];
    sorted.forEach((n, i) => {
        if (i > 0 && n - (sorted[i - 1] as number) > 1) out.push('…');
        out.push(n);
    });
    return out;
}

function downloadCsv(rows: any[]) {
    const header = ['Title', 'Merchant', 'Category', 'Date', 'Status', 'Amount'];
    const lines = rows.map(r => [
        r.title, r.merchant || '', r.category,
        new Date(r.expenseDate || r.createdAt).toISOString().slice(0, 10),
        r.status, r.amount,
    ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','));
    const csv = [header.join(','), ...lines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transactions-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
}

export function TransactionTable({ expenses }: { expenses: any[] }) {
    const [query, setQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('ALL');
    const [page, setPage] = useState(1);

    const statuses = useMemo(() => Array.from(new Set((expenses || []).map(e => e.status))), [expenses]);

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        return (expenses || []).filter(e => {
            if (statusFilter !== 'ALL' && e.status !== statusFilter) return false;
            if (!q) return true;
            return (e.title || '').toLowerCase().includes(q)
                || (e.merchant || '').toLowerCase().includes(q)
                || (e.category || '').toLowerCase().includes(q);
        });
    }, [expenses, query, statusFilter]);

    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const safePage = Math.min(page, totalPages);
    const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

    if (!expenses || expenses.length === 0) {
        return (
            <div className="bg-white rounded-[16px] p-16 flex flex-col items-center justify-center" style={CARD_STYLE}>
                <div className="w-12 h-12 rounded-[10px] flex items-center justify-center mb-3"
                    style={{ background: 'rgba(0,0,0,0.04)' }}>
                    <PiListDashes className="text-2xl text-gray-300" />
                </div>
                <p className="text-[13px] font-[500] text-gray-500">No recent transactions</p>
                <p className="text-[12px] text-gray-400 mt-0.5">Expense activity will appear here</p>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-[16px] overflow-hidden" style={CARD_STYLE}>
            <div className="px-5 py-4 flex items-center gap-3 flex-wrap" style={{ borderBottom: HAIRLINE }}>
                <div className="w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0" style={{ background: 'rgba(99,102,241,0.1)' }}>
                    <PiArrowsLeftRight style={{ color: '#6366F1' }} className="text-[16px]" />
                </div>
                <div className="mr-auto">
                    <h2 className="text-[13px] font-[600] text-gray-900">Recent Activity</h2>
                    <p className="text-[11.5px] text-gray-400 mt-0.5">{filtered.length} transaction{filtered.length !== 1 ? 's' : ''} this month</p>
                </div>
                <button onClick={() => downloadCsv(filtered)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-[8px] text-[12px] font-[500] text-gray-600 hover:bg-gray-50 transition-colors shrink-0"
                    style={{ border: HAIRLINE }}>
                    <PiDownloadSimple className="text-[13px]" /> Export
                </button>
            </div>

            {/* Toolbar: search + status filter */}
            <div className="px-5 py-3 flex items-center gap-2.5 flex-wrap" style={{ borderBottom: HAIRLINE, background: '#FAFAFA' }}>
                <div className="relative flex-1 min-w-[180px]">
                    <PiMagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300 text-[13px]" />
                    <input
                        type="text"
                        value={query}
                        onChange={e => { setQuery(e.target.value); setPage(1); }}
                        placeholder="Search title, merchant or category…"
                        className="w-full rounded-[7px] pl-8 pr-3 py-2 text-[12.5px] outline-none focus:ring-1 focus:ring-[#6366F1] bg-white"
                        style={{ border: HAIRLINE }}
                    />
                </div>
                <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
                    className="rounded-[7px] px-3 py-2 text-[12px] font-[500] text-gray-600 bg-white outline-none shrink-0"
                    style={{ border: HAIRLINE }}>
                    <option value="ALL">All statuses</option>
                    {statuses.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                </select>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-left">
                    <thead style={{ borderBottom: HAIRLINE, background: '#FAFAFA' }}>
                        <tr>
                            <th className="py-3 px-5 text-[10.5px] font-[500] text-gray-400 uppercase tracking-[0.06em]">Transaction</th>
                            <th className="py-3 px-5 text-[10.5px] font-[500] text-gray-400 uppercase tracking-[0.06em]">Category</th>
                            <th className="py-3 px-5 text-[10.5px] font-[500] text-gray-400 uppercase tracking-[0.06em]">Date</th>
                            <th className="py-3 px-5 text-[10.5px] font-[500] text-gray-400 uppercase tracking-[0.06em]">Status</th>
                            <th className="py-3 px-5 text-[10.5px] font-[500] text-gray-400 uppercase tracking-[0.06em] text-right">Amount</th>
                        </tr>
                    </thead>
                    <tbody>
                        {pageRows.length === 0 && (
                            <tr><td colSpan={5} className="py-10 text-center text-[12.5px] text-gray-400">No transactions match your search</td></tr>
                        )}
                        {pageRows.map((expense: any, i: number) => {
                            const meta = STATUS_META[expense.status] || STATUS_META['DRAFT'];
                            return (
                                <tr key={expense.id || i}
                                    className="hover:bg-gray-50/60 transition-colors"
                                    style={i < pageRows.length - 1 ? { borderBottom: '1px solid rgba(0,0,0,0.06)' } : {}}>
                                    <td className="py-3.5 px-5">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-[7px] bg-gray-50 flex items-center justify-center shrink-0">
                                                <PiArrowsLeftRight className="text-[13px]" style={{ color: '#059669' }} />
                                            </div>
                                            <div>
                                                <div className="text-[12.5px] font-[500] text-gray-900">{expense.title}</div>
                                                <div className="text-[11px] text-gray-400 mt-0.5">{expense.merchant || '—'}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="py-3.5 px-5">
                                        <span className="text-[10.5px] font-[500] text-gray-500 bg-gray-50 px-2 py-0.5 rounded-[4px]"
                                            style={{ border: HAIRLINE }}>
                                            {expense.category}
                                        </span>
                                    </td>
                                    <td className="py-3.5 px-5 text-[12px] text-gray-500 font-mono">
                                        {new Date(expense.expenseDate || expense.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                                    </td>
                                    <td className="py-3.5 px-5">
                                        <span className="text-[10.5px] font-[600] px-2.5 py-1 rounded-full"
                                            style={{ color: meta.text, background: meta.bg }}>
                                            {expense.status.replace('_', ' ')}
                                        </span>
                                    </td>
                                    <td className="py-3.5 px-5 text-right font-mono font-[600] text-[13px] text-gray-900">
                                        KES {Number(expense.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="px-5 py-3 flex items-center justify-between flex-wrap gap-2" style={{ borderTop: HAIRLINE }}>
                    <p className="text-[11.5px] text-gray-400">
                        Page {safePage} of {totalPages}
                    </p>
                    <div className="flex items-center gap-1">
                        <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={safePage === 1}
                            className="w-7 h-7 rounded-[6px] flex items-center justify-center text-gray-500 hover:bg-gray-50 disabled:opacity-30 transition-colors"
                            style={{ border: HAIRLINE }}>
                            <PiCaretLeft className="text-[12px]" />
                        </button>
                        {pageSequence(safePage, totalPages).map((p, i) => p === '…' ? (
                            <span key={`e${i}`} className="w-7 h-7 flex items-center justify-center text-[11.5px] text-gray-300">…</span>
                        ) : (
                            <button key={p} onClick={() => setPage(p)}
                                className="w-7 h-7 rounded-[6px] flex items-center justify-center text-[11.5px] font-[600] transition-colors"
                                style={p === safePage
                                    ? { background: '#6366F1', color: '#fff' }
                                    : { color: '#6b7280', border: HAIRLINE }}>
                                {p}
                            </button>
                        ))}
                        <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={safePage === totalPages}
                            className="w-7 h-7 rounded-[6px] flex items-center justify-center text-gray-500 hover:bg-gray-50 disabled:opacity-30 transition-colors"
                            style={{ border: HAIRLINE }}>
                            <PiCaretRight className="text-[12px]" />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
