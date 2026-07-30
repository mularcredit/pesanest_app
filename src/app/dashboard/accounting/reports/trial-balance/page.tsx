import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import prisma from '@/lib/prisma';
import {
    PiScales,
    PiTrendUp, PiTrendDown, PiCheckCircle, PiWarningCircle,
} from 'react-icons/pi';
import { ReportExportButton } from '@/components/accounting/ReportExportButton';
import type { ReportExportData } from '@/components/accounting/ReportExportButton';

const HAIRLINE = '1px solid rgba(0,0,0,0.07)';

const TYPE_META: Record<string, { label: string; color: string; bg: string; dot: string }> = {
    ASSET:     { label: 'Assets',      color: '#059669', bg: 'rgba(5,150,105,0.07)',   dot: '#059669' },
    LIABILITY: { label: 'Liabilities', color: '#e11d48', bg: 'rgba(225,29,72,0.07)',   dot: '#e11d48' },
    EQUITY:    { label: 'Equity',      color: '#6366F1', bg: 'rgba(99,102,241,0.07)',  dot: '#6366F1' },
    REVENUE:   { label: 'Revenue',     color: '#0284c7', bg: 'rgba(2,132,199,0.07)',   dot: '#0284c7' },
    EXPENSE:   { label: 'Expenses',    color: '#d97706', bg: 'rgba(217,119,6,0.07)',   dot: '#d97706' },
};

const TYPE_ORDER = ['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'];

