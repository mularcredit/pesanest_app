import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import prisma from '@/lib/prisma';
import { PiChartBar, PiInfo } from 'react-icons/pi';
import { ReportExportButton } from '@/components/accounting/ReportExportButton';
import type { ReportExportData } from '@/components/accounting/ReportExportButton';
import { DateRangeBar } from './DateRangeBar';

// ── helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number) {
    return new Intl.NumberFormat('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Math.abs(n));
}

function pct(n: number, base: number) {
    if (!base) return '—';
    return (Math.abs(n / base) * 100).toFixed(1) + '%';
}

// Map account subtype → P&L section
function classifyExpense(subtype: string | null): 'cogs' | 'operating' | 'finance' | 'tax' {
    const s = (subtype ?? '').toUpperCase();
    if (['COST_OF_SALES', 'COGS', 'COST_OF_GOODS_SOLD', 'COST_OF_REVENUE', 'DIRECT_COST', 'DIRECT_EXPENSE'].includes(s)) return 'cogs';
    if (['FINANCE_COST', 'INTEREST', 'INTEREST_EXPENSE', 'BORROWING_COST', 'FINANCE_EXPENSE'].includes(s)) return 'finance';
    if (['INCOME_TAX', 'TAX_EXPENSE', 'CORPORATION_TAX', 'DEFERRED_TAX'].includes(s)) return 'tax';
    return 'operating';
}

function classifyRevenue(subtype: string | null): 'revenue' | 'other_income' {
    const s = (subtype ?? '').toUpperCase();
    if (['OTHER_INCOME', 'INTEREST_INCOME', 'FINANCE_INCOME', 'GAIN', 'DIVIDEND_INCOME'].includes(s)) return 'other_income';
    return 'revenue';
}

// Shift dates to include full day (to = end of day)
function dateRange(from?: string, to?: string) {
    const where: any = {};
    if (from) where.gte = new Date(from + 'T00:00:00.000Z');
    if (to)   where.lte = new Date(to   + 'T23:59:59.999Z');
    return Object.keys(where).length ? where : undefined;
}

// ── data fetch ────────────────────────────────────────────────────────────────

async function fetchPL(from?: string, to?: string) {
    const entryDateFilter = dateRange(from, to);

    const accounts = await prisma.account.findMany({
        where: {
            isActive: true,
            isArchived: false,
            type: { in: ['REVENUE', 'CONTRA_REVENUE', 'EXPENSE', 'OTHER_INCOME', 'OTHER_EXPENSE'] },
        },
        include: {
            journalLines: {
                where: {
                    entry: {
                        status: 'POSTED',
                        ...(entryDateFilter ? { date: entryDateFilter } : {}),
                    },
                },
                select: { debit: true, credit: true },
            },
        },
        orderBy: { code: 'asc' },
    });

    type Line = { code: string; name: string; balance: number; subtype: string | null };

    const lines: Line[] = accounts.map(acc => {
        const dr = acc.journalLines.reduce((s, l) => s + l.debit, 0);
        const cr = acc.journalLines.reduce((s, l) => s + l.credit, 0);
        const isDebitNormal = acc.type === 'EXPENSE' || acc.type === 'OTHER_EXPENSE';
        const balance = isDebitNormal ? dr - cr : cr - dr;
        return { code: acc.code, name: acc.name, balance, subtype: acc.subtype ?? null };
    }).filter(l => l.balance !== 0);

    // Revenue
    const revenue      = lines.filter(l => l.balance !== 0 && accounts.find(a => a.code === l.code)?.type === 'REVENUE' && classifyRevenue(l.subtype) === 'revenue');
    const contraRev    = lines.filter(l => accounts.find(a => a.code === l.code)?.type === 'CONTRA_REVENUE');
    const otherIncome  = lines.filter(l => {
        const acc = accounts.find(a => a.code === l.code);
        return acc && (acc.type === 'OTHER_INCOME' || (acc.type === 'REVENUE' && classifyRevenue(l.subtype) === 'other_income'));
    });

    // Expenses by section
    const expLines = lines.filter(l => {
        const acc = accounts.find(a => a.code === l.code);
        return acc && (acc.type === 'EXPENSE' || acc.type === 'OTHER_EXPENSE');
    });
    const cogs      = expLines.filter(l => classifyExpense(l.subtype) === 'cogs');
    const operating = expLines.filter(l => classifyExpense(l.subtype) === 'operating');
    const finance   = expLines.filter(l => classifyExpense(l.subtype) === 'finance');
    const tax       = expLines.filter(l => classifyExpense(l.subtype) === 'tax');

    const totalRevenue    = revenue.reduce((s, l) => s + l.balance, 0);
    const totalContra     = contraRev.reduce((s, l) => s + l.balance, 0);
    const netRevenue      = totalRevenue - totalContra;
    const totalCogs       = cogs.reduce((s, l) => s + l.balance, 0);
    const grossProfit     = netRevenue - totalCogs;
    const totalOtherInc   = otherIncome.reduce((s, l) => s + l.balance, 0);
    const totalOperating  = operating.reduce((s, l) => s + l.balance, 0);
    const ebit            = grossProfit + totalOtherInc - totalOperating;
    const totalFinance    = finance.reduce((s, l) => s + l.balance, 0);
    const pbt             = ebit - totalFinance;
    const totalTax        = tax.reduce((s, l) => s + l.balance, 0);
    const netProfit       = pbt - totalTax;

    return {
        revenue, contraRev, otherIncome,
        cogs, operating, finance, tax,
        totalRevenue, totalContra, netRevenue,
        totalCogs, grossProfit,
        totalOtherInc, totalOperating, ebit,
        totalFinance, pbt, totalTax, netProfit,
    };
}

