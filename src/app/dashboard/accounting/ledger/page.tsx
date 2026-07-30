import prisma from "@/lib/prisma";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { AccountingActions } from "@/components/accounting/AccountingActions";
import { LedgerExportButton } from "@/components/accounting/LedgerExportButton";
import { LedgerAccountSelect } from "./LedgerAccountSelect";
import { PiBookOpenText, PiCaretLeft, PiCaretRight, PiPlus } from "react-icons/pi";

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

export default async function GeneralLedgerPage({
    searchParams,
}: {
    searchParams: Promise<{ p?: string; q?: string; code?: string }>;
}) {
    const session = await auth();
    if (!session?.user) return redirect("/login");

    const params      = await searchParams;
    const page        = parseInt(params.p || "1");
    const search      = params.q || "";
    const selectedCode = params.code || "";
    const pageSize    = 20;

    const allAccounts = await prisma.account.findMany({
        where: { isActive: true },
        orderBy: { code: 'asc' },
    });

    const whereClause: any = {};
    const orConditions: any[] = [];

    if (search) {
        orConditions.push({ description: { contains: search, mode: 'insensitive' } });
        orConditions.push({ reference:   { contains: search, mode: 'insensitive' } });
        orConditions.push({ lines: { some: { account: { code: { contains: search, mode: 'insensitive' } } } } });
    }
    if (selectedCode) {
        orConditions.push({ lines: { some: { account: { code: selectedCode } } } });
    }
    if (orConditions.length > 0) whereClause.OR = orConditions;

    const [entries, totalCount] = await Promise.all([
        (prisma as any).journalEntry.findMany({
            where: whereClause,
            skip: (page - 1) * pageSize,
            take: pageSize,
            orderBy: { date: 'desc' },
            include: { lines: { include: { account: true } } },
        }),
        (prisma as any).journalEntry.count({ where: whereClause }),
    ]);

    const totalPages = Math.ceil(totalCount / pageSize);
    const showing    = { from: (page - 1) * pageSize + 1, to: Math.min(page * pageSize, totalCount) };

    // Aggregate totals across current page
    const pageTotalDr = entries.reduce((s: number, e: any) =>
        s + e.lines.reduce((ls: number, l: any) => ls + l.debit, 0), 0);
    const pageTotalCr = entries.reduce((s: number, e: any) =>
        s + e.lines.reduce((ls: number, l: any) => ls + l.credit, 0), 0);

    const pageUrl = (p: number) =>
        `?p=${p}${search ? `&q=${encodeURIComponent(search)}` : ''}${selectedCode ? `&code=${selectedCode}` : ''}`;

    return (
        <div className="pb-20 space-y-5">

            {/* ── Header ── */}
            <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <div className="w-[30px] h-[30px] rounded-[7px] bg-[#6366F1] flex items-center justify-center shrink-0">
                            <PiBookOpenText className="text-white text-[15px]" />
                        </div>
                        <h1 className="text-[19px] font-[600] text-gray-900 tracking-tight">General Ledger</h1>
                    </div>
                    <p className="text-[12px] text-gray-400 pl-[38px]">
                        {totalCount} entr{totalCount === 1 ? 'y' : 'ies'} · all posted journal entries
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <LedgerExportButton />
                    <AccountingActions type="MANUAL_JOURNAL" />
                </div>
            </div>

            {/* ── KPI strip ── */}
            <div className="grid grid-cols-3 gap-3">
                <div className="bg-white rounded-[8px] px-5 py-4" style={{ border: HAIRLINE }}>
                    <p className="text-[10px] font-[600] uppercase tracking-[0.09em] text-gray-400 mb-2">Total Entries</p>
                    <p className="text-[20px] font-[700] text-gray-900 tabular-nums leading-none">{totalCount.toLocaleString()}</p>
                    <p className="text-[10.5px] text-gray-400 mt-1">journal entries</p>
                </div>
                <div className="bg-white rounded-[8px] px-5 py-4" style={{ border: HAIRLINE }}>
                    <p className="text-[10px] font-[600] uppercase tracking-[0.09em] text-rose-500 mb-2">Page Debits</p>
                    <p className="text-[20px] font-[700] font-mono tabular-nums leading-none text-gray-900">{fmt(pageTotalDr)}</p>
                    <p className="text-[10.5px] text-gray-400 mt-1">KES · this page</p>
                </div>
                <div className="bg-white rounded-[8px] px-5 py-4" style={{ border: HAIRLINE }}>
                    <p className="text-[10px] font-[600] uppercase tracking-[0.09em] text-emerald-600 mb-2">Page Credits</p>
                    <p className="text-[20px] font-[700] font-mono tabular-nums leading-none text-gray-900">{fmt(pageTotalCr)}</p>
                    <p className="text-[10.5px] text-gray-400 mt-1">KES · this page</p>
                </div>
            </div>

            {/* ── Filter bar ── */}
            <form className="bg-white rounded-[8px] flex items-center gap-0 overflow-hidden" style={{ border: HAIRLINE }}>
                {/* Search */}
                <div className="flex items-center gap-2 flex-1 px-4 py-2.5">
                    <input
                        name="q"
                        defaultValue={search}
                        type="text"
                        placeholder="Search reference, description or account code…"
                        className="flex-1 text-[12.5px] text-gray-700 placeholder:text-gray-400 outline-none bg-transparent"
                    />
                </div>

                {/* Divider */}
                <div className="w-px h-8 shrink-0" style={{ background: 'rgba(0,0,0,0.07)' }} />

                {/* Account filter */}
                <LedgerAccountSelect accounts={allAccounts} defaultValue={selectedCode} />

                {/* Divider */}
                <div className="w-px h-8 shrink-0" style={{ background: 'rgba(0,0,0,0.07)' }} />

                {/* Submit */}
                <button
                    type="submit"
                    className="px-5 py-2.5 text-[12.5px] font-[600] text-[#6366F1] hover:bg-indigo-50 transition-colors"
                >
                    Filter
                </button>
            </form>

            {/* ── Entry list ── */}
            {entries.length === 0 ? (
                <div className="bg-white rounded-[8px] py-20 flex flex-col items-center gap-3" style={{ border: HAIRLINE }}>
                    <div className="w-10 h-10 rounded-[8px] bg-gray-50 flex items-center justify-center" style={{ border: HAIRLINE }}>
                        <PiBookOpenText className="text-gray-300 text-[18px]" />
                    </div>
                    <p className="text-[13px] font-[500] text-gray-900">
                        {search || selectedCode ? 'No entries match your filter' : 'No journal entries yet'}
                    </p>
                    <p className="text-[12px] text-gray-400">
                        {search || selectedCode ? 'Try a different search or clear the filter.' : 'Post a journal entry to get started.'}
                    </p>
                </div>
            ) : (
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

                                        {/* Delete — shown on hover */}
                                        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                            <AccountingActions type="DELETE_ENTRY" entryId={entry.id} />
                                        </div>
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
            )}

            {/* ── Pagination ── */}
            {totalPages > 1 && (
                <div className="bg-white rounded-[8px] flex items-center justify-between px-5 py-3" style={{ border: HAIRLINE }}>
                    <p className="text-[12px] text-gray-400">
                        Showing <span className="font-[600] text-gray-700">{showing.from}–{showing.to}</span> of{' '}
                        <span className="font-[600] text-gray-700">{totalCount}</span> entries
                    </p>

                    <div className="flex items-center gap-1">
                        {page > 1 ? (
                            <a href={pageUrl(page - 1)}
                                className="flex items-center gap-1 px-3 py-1.5 rounded-[6px] text-[12px] font-[500] text-gray-600 hover:bg-gray-100 transition-colors"
                                style={{ border: HAIRLINE }}>
                                <PiCaretLeft className="text-[12px]" /> Previous
                            </a>
                        ) : (
                            <span className="flex items-center gap-1 px-3 py-1.5 rounded-[6px] text-[12px] font-[500] text-gray-300 cursor-not-allowed"
                                style={{ border: '1px solid rgba(0,0,0,0.04)' }}>
                                <PiCaretLeft className="text-[12px]" /> Previous
                            </span>
                        )}

                        {/* Page pills */}
                        <div className="flex items-center gap-1 mx-2">
                            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                                const p = i + 1;
                                const isCurrent = p === page;
                                return (
                                    <a key={p} href={pageUrl(p)}
                                        className="w-7 h-7 flex items-center justify-center rounded-[5px] text-[12px] font-[500] transition-colors"
                                        style={{
                                            background: isCurrent ? '#6366F1' : 'transparent',
                                            color: isCurrent ? 'white' : '#6b7280',
                                            border: isCurrent ? '1px solid #6366F1' : HAIRLINE,
                                        }}>
                                        {p}
                                    </a>
                                );
                            })}
                            {totalPages > 7 && (
                                <span className="text-[12px] text-gray-400 px-1">…{totalPages}</span>
                            )}
                        </div>

                        {page < totalPages ? (
                            <a href={pageUrl(page + 1)}
                                className="flex items-center gap-1 px-3 py-1.5 rounded-[6px] text-[12px] font-[500] text-gray-600 hover:bg-gray-100 transition-colors"
                                style={{ border: HAIRLINE }}>
                                Next <PiCaretRight className="text-[12px]" />
                            </a>
                        ) : (
                            <span className="flex items-center gap-1 px-3 py-1.5 rounded-[6px] text-[12px] font-[500] text-gray-300 cursor-not-allowed"
                                style={{ border: '1px solid rgba(0,0,0,0.04)' }}>
                                Next <PiCaretRight className="text-[12px]" />
                            </span>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