function fmt(n: number) {
    return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

export default async function TrialBalancePage() {
    const session = await auth();
    if (!session?.user) return redirect('/login');

    const accounts = await prisma.account.findMany({
        where: { isActive: true },
        include: {
            journalLines: {
                where: { entry: { status: 'POSTED' } },
            },
        },
        orderBy: { code: 'asc' },
    });

    const rows = accounts.map(acc => {
        const dr = acc.journalLines.reduce((s, l) => s + l.debit, 0);
        const cr = acc.journalLines.reduce((s, l) => s + l.credit, 0);
        const isDebitNormal = ['ASSET', 'EXPENSE'].includes(acc.type);
        return {
            code: acc.code,
            name: acc.name,
            type: acc.type,
            subtype: acc.subtype,
            debit: dr,
            credit: cr,
            balance: isDebitNormal ? dr - cr : cr - dr,
            balanceSide: isDebitNormal ? 'DR' : 'CR',
        };
    }).filter(r => r.debit > 0 || r.credit > 0);

    const totalDebits  = rows.reduce((s, r) => s + r.debit, 0);
    const totalCredits = rows.reduce((s, r) => s + r.credit, 0);
    const diff         = Math.abs(totalDebits - totalCredits);
    const isBalanced   = diff < 0.01;

    const byType = TYPE_ORDER.reduce<Record<string, typeof rows>>((acc, t) => {
        acc[t] = rows.filter(r => r.type === t);
        return acc;
    }, {});

    const asOf = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

    const exportData: ReportExportData = {
        title: 'Trial Balance',
        subtitle: `As at ${asOf}`,
        company: 'Company',
        currency: 'KES',
        sections: [
            ...TYPE_ORDER.filter(t => byType[t]?.length > 0).map(type => ({
                title: TYPE_META[type].label,
                lines: [
                    ...byType[type].map(r => ({ code: r.code, name: r.name, current: r.balance, indent: true as const })),
                    { name: `${TYPE_META[type].label} Subtotal`, current: byType[type].reduce((s: number, r: { balance: number }) => s + r.balance, 0), isBold: true as const, isSubtotal: true as const },
                ],
            })),
            {
                title: 'Totals',
                lines: [
                    { name: 'Total Debits', current: totalDebits, isBold: true },
                    { name: 'Total Credits', current: totalCredits, isBold: true },
                ],
            },
        ],
    };

    return (
        <div className="pb-20 space-y-5">

            {/* ── Header ── */}
            <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <div className="w-[30px] h-[30px] rounded-[7px] bg-[#6366F1] flex items-center justify-center">
                            <PiScales className="text-white text-[15px]" />
                        </div>
                        <h1 className="text-[19px] font-[600] text-gray-900 tracking-tight">Trial Balance</h1>
                    </div>
                    <p className="text-[12px] text-gray-400 pl-[38px]">As at {asOf}</p>
                </div>

                <ReportExportButton data={exportData} />
            </div>

            {/* ── KPI strip ── */}
            <div className="grid grid-cols-3 gap-3">
                {/* Total Debits */}
                <div className="bg-white rounded-[8px] px-5 py-4" style={{ border: HAIRLINE }}>
                    <div className="flex items-start justify-between">
                        <div>
                            <p className="text-[10px] font-[600] uppercase tracking-[0.09em] text-gray-400 mb-1.5">Total Debits</p>
                            <p className="text-[20px] font-[700] text-gray-900 font-mono tabular-nums leading-none">
                                {fmt(totalDebits)}
                            </p>
                            <p className="text-[11px] text-gray-400 mt-1">KES</p>
                        </div>
                        <div className="w-8 h-8 rounded-[7px] bg-rose-50 flex items-center justify-center">
                            <PiTrendDown className="text-rose-500 text-[15px]" />
                        </div>
                    </div>
                </div>

                {/* Total Credits */}
                <div className="bg-white rounded-[8px] px-5 py-4" style={{ border: HAIRLINE }}>
                    <div className="flex items-start justify-between">
                        <div>
                            <p className="text-[10px] font-[600] uppercase tracking-[0.09em] text-gray-400 mb-1.5">Total Credits</p>
                            <p className="text-[20px] font-[700] text-gray-900 font-mono tabular-nums leading-none">
                                {fmt(totalCredits)}
                            </p>
                            <p className="text-[11px] text-gray-400 mt-1">KES</p>
                        </div>
                        <div className="w-8 h-8 rounded-[7px] bg-emerald-50 flex items-center justify-center">
                            <PiTrendUp className="text-emerald-500 text-[15px]" />
                        </div>
                    </div>
                </div>

                {/* Balance status */}
                <div className="bg-white rounded-[8px] px-5 py-4"
                    style={{ border: isBalanced ? '1px solid rgba(5,150,105,0.25)' : '1px solid rgba(225,29,72,0.25)' }}>
                    <div className="flex items-start justify-between">
                        <div>
                            <p className="text-[10px] font-[600] uppercase tracking-[0.09em] text-gray-400 mb-1.5">Status</p>
                            <div className="flex items-center gap-1.5">
                                {isBalanced
                                    ? <PiCheckCircle className="text-emerald-500 text-[17px]" />
                                    : <PiWarningCircle className="text-rose-500 text-[17px]" />
                                }
                                <p className={`text-[15px] font-[700] ${isBalanced ? 'text-emerald-600' : 'text-rose-600'}`}>
                                    {isBalanced ? 'Balanced' : 'Unbalanced'}
                                </p>
                            </div>
                            {!isBalanced && (
                                <p className="text-[11px] text-rose-500 mt-1 font-mono">Diff: {fmt(diff)}</p>
                            )}
                            {isBalanced && (
                                <p className="text-[11px] text-emerald-500 mt-1">Debits = Credits ✓</p>
                            )}
                        </div>
                        <div className={`w-8 h-8 rounded-[7px] flex items-center justify-center ${isBalanced ? 'bg-emerald-50' : 'bg-rose-50'}`}>
                            <PiScales className={`text-[15px] ${isBalanced ? 'text-emerald-500' : 'text-rose-500'}`} />
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Ledger table ── */}
            <div className="bg-white rounded-[8px] overflow-hidden" style={{ border: HAIRLINE }}>
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[600px]">
                        <thead>
                            <tr style={{ borderBottom: HAIRLINE, background: 'rgba(0,0,0,0.015)' }}>
                                <th className="px-5 py-3 text-left text-[10px] font-[600] uppercase tracking-[0.09em] text-gray-400 w-[80px]">Code</th>
                                <th className="px-5 py-3 text-left text-[10px] font-[600] uppercase tracking-[0.09em] text-gray-400">Account Name</th>
                                <th className="px-5 py-3 text-right text-[10px] font-[600] uppercase tracking-[0.09em] text-rose-500 w-[150px]">Debit</th>
                                <th className="px-5 py-3 text-right text-[10px] font-[600] uppercase tracking-[0.09em] text-emerald-600 w-[150px]">Credit</th>
                                <th className="px-5 py-3 text-right text-[10px] font-[600] uppercase tracking-[0.09em] text-gray-400 w-[150px]">Balance</th>
                            </tr>
                        </thead>

                        <tbody>
                            {TYPE_ORDER.map(type => {
                                const group = byType[type];
                                if (!group || group.length === 0) return null;
                                const meta = TYPE_META[type];
                                const groupDr = group.reduce((s, r) => s + r.debit, 0);
                                const groupCr = group.reduce((s, r) => s + r.credit, 0);
                                const groupBal = group.reduce((s, r) => s + r.balance, 0);

                                return (
                                    <>
                                        {/* Section header */}
                                        <tr key={`hdr-${type}`} style={{ background: meta.bg }}>
                                            <td colSpan={5} className="px-5 py-2">
                                                <div className="flex items-center gap-2">
                                                    <span className="w-[5px] h-[5px] rounded-full shrink-0"
                                                        style={{ background: meta.dot }} />
                                                    <span className="text-[10px] font-[700] uppercase tracking-[0.1em]"
                                                        style={{ color: meta.color }}>
                                                        {meta.label}
                                                    </span>
                                                    <span className="text-[10px] text-gray-400 font-[400]">
                                                        · {group.length} account{group.length !== 1 ? 's' : ''}
                                                    </span>
                                                </div>
                                            </td>
                                        </tr>

                                        {/* Account rows */}
                                        {group.map((row, i) => (
                                            <tr key={row.code}
                                                className="hover:bg-gray-50/40 transition-colors"
                                                style={{ borderBottom: i < group.length - 1 ? '1px solid rgba(0,0,0,0.04)' : HAIRLINE }}>
                                                <td className="px-5 py-3 font-mono text-[11px] text-gray-400">{row.code}</td>
                                                <td className="px-5 py-3">
                                                    <span className="text-[12.5px] font-[500] text-gray-900">{row.name}</span>
                                                    {row.subtype && (
                                                        <span className="ml-2 text-[10px] font-[500] text-gray-400 uppercase tracking-[0.06em]">
                                                            {row.subtype.replace(/_/g, ' ')}
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-5 py-3 text-right tabular-nums">
                                                    {row.debit > 0
                                                        ? <span className="text-[12.5px] font-[500] text-gray-700 font-mono">{fmt(row.debit)}</span>
                                                        : <span className="text-[12px] text-gray-200">—</span>}
                                                </td>
                                                <td className="px-5 py-3 text-right tabular-nums">
                                                    {row.credit > 0
                                                        ? <span className="text-[12.5px] font-[500] text-gray-700 font-mono">{fmt(row.credit)}</span>
                                                        : <span className="text-[12px] text-gray-200">—</span>}
                                                </td>
                                                <td className="px-5 py-3 text-right tabular-nums">
                                                    <div className="flex items-center justify-end gap-1.5">
                                                        <span className="text-[12.5px] font-[600] text-gray-900 font-mono">{fmt(row.balance)}</span>
                                                        <span className="text-[9px] font-[600] uppercase"
                                                            style={{ color: row.balanceSide === 'DR' ? '#e11d48' : '#059669' }}>
                                                            {row.balanceSide}
                                                        </span>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}

                                        {/* Section subtotal */}
                                        <tr key={`sub-${type}`} style={{ background: meta.bg }}>
                                            <td colSpan={2} className="px-5 py-2.5">
                                                <span className="text-[10.5px] font-[600] uppercase tracking-[0.07em]"
                                                    style={{ color: meta.color }}>
                                                    {meta.label} Subtotal
                                                </span>
                                            </td>
                                            <td className="px-5 py-2.5 text-right tabular-nums">
                                                <span className="text-[12px] font-[700] text-gray-900 font-mono">{fmt(groupDr)}</span>
                                            </td>
                                            <td className="px-5 py-2.5 text-right tabular-nums">
                                                <span className="text-[12px] font-[700] text-gray-900 font-mono">{fmt(groupCr)}</span>
                                            </td>
                                            <td className="px-5 py-2.5 text-right tabular-nums">
                                                <span className="text-[12px] font-[700] font-mono"
                                                    style={{ color: meta.color }}>{fmt(groupBal)}</span>
                                            </td>
                                        </tr>
                                    </>
                                );
                            })}
                        </tbody>

                        {/* Grand total */}
                        <tfoot>
                            <tr style={{ borderTop: '2px solid rgba(0,0,0,0.1)', background: 'rgba(0,0,0,0.02)' }}>
                                <td colSpan={2} className="px-5 py-4">
                                    <span className="text-[11px] font-[700] uppercase tracking-[0.09em] text-gray-500">Grand Total</span>
                                </td>
                                <td className="px-5 py-4 text-right tabular-nums">
                                    <span className="text-[13px] font-[700] text-rose-600 font-mono">{fmt(totalDebits)}</span>
                                </td>
                                <td className="px-5 py-4 text-right tabular-nums">
                                    <span className="text-[13px] font-[700] text-emerald-600 font-mono">{fmt(totalCredits)}</span>
                                </td>
                                <td className="px-5 py-4 text-right tabular-nums">
                                    {isBalanced ? (
                                        <span className="inline-flex items-center gap-1 text-[11px] font-[600] text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                                            <PiCheckCircle className="text-[12px]" /> Balanced
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center gap-1 text-[11px] font-[600] text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full">
                                            <PiWarningCircle className="text-[12px]" /> {fmt(diff)} off
                                        </span>
                                    )}
                                </td>
                            </tr>
                        </tfoot>
                    </table>
                </div>

                {rows.length === 0 && (
                    <div className="py-20 flex flex-col items-center gap-3">
                        <div className="w-10 h-10 rounded-[8px] bg-gray-50 flex items-center justify-center" style={{ border: HAIRLINE }}>
                            <PiScales className="text-gray-300 text-[18px]" />
                        </div>
                        <p className="text-[13px] font-[500] text-gray-900">No posted journal entries</p>
                        <p className="text-[12px] text-gray-400">Post journal entries to see the trial balance.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