// ── sub-components ────────────────────────────────────────────────────────────

const HAIRLINE = '1px solid rgba(0,0,0,0.07)';

function SectionHeader({ title, count, color }: { title: string; count: number; color: string }) {
    return (
        <div className="flex items-center justify-between px-5 py-2.5"
            style={{ background: `${color}08`, borderBottom: HAIRLINE }}>
            <p className="text-[10.5px] font-[700] uppercase tracking-[0.1em]" style={{ color }}>{title}</p>
            <span className="text-[10px] text-gray-400">{count} account{count !== 1 ? 's' : ''}</span>
        </div>
    );
}

function AccountRow({ code, name, balance, negative, prior }: {
    code: string; name: string; balance: number; negative?: boolean; prior?: number;
}) {
    const display = negative ? `(${fmt(balance)})` : fmt(balance);
    return (
        <div className="flex items-center gap-3 px-5 py-2.5 hover:bg-gray-50/60 transition-colors text-[12.5px]"
            style={{ borderBottom: HAIRLINE }}>
            <span className="font-mono text-[10.5px] text-gray-300 w-[44px] shrink-0">{code}</span>
            <span className="flex-1 text-gray-700 truncate">{name}</span>
            {prior !== undefined && (
                <span className="w-[100px] text-right font-mono tabular-nums text-gray-300 shrink-0 text-[12px]">
                    {prior === 0 ? '—' : (negative ? `(${fmt(prior)})` : fmt(prior))}
                </span>
            )}
            <span className={`w-[110px] text-right font-mono tabular-nums shrink-0 font-[500] ${negative ? 'text-gray-600' : 'text-gray-800'}`}>
                {display}
            </span>
        </div>
    );
}

