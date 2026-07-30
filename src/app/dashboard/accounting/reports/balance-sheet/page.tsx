import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import prisma from '@/lib/prisma';
import {
    PiCheckCircle, PiWarningCircle,
    PiBuildings, PiHandCoins, PiScales,
} from 'react-icons/pi';
import { ReportExportButton } from '@/components/accounting/ReportExportButton';
import type { ReportExportData } from '@/components/accounting/ReportExportButton';

const HAIRLINE = '1px solid rgba(0,0,0,0.07)';

function fmt(n: number) {
    return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

type AccountRow = { code: string; name: string; type: string; subtype: string | null; balance: number };

function Section({
    label, accounts, total, totalLabel, accent, bg, icon, emptyText,
}: {
    label: string;
    accounts: AccountRow[];
    total: number;
    totalLabel: string;
    accent: string;
    bg: string;
    icon: React.ReactNode;
    emptyText: string;
    extra?: React.ReactNode;
}) {
    return (
        <div className="bg-white rounded-[8px] overflow-hidden" style={{ border: HAIRLINE }}>
            {/* Section header */}
            <div className="flex items-center gap-2.5 px-5 py-3" style={{ background: bg, borderBottom: HAIRLINE }}>
                <div className="w-[26px] h-[26px] rounded-[6px] flex items-center justify-center shrink-0"
                    style={{ background: accent }}>
                    <span className="text-white">{icon}</span>
                </div>
                <p className="text-[12.5px] font-[600]" style={{ color: accent }}>{label}</p>
                <span className="ml-auto text-[11px] font-[500] text-gray-400">
                    {accounts.length} account{accounts.length !== 1 ? 's' : ''}
                </span>
            </div>

            {/* Rows */}
            {accounts.length === 0 ? (
                <div className="px-5 py-5">
                    <p className="text-[12px] text-gray-400 italic">{emptyText}</p>
                </div>
            ) : (
                accounts.map((acc, i) => (
                    <div key={acc.code}
                        className="flex items-center gap-4 px-5 py-3 hover:bg-gray-50/40 transition-colors"
                        style={i > 0 ? { borderTop: HAIRLINE } : {}}>
                        <span className="text-[11px] font-mono text-gray-400 w-[44px] shrink-0">{acc.code}</span>
                        <div className="flex-1 min-w-0">
                            <p className="text-[12.5px] font-[500] text-gray-900 truncate">{acc.name}</p>
                            {acc.subtype && (
                                <p className="text-[10px] font-[500] uppercase tracking-[0.06em] text-gray-400">
                                    {acc.subtype.replace(/_/g, ' ')}
                                </p>
                            )}
                        </div>
                        <span className="text-[12.5px] font-[500] font-mono tabular-nums text-gray-700 shrink-0">
                            {fmt(acc.balance)}
                        </span>
                    </div>
                ))
            )}

            {/* Total row */}
            <div className="flex items-center justify-between px-5 py-3"
                style={{ borderTop: HAIRLINE, background: 'rgba(0,0,0,0.015)' }}>
                <p className="text-[10.5px] font-[700] uppercase tracking-[0.09em]" style={{ color: accent }}>
                    {totalLabel}
                </p>
                <p className="text-[13px] font-[700] font-mono tabular-nums" style={{ color: accent }}>
                    {fmt(total)}
                </p>
            </div>
        </div>
    );
}

export default async function BalanceSheetPage() {
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

    const accountBalances: AccountRow[] = accounts.map(acc => {
        const dr = acc.journalLines.reduce((s, l) => s + l.debit, 0);
        const cr = acc.journalLines.reduce((s, l) => s + l.credit, 0);
        const isDebitNormal = acc.type === 'ASSET' || acc.type === 'EXPENSE';
        return {
            code: acc.code,
            name: acc.name,
            type: acc.type,
            subtype: acc.subtype,
            balance: isDebitNormal ? dr - cr : cr - dr,
        };
    });

    const assets      = accountBalances.filter(a => a.type === 'ASSET'     && a.balance !== 0);
    const liabilities = accountBalances.filter(a => a.type === 'LIABILITY' && a.balance !== 0);
    const equityAccts = accountBalances.filter(a => a.type === 'EQUITY'    && a.balance !== 0);

    const revenues    = accountBalances.filter(a => a.type === 'REVENUE');
    const expenses    = accountBalances.filter(a => a.type === 'EXPENSE');
    const netIncome   = revenues.reduce((s, a) => s + a.balance, 0)
                      - expenses.reduce((s, a) => s + a.balance, 0);

    const totalAssets      = assets.reduce((s, a) => s + a.balance, 0);
    const totalLiabilities = liabilities.reduce((s, a) => s + a.balance, 0);
    const totalEquity      = equityAccts.reduce((s, a) => s + a.balance, 0);
    const totalEquityFull  = totalEquity + netIncome;
    const totalLiabEquity  = totalLiabilities + totalEquityFull;
    const isBalanced       = Math.abs(totalAssets - totalLiabEquity) < 0.01;
    const diff             = Math.abs(totalAssets - totalLiabEquity);

    const asOf = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

    const exportData: ReportExportData = {
        title: 'Balance Sheet',
        subtitle: `Statement of Financial Position · As at ${asOf}`,
        company: 'Company',
        currency: 'KES',
        sections: [
            {
                title: 'Assets',
                lines: [
                    ...assets.map(a => ({ code: a.code, name: a.name, current: a.balance, indent: true as const })),
                    { name: 'Total Assets', current: totalAssets, isBold: true, isGrandTotal: true },
                ],
            },
            {
                title: 'Liabilities',
                lines: [
                    ...liabilities.map(a => ({ code: a.code, name: a.name, current: a.balance, indent: true as const })),
                    { name: 'Total Liabilities', current: totalLiabilities, isBold: true, isSubtotal: true },
                ],
            },
            {
                title: 'Equity',
                lines: [
                    ...equityAccts.map(a => ({ code: a.code, name: a.name, current: a.balance, indent: true as const })),
                    { name: 'Net Income', current: netIncome, indent: true },
                    { name: 'Total Equity', current: totalEquityFull, isBold: true, isSubtotal: true },
                    { spacer: true, name: '', current: 0 },
                    { name: 'Total Liabilities & Equity', current: totalLiabEquity, isBold: true, isGrandTotal: true },
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
                        <h1 className="text-[19px] font-[600] text-gray-900 tracking-tight">Balance Sheet</h1>
                    </div>
                    <p className="text-[12px] text-gray-400 pl-[38px]">Statement of financial position as at {asOf}</p>
                </div>
                <ReportExportButton data={exportData} />
            </div>

            {/* ── KPI strip ── */}
            <div className="grid grid-cols-4 gap-3">
                {[
                    { label: 'Total Assets',      value: totalAssets,      color: '#059669', bg: 'rgba(5,150,105,0.06)'  },
                    { label: 'Total Liabilities', value: totalLiabilities, color: '#e11d48', bg: 'rgba(225,29,72,0.06)'  },
                    { label: 'Total Equity',       value: totalEquityFull,  color: '#6366F1', bg: 'rgba(99,102,241,0.06)' },
                    { label: 'Net Income',         value: netIncome,        color: netIncome >= 0 ? '#059669' : '#e11d48',
                      bg: netIncome >= 0 ? 'rgba(5,150,105,0.06)' : 'rgba(225,29,72,0.06)' },
                ].map(k => (
                    <div key={k.label} className="bg-white rounded-[8px] px-5 py-4" style={{ border: HAIRLINE }}>
                        <p className="text-[10px] font-[600] uppercase tracking-[0.09em] text-gray-400 mb-2">{k.label}</p>
                        <p className="text-[18px] font-[700] font-mono tabular-nums leading-none" style={{ color: k.color }}>
                            {fmt(k.value)}
                        </p>
                        <p className="text-[10.5px] text-gray-400 mt-1">KES</p>
                    </div>
                ))}
            </div>

            {/* ── Accounting equation check ── */}
            <div className="bg-white rounded-[8px] px-5 py-3.5 flex items-center justify-between"
                style={{ border: isBalanced ? '1px solid rgba(5,150,105,0.25)' : '1px solid rgba(225,29,72,0.25)' }}>
                <div className="flex items-center gap-2">
                    {isBalanced
                        ? <PiCheckCircle className="text-emerald-500 text-[16px]" />
                        : <PiWarningCircle className="text-rose-500 text-[16px]" />
                    }
                    <p className={`text-[12.5px] font-[600] ${isBalanced ? 'text-emerald-700' : 'text-rose-700'}`}>
                        {isBalanced ? 'Accounting equation balanced' : `Out of balance by KES ${fmt(diff)}`}
                    </p>
                    <span className="text-[11.5px] text-gray-400 ml-1">
                        Assets ({fmt(totalAssets)}) = Liabilities ({fmt(totalLiabilities)}) + Equity ({fmt(totalEquityFull)})
                    </span>
                </div>
                <span className={`text-[11px] font-[600] px-2.5 py-1 rounded-full ${isBalanced ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                    {isBalanced ? 'A = L + E ✓' : 'A ≠ L + E'}
                </span>
            </div>

            {/* ── Two-column layout ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">

                {/* Left: Assets */}
                <Section
                    label="Assets"
                    accounts={assets}
                    total={totalAssets}
                    totalLabel="Total Assets"
                    accent="#059669"
                    bg="rgba(5,150,105,0.06)"
                    icon={<PiBuildings className="text-[14px]" />}
                    emptyText="No asset accounts with posted entries"
                />

                {/* Right: Liabilities + Equity stacked */}
                <div className="space-y-4">
                    <Section
                        label="Liabilities"
                        accounts={liabilities}
                        total={totalLiabilities}
                        totalLabel="Total Liabilities"
                        accent="#e11d48"
                        bg="rgba(225,29,72,0.06)"
                        icon={<PiHandCoins className="text-[14px]" />}
                        emptyText="No liability accounts with posted entries"
                    />

                    {/* Equity — custom to include net income row */}
                    <div className="bg-white rounded-[8px] overflow-hidden" style={{ border: HAIRLINE }}>
                        {/* Header */}
                        <div className="flex items-center gap-2.5 px-5 py-3"
                            style={{ background: 'rgba(99,102,241,0.06)', borderBottom: HAIRLINE }}>
                            <div className="w-[26px] h-[26px] rounded-[6px] bg-[#6366F1] flex items-center justify-center shrink-0">
                                <PiScales className="text-white text-[13px]" />
                            </div>
                            <p className="text-[12.5px] font-[600] text-[#6366F1]">Equity</p>
                            <span className="ml-auto text-[11px] font-[500] text-gray-400">
                                {equityAccts.length + 1} account{equityAccts.length + 1 !== 1 ? 's' : ''}
                            </span>
                        </div>

                        {/* Equity account rows */}
                        {equityAccts.length === 0 && (
                            <div className="px-5 py-4" style={{ borderBottom: HAIRLINE }}>
                                <p className="text-[12px] text-gray-400 italic">No equity accounts with posted entries</p>
                            </div>
                        )}
                        {equityAccts.map((acc, i) => (
                            <div key={acc.code}
                                className="flex items-center gap-4 px-5 py-3 hover:bg-gray-50/40 transition-colors"
                                style={i > 0 ? { borderTop: HAIRLINE } : {}}>
                                <span className="text-[11px] font-mono text-gray-400 w-[44px] shrink-0">{acc.code}</span>
                                <div className="flex-1 min-w-0">
                                    <p className="text-[12.5px] font-[500] text-gray-900 truncate">{acc.name}</p>
                                    {acc.subtype && (
                                        <p className="text-[10px] font-[500] uppercase tracking-[0.06em] text-gray-400">
                                            {acc.subtype.replace(/_/g, ' ')}
                                        </p>
                                    )}
                                </div>
                                <span className="text-[12.5px] font-[500] font-mono tabular-nums text-gray-700 shrink-0">
                                    {fmt(acc.balance)}
                                </span>
                            </div>
                        ))}

                        {/* Net income row */}
                        <div className="flex items-center gap-4 px-5 py-3"
                            style={{ borderTop: HAIRLINE, background: 'rgba(99,102,241,0.04)' }}>
                            <span className="text-[11px] font-mono text-gray-300 w-[44px] shrink-0">—</span>
                            <div className="flex-1 min-w-0">
                                <p className="text-[12.5px] font-[500] text-gray-900">Net Income (Current Period)</p>
                                <p className="text-[10px] font-[500] uppercase tracking-[0.06em] text-[#6366F1]">
                                    Retained Earnings
                                </p>
                            </div>
                            <span className={`text-[12.5px] font-[600] font-mono tabular-nums shrink-0 ${netIncome >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                {netIncome >= 0 ? '' : '('}{fmt(netIncome)}{netIncome < 0 ? ')' : ''}
                            </span>
                        </div>

                        {/* Total equity */}
                        <div className="flex items-center justify-between px-5 py-3"
                            style={{ borderTop: HAIRLINE, background: 'rgba(0,0,0,0.015)' }}>
                            <p className="text-[10.5px] font-[700] uppercase tracking-[0.09em] text-[#6366F1]">
                                Total Equity
                            </p>
                            <p className="text-[13px] font-[700] font-mono tabular-nums text-[#6366F1]">
                                {fmt(totalEquityFull)}
                            </p>
                        </div>
                    </div>

                    {/* Liabilities + Equity combined total */}
                    <div className="bg-white rounded-[8px] px-5 py-4 flex items-center justify-between"
                        style={{ border: HAIRLINE }}>
                        <div>
                            <p className="text-[10px] font-[600] uppercase tracking-[0.09em] text-gray-400">
                                Total Liabilities &amp; Equity
                            </p>
                            <p className="text-[11px] text-gray-400 mt-0.5">Must equal Total Assets</p>
                        </div>
                        <div className="text-right">
                            <p className="text-[20px] font-[800] font-mono tabular-nums text-gray-900">
                                {fmt(totalLiabEquity)}
                            </p>
                            <p className="text-[10px] font-[600] uppercase tracking-[0.07em] text-gray-400 mt-0.5">KES</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