function SubtotalRow({ label, value, color, bold, large, prior, netRevenue }: {
    label: string; value: number; color: string; bold?: boolean; large?: boolean; prior?: number; netRevenue?: number;
}) {
    const neg = value < 0;
    return (
        <div className="flex items-center gap-3 px-5 py-3"
            style={{ borderTop: HAIRLINE, background: 'rgba(0,0,0,0.02)' }}>
            <span className="w-[44px] shrink-0" />
            <span className={`flex-1 text-[${large ? '13' : '12'}px] ${bold ? 'font-[700]' : 'font-[600]'} uppercase tracking-[0.06em]`}
                style={{ color }}>
                {label}
            </span>
            {netRevenue !== undefined && (
                <span className="text-[10.5px] font-[500] px-2 py-0.5 rounded-full mr-2"
                    style={{ background: `${color}12`, color }}>
                    {pct(value, netRevenue)} of revenue
                </span>
            )}
            {prior !== undefined && (
                <span className="w-[100px] text-right font-mono tabular-nums text-gray-400 shrink-0 text-[12px]">
                    {prior === 0 ? '—' : (prior < 0 ? `(${fmt(prior)})` : fmt(prior))}
                </span>
            )}
            <span className={`w-[110px] text-right font-mono tabular-nums shrink-0 font-[700] ${large ? 'text-[15px]' : 'text-[13px]'}`}
                style={{ color }}>
                {neg ? `(${fmt(value)})` : fmt(value)}
            </span>
        </div>
    );
}

function EmptySection({ msg }: { msg: string }) {
    return (
        <div className="px-5 py-3 text-[11.5px] text-gray-400 italic" style={{ borderBottom: HAIRLINE }}>
            {msg}
        </div>
    );
}

// ── page ──────────────────────────────────────────────────────────────────────

export default async function IncomeStatementPage({
    searchParams,
}: {
    searchParams: Promise<{ from?: string; to?: string; compare?: string }>;
}) {
    const session = await auth();
    if (!session?.user) return redirect('/login');

    const { from, to, compare } = await searchParams;
    const showCompare = compare === '1';

    const [current, prior] = await Promise.all([
        fetchPL(from, to),
        showCompare ? fetchPL(
            from && to ? shiftPeriod(from, to).from : undefined,
            from && to ? shiftPeriod(from, to).to   : undefined,
        ) : Promise.resolve(null),
    ]);

    const pl = current;

    // Period label
    const periodLabel = !from && !to
        ? 'All time'
        : from && to
        ? `${new Date(from).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} – ${new Date(to).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`
        : from ? `From ${from}` : `To ${to}`;

    const hasCogs       = pl.cogs.length > 0;
    const hasFinance    = pl.finance.length > 0;
    const hasTax        = pl.tax.length > 0;
    const hasOtherInc   = pl.otherIncome.length > 0;
    const missingCogs   = !hasCogs && pl.netRevenue > 0;

    const COLORS = {
        revenue:   '#059669',
        contra:    '#d97706',
        gross:     '#0284c7',
        operating: '#6366f1',
        ebit:      '#7c3aed',
        finance:   '#dc2626',
        pbt:       '#0369a1',
        tax:       '#9333ea',
        net:       pl.netProfit >= 0 ? '#059669' : '#dc2626',
    };

    const exportData: ReportExportData = {
        title: 'Income Statement',
        subtitle: `Profit & Loss · ${periodLabel}`,
        company: 'Company',
        showPrior: showCompare,
        currency: 'KES',
        sections: [
            {
                title: 'Revenue',
                lines: [
                    ...pl.revenue.map(l => ({ code: l.code, name: l.name, current: l.balance, prior: showCompare ? (prior?.revenue.find(x => x.code === l.code)?.balance ?? 0) : undefined })),
                    ...pl.contraRev.map(l => ({ code: l.code, name: l.name, current: l.balance, isNegative: true as const, indent: true as const, prior: showCompare ? (prior?.contraRev.find(x => x.code === l.code)?.balance ?? 0) : undefined })),
                    { name: 'Net Revenue', current: pl.netRevenue, isBold: true, isSubtotal: true, prior: showCompare && prior ? prior.netRevenue : undefined },
                ],
            },
            {
                title: 'Cost of Sales',
                lines: [
                    ...pl.cogs.map(l => ({ code: l.code, name: l.name, current: l.balance, isNegative: true as const, indent: true as const, prior: showCompare ? (prior?.cogs.find(x => x.code === l.code)?.balance ?? 0) : undefined })),
                    { name: 'Gross Profit', current: pl.grossProfit, isBold: true, isSubtotal: true, prior: showCompare && prior ? prior.grossProfit : undefined },
                ],
            },
            ...(pl.otherIncome.length > 0 ? [{ title: 'Other Income', lines: pl.otherIncome.map(l => ({ code: l.code, name: l.name, current: l.balance, prior: showCompare ? (prior?.otherIncome.find(x => x.code === l.code)?.balance ?? 0) : undefined })) }] : []),
            {
                title: 'Operating Expenses',
                lines: [
                    ...pl.operating.map(l => ({ code: l.code, name: l.name, current: l.balance, isNegative: true as const, indent: true as const, prior: showCompare ? (prior?.operating.find(x => x.code === l.code)?.balance ?? 0) : undefined })),
                    { name: 'Operating Profit (EBIT)', current: pl.ebit, isBold: true, isSubtotal: true, prior: showCompare && prior ? prior.ebit : undefined },
                ],
            },
            {
                title: 'Finance Costs',
                lines: [
                    ...pl.finance.map(l => ({ code: l.code, name: l.name, current: l.balance, isNegative: true as const, indent: true as const, prior: showCompare ? (prior?.finance.find(x => x.code === l.code)?.balance ?? 0) : undefined })),
                    { name: 'Profit Before Tax (PBT)', current: pl.pbt, isBold: true, isSubtotal: true, prior: showCompare && prior ? prior.pbt : undefined },
                ],
            },
            {
                title: 'Income Tax',
                lines: [
                    ...pl.tax.map(l => ({ code: l.code, name: l.name, current: l.balance, isNegative: true as const, indent: true as const, prior: showCompare ? (prior?.tax.find(x => x.code === l.code)?.balance ?? 0) : undefined })),
                    { name: 'Net Profit for the Period', current: pl.netProfit, isBold: true, isGrandTotal: true, prior: showCompare && prior ? prior.netProfit : undefined },
                ],
            },
        ],
    };

    return (
        <div className="pb-20 space-y-5 max-w-[960px]">

            {/* ── Page header ── */}
            <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <div className="w-[30px] h-[30px] rounded-[7px] bg-[#6366F1] flex items-center justify-center shrink-0">
                            <PiChartBar className="text-white text-[15px]" />
                        </div>
                        <h1 className="text-[19px] font-[600] text-gray-900 tracking-tight">Income Statement</h1>
                        <span className="text-[11px] font-[500] px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 border border-indigo-100">
                            IFRS
                        </span>
                    </div>
                    <p className="text-[12px] text-gray-400 pl-[38px]">Profit & Loss · {periodLabel}</p>
                </div>
                <ReportExportButton data={exportData} />
            </div>

            {/* ── Date range bar ── */}
            <Suspense>
                <DateRangeBar />
            </Suspense>

            {/* ── KPI strip ── */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                    { label: 'Net Revenue',    value: pl.netRevenue,   color: COLORS.revenue,  sub: `${pct(pl.netRevenue, pl.totalRevenue)} of gross` },
                    { label: 'Gross Profit',   value: pl.grossProfit,  color: COLORS.gross,    sub: `${pct(pl.grossProfit, pl.netRevenue)} GP margin` },
                    { label: 'Operating Profit (EBIT)', value: pl.ebit, color: COLORS.ebit,    sub: `${pct(pl.ebit, pl.netRevenue)} EBIT margin` },
                    { label: 'Net Profit',     value: pl.netProfit,    color: COLORS.net,      sub: `${pct(pl.netProfit, pl.netRevenue)} net margin` },
                ].map(k => (
                    <div key={k.label} className="bg-white rounded-[10px] px-5 py-4" style={{ border: HAIRLINE }}>
                        <p className="text-[10px] font-[600] uppercase tracking-[0.09em] text-gray-400 mb-2">{k.label}</p>
                        <p className={`text-[18px] font-[800] font-mono tabular-nums leading-none ${k.value < 0 ? 'text-rose-600' : ''}`}
                            style={{ color: k.value < 0 ? '#dc2626' : k.color }}>
                            {k.value < 0 ? `(${fmt(k.value)})` : fmt(k.value)}
                        </p>
                        <p className="text-[10.5px] text-gray-400 mt-1">{k.sub}</p>
                    </div>
                ))}
            </div>

            {/* ── Missing COGS notice ── */}
            {missingCogs && (
                <div className="flex items-start gap-2.5 px-4 py-3 bg-amber-50 border border-amber-200 rounded-[8px] text-[12px] text-amber-800">
                    <PiInfo className="text-[16px] text-amber-600 mt-0.5 shrink-0" />
                    <div>
                        <p className="font-[600]">No Cost of Sales accounts found — Gross Profit equals Net Revenue</p>
                        <p className="text-amber-700 mt-0.5">To separate COGS: in Chart of Accounts, set the <span className="font-mono bg-amber-100 px-1 rounded">subtype</span> of cost accounts to <span className="font-mono bg-amber-100 px-1 rounded">COST_OF_SALES</span>.</p>
                    </div>
                </div>
            )}

            {/* ── Statement table ── */}
            <div className="bg-white rounded-[10px] overflow-hidden" style={{ border: HAIRLINE }}>

                {/* Column headers */}
                <div className="flex items-center gap-3 px-5 py-3 bg-gray-50 border-b border-gray-100">
                    <span className="w-[44px] shrink-0" />
                    <span className="flex-1 text-[10px] font-[600] uppercase tracking-[0.09em] text-gray-400">Account</span>
                    {showCompare && prior && (
                        <span className="w-[100px] text-right text-[10px] font-[600] uppercase tracking-[0.09em] text-gray-300 shrink-0">Prior period</span>
                    )}
                    <span className="w-[110px] text-right text-[10px] font-[600] uppercase tracking-[0.09em] text-gray-400 shrink-0">
                        {periodLabel === 'All time' ? 'All time' : 'KES'}
                    </span>
                </div>

                {/* ── 1. REVENUE ── */}
                <SectionHeader title="Revenue" count={pl.revenue.length + pl.contraRev.length} color={COLORS.revenue} />
                {pl.revenue.length === 0
                    ? <EmptySection msg="No revenue accounts with posted entries in this period" />
                    : pl.revenue.map(l => <AccountRow key={l.code} {...l}
                        prior={showCompare ? (prior?.revenue.find(x => x.code === l.code)?.balance ?? 0) : undefined} />)
                }
                {pl.contraRev.map(l => <AccountRow key={l.code} {...l} negative
                    prior={showCompare ? (prior?.contraRev.find(x => x.code === l.code)?.balance ?? 0) : undefined} />)
                }
                <SubtotalRow label="Net Revenue" value={pl.netRevenue} color={COLORS.revenue} bold
                    prior={showCompare && prior ? prior.netRevenue : undefined} />

                {/* ── 2. COST OF SALES ── */}
                <SectionHeader title="Cost of Sales" count={pl.cogs.length} color="#0284c7" />
                {pl.cogs.length === 0
                    ? <EmptySection msg="No cost of sales accounts — set subtype = COST_OF_SALES on direct cost accounts" />
                    : pl.cogs.map(l => <AccountRow key={l.code} {...l} negative
                        prior={showCompare ? (prior?.cogs.find(x => x.code === l.code)?.balance ?? 0) : undefined} />)
                }
                <SubtotalRow label="Gross Profit" value={pl.grossProfit} color={COLORS.gross} bold
                    netRevenue={pl.netRevenue}
                    prior={showCompare && prior ? prior.grossProfit : undefined} />

                {/* ── 3. OTHER INCOME ── */}
                {(hasOtherInc) && <>
                    <SectionHeader title="Other Income" count={pl.otherIncome.length} color="#0891b2" />
                    {pl.otherIncome.map(l => <AccountRow key={l.code} {...l}
                        prior={showCompare ? (prior?.otherIncome.find(x => x.code === l.code)?.balance ?? 0) : undefined} />)
                    }
                </>}

                {/* ── 4. OPERATING EXPENSES ── */}
                <SectionHeader title="Operating Expenses" count={pl.operating.length} color={COLORS.operating} />
                {pl.operating.length === 0
                    ? <EmptySection msg="No operating expense accounts with posted entries" />
                    : pl.operating.map(l => <AccountRow key={l.code} {...l} negative
                        prior={showCompare ? (prior?.operating.find(x => x.code === l.code)?.balance ?? 0) : undefined} />)
                }
                <SubtotalRow label="Operating Profit (EBIT)" value={pl.ebit} color={COLORS.ebit} bold large
                    netRevenue={pl.netRevenue}
                    prior={showCompare && prior ? prior.ebit : undefined} />

                {/* ── 5. FINANCE COSTS ── */}
                {(hasFinance || true) && <>
                    <SectionHeader title="Finance Costs" count={pl.finance.length} color={COLORS.finance} />
                    {pl.finance.length === 0
                        ? <EmptySection msg="No finance cost accounts — set subtype = FINANCE_COST on interest/borrowing accounts" />
                        : pl.finance.map(l => <AccountRow key={l.code} {...l} negative
                            prior={showCompare ? (prior?.finance.find(x => x.code === l.code)?.balance ?? 0) : undefined} />)
                    }
                </>}
                <SubtotalRow label="Profit Before Tax (PBT)" value={pl.pbt} color={COLORS.pbt} bold large
                    netRevenue={pl.netRevenue}
                    prior={showCompare && prior ? prior.pbt : undefined} />

                {/* ── 6. INCOME TAX ── */}
                <SectionHeader title="Income Tax" count={pl.tax.length} color={COLORS.tax} />
                {pl.tax.length === 0
                    ? <EmptySection msg="No income tax accounts — set subtype = INCOME_TAX on corporation tax accounts" />
                    : pl.tax.map(l => <AccountRow key={l.code} {...l} negative
                        prior={showCompare ? (prior?.tax.find(x => x.code === l.code)?.balance ?? 0) : undefined} />)
                }

                {/* ── NET PROFIT ── */}
                <div className="flex items-center gap-3 px-5 py-4"
                    style={{ borderTop: HAIRLINE, background: pl.netProfit >= 0 ? 'rgba(5,150,105,0.05)' : 'rgba(220,38,38,0.05)' }}>
                    <span className="w-[44px] shrink-0" />
                    <span className="flex-1 text-[14px] font-[800] uppercase tracking-[0.08em]" style={{ color: COLORS.net }}>
                        Net Profit for the Period
                    </span>
                    <span className="text-[11px] font-[500] px-2.5 py-1 rounded-full mr-1"
                        style={{ background: `${COLORS.net}15`, color: COLORS.net, border: `1px solid ${COLORS.net}30` }}>
                        {pct(pl.netProfit, pl.netRevenue)} margin
                    </span>
                    {showCompare && prior && (
                        <span className="w-[100px] text-right font-mono tabular-nums text-[13px] text-gray-400 shrink-0">
                            {prior.netProfit < 0 ? `(${fmt(prior.netProfit)})` : fmt(prior.netProfit)}
                        </span>
                    )}
                    <span className="w-[110px] text-right font-mono tabular-nums text-[17px] font-[800] shrink-0"
                        style={{ color: COLORS.net }}>
                        {pl.netProfit < 0 ? `(${fmt(pl.netProfit)})` : fmt(pl.netProfit)}
                    </span>
                </div>
            </div>

            {/* ── IFRS note ── */}
            <p className="text-[11px] text-gray-400 text-center">
                Prepared in accordance with IFRS · All amounts in KES · Figures rounded to 2 decimal places
            </p>
        </div>
    );
}

// Shift a date range back by one equal period for comparison
function shiftPeriod(from: string, to: string): { from: string; to: string } {
    const f = new Date(from), t = new Date(to);
    const days = Math.round((t.getTime() - f.getTime()) / 86400000) + 1;
    const nf = new Date(f); nf.setDate(nf.getDate() - days);
    const nt = new Date(t); nt.setDate(nt.getDate() - days);
    return {
        from: nf.toISOString().slice(0, 10),
        to:   nt.toISOString().slice(0, 10),
    };
}
