import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import prisma from '@/lib/prisma';
import { FinancialReports } from '@/lib/accounting/reports';
import { PiFileText, PiInfo } from 'react-icons/pi';
import { ReportExportButton } from '@/components/accounting/ReportExportButton';
import type { ReportExportData } from '@/components/accounting/ReportExportButton';
import { BrandLogo } from '@/components/ui/BrandLogo';
import { EditableImage } from '@/components/finance-studio/EditableImage';
import Link from 'next/link';

const HAIRLINE = '1px solid rgba(0,0,0,0.07)';

// Same "cash-like" subtypes used across bank reconciliation / transfers —
// a live snapshot of what the business actually has on hand right now,
// not a full cash-flow statement (see cash-flow/page.tsx for that).
const CASH_SUBTYPES = ['CURRENT_ASSET', 'CASH', 'CURRENT', 'PAYBILL', 'BANK'];

function fmt(n: number) {
    return new Intl.NumberFormat('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Math.abs(n));
}

function pct(n: number, base: number) {
    if (!base) return '—';
    return (Math.abs(n / base) * 100).toFixed(1) + '%';
}

const PRESETS = [
    { label: 'This month', key: 'this_month' },
    { label: 'Last month', key: 'last_month' },
    { label: 'This quarter', key: 'this_quarter' },
    { label: 'This year', key: 'this_year' },
] as const;

function fmtLocal(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function presetToDates(key: string, now: Date): { from: string; to: string } {
    const y = now.getFullYear(), m = now.getMonth();
    const q = Math.floor(m / 3);
    switch (key) {
        case 'last_month':   return { from: fmtLocal(new Date(y, m - 1, 1)),  to: fmtLocal(new Date(y, m, 0)) };
        case 'this_quarter': return { from: fmtLocal(new Date(y, q * 3, 1)),  to: fmtLocal(new Date(y, q * 3 + 3, 0)) };
        case 'this_year':    return { from: fmtLocal(new Date(y, 0, 1)),      to: fmtLocal(new Date(y, 11, 31)) };
        default:              return { from: fmtLocal(new Date(y, m, 1)),     to: fmtLocal(new Date(y, m + 1, 0)) };
    }
}

function SectionHeader({ title, color }: { title: string; color: string }) {
    return (
        <div className="px-5 py-2.5" style={{ background: `${color}08`, borderBottom: HAIRLINE }}>
            <p className="text-[10.5px] font-[700] uppercase tracking-[0.1em]" style={{ color }}>{title}</p>
        </div>
    );
}

function Row({ label, sub, value, negative, bold }: { label: string; sub?: string; value: number; negative?: boolean; bold?: boolean }) {
    return (
        <div className="flex items-center gap-3 px-5 py-2.5" style={{ borderBottom: HAIRLINE }}>
            <div className="flex-1 min-w-0">
                <p className={`text-[12.5px] text-gray-700 truncate ${bold ? 'font-[600]' : ''}`}>{label}</p>
                {sub && <p className="text-[10.5px] text-gray-400 mt-0.5">{sub}</p>}
            </div>
            <span className={`text-[12.5px] font-mono tabular-nums shrink-0 ${bold ? 'font-[700] text-gray-900' : 'font-[500] text-gray-800'}`}>
                {negative ? `(${fmt(value)})` : fmt(value)}
            </span>
        </div>
    );
}

function KpiBox({ label, value, color, sub }: { label: string; value: string; color?: string; sub?: string }) {
    return (
        <div className="bg-white rounded-[10px] px-5 py-4" style={{ border: HAIRLINE }}>
            <p className="text-[10px] font-[600] uppercase tracking-[0.09em] text-gray-400 mb-2">{label}</p>
            <p className="text-[18px] font-[700] font-mono tabular-nums leading-none" style={{ color: color ?? '#111827' }}>{value}</p>
            {sub && <p className="text-[10.5px] text-gray-400 mt-1">{sub}</p>}
        </div>
    );
}

async function getCashPosition(asOf: Date) {
    const accounts = await prisma.account.findMany({
        where: { type: 'ASSET', subtype: { in: CASH_SUBTYPES } },
        include: {
            journalLines: {
                where: { entry: { date: { lte: asOf }, status: { in: ['POSTED', 'VOID'] } } },
            },
        },
    });
    let total = 0;
    for (const acc of accounts) {
        const debit = acc.journalLines.reduce((s, l) => s + l.debit, 0);
        const credit = acc.journalLines.reduce((s, l) => s + l.credit, 0);
        total += debit - credit;
    }
    return total;
}

export default async function ManagementReportPage({
    searchParams,
}: {
    searchParams: Promise<{ from?: string; to?: string; preset?: string }>;
}) {
    const session = await auth();
    if (!session?.user) return redirect('/login');

    const params = await searchParams;
    const now = new Date();
    const activePreset = params.preset ?? 'this_month';
    const defaults = presetToDates(activePreset, now);
    const from = params.from || defaults.from;
    const to   = params.to   || defaults.to;

    const fromDate = new Date(from + 'T00:00:00.000Z');
    const toDate   = new Date(to + 'T23:59:59.999Z');

    const [
        pl,
        bs,
        cashPosition,
        companySettingRow,
        watermarkSettingRow,
        requisitionsInPeriod,
        activeBudgets,
    ] = await Promise.all([
        FinancialReports.getProfitAndLoss(fromDate, toDate),
        FinancialReports.getBalanceSheet(toDate),
        getCashPosition(toDate),
        (prisma as any).systemSetting.findUnique({ where: { key: 'company_name' } }).catch(() => null),
        (prisma as any).systemSetting.findUnique({ where: { key: 'watermark_logo' } }).catch(() => null),
        prisma.requisition.findMany({ where: { createdAt: { gte: fromDate, lte: toDate } } }),
        prisma.monthlyBudget.findMany({
            where: { month: toDate.getUTCMonth() + 1, year: toDate.getUTCFullYear(), status: 'APPROVED' },
            include: { items: true },
        }),
    ]);

    const companyName = companySettingRow?.value || 'Company';
    // '__REMOVE__' is EditableImage's sentinel for "logo was explicitly cleared" —
    // treat that the same as "never uploaded" (no watermark), not as a real URL.
    const watermarkUrl = watermarkSettingRow?.value && watermarkSettingRow.value !== '__REMOVE__'
        ? watermarkSettingRow.value
        : null;

    // ── Requisition pipeline ──
    const byStatus = (s: string) => requisitionsInPeriod.filter((r: any) => r.status === s);
    const pipeline = [
        { label: 'Draft',     items: byStatus('DRAFT') },
        { label: 'Pending',   items: byStatus('PENDING') },
        { label: 'Approved',  items: byStatus('APPROVED') },
        { label: 'Paid',      items: byStatus('PAID') },
        { label: 'Rejected',  items: byStatus('REJECTED') },
    ].map(p => ({ label: p.label, count: p.items.length, amount: p.items.reduce((s: number, r: any) => s + r.amount, 0) }));

    const submitted = requisitionsInPeriod.filter((r: any) => r.status !== 'DRAFT');
    const approved  = requisitionsInPeriod.filter((r: any) => !['DRAFT', 'PENDING', 'REJECTED'].includes(r.status));
    const approvalRate = submitted.length > 0 ? (approved.length / submitted.length) * 100 : 0;
    const pendingReqs = byStatus('PENDING');
    const pendingTotal = pendingReqs.reduce((s: number, r: any) => s + r.amount, 0);

    // ── Top spending categories ──
    const catMap: Record<string, { amount: number; count: number }> = {};
    for (const r of requisitionsInPeriod) {
        if (!r.category || r.status === 'DRAFT') continue;
        if (!catMap[r.category]) catMap[r.category] = { amount: 0, count: 0 };
        catMap[r.category].amount += r.amount;
        catMap[r.category].count += 1;
    }
    const topCategories = Object.entries(catMap)
        .sort(([, a], [, b]) => b.amount - a.amount)
        .slice(0, 8)
        .map(([category, v]) => ({ category, ...v }));

    // ── Budget utilization ──
    const budgetRows = activeBudgets.flatMap((b: any) =>
        b.items.map((item: any) => {
            const spent = requisitionsInPeriod
                .filter((r: any) => r.category === item.category && !['DRAFT', 'REJECTED'].includes(r.status))
                .reduce((s: number, r: any) => s + r.amount, 0);
            return { category: item.category, allocated: item.amount, spent };
        })
    );

    // ── Spending alerts ──
    const daySpan = Math.max(1, Math.round((toDate.getTime() - fromDate.getTime()) / 86400000));
    const avgDailySpend = submitted.length > 0 ? submitted.reduce((s: number, r: any) => s + r.amount, 0) / daySpan : 0;
    const alerts = submitted.filter((r: any) => avgDailySpend > 0 && r.amount > avgDailySpend * 3).slice(0, 5);

    const periodLabel = `${new Date(from).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} – ${new Date(to).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`;
    const pageUrl = (preset: string) => `?preset=${preset}`;

    // ── Assemble export data ──
    const exportData: ReportExportData = {
        title: 'Management Report',
        subtitle: `Business Overview · ${periodLabel}`,
        company: companyName,
        currency: 'KES',
        logoUrl: '/pesanest/pesanest-light-new.png',
        watermarkUrl: watermarkUrl ?? undefined,
        sections: [
            {
                title: 'Key Metrics',
                lines: [
                    { name: 'Net Revenue', current: pl.revenue.total },
                    { name: 'Total Expenses', current: pl.expenses.total, isNegative: true },
                    { name: 'Net Profit / Loss', current: pl.netIncome, isBold: true, isSubtotal: true },
                    { name: 'Cash Position (as of period end)', current: cashPosition },
                    { name: 'Pending Approvals (amount)', current: pendingTotal },
                ],
            },
            {
                title: 'Income Statement Summary',
                lines: [
                    ...pl.revenue.accounts.map(a => ({ code: a.code, name: a.name, current: a.balance })),
                    ...pl.expenses.accounts.map(a => ({ code: a.code, name: a.name, current: a.balance, isNegative: true as const, indent: true as const })),
                    { name: 'Net Income', current: pl.netIncome, isBold: true, isGrandTotal: true },
                ],
            },
            {
                title: 'Balance Sheet Summary',
                lines: [
                    { name: 'Total Assets', current: bs.assets.total, isBold: true },
                    { name: 'Total Liabilities', current: bs.liabilities.total, isBold: true },
                    { name: 'Total Equity', current: bs.equity.total, isBold: true, isSubtotal: true },
                ],
            },
            {
                title: 'Top Spending Categories',
                lines: topCategories.map(c => ({ name: `${c.category} (${c.count})`, current: c.amount })),
            },
            {
                title: 'Requisition Pipeline',
                lines: pipeline.map(p => ({ name: `${p.label} (${p.count})`, current: p.amount })),
            },
            ...(budgetRows.length > 0 ? [{
                title: 'Budget Utilization',
                lines: budgetRows.map((b: any) => ({ name: b.category, current: b.spent, prior: b.allocated })),
            }] : []),
            ...(alerts.length > 0 ? [{
                title: 'Spending Alerts',
                lines: alerts.map((a: any) => ({ name: a.title, current: a.amount })),
            }] : []),
        ],
    };

    return (
        <div className="pb-20 space-y-5 max-w-[960px] relative">

            {/* ── Watermark: the company's own uploaded logo, faint, behind everything.
                 Negative z-index so it paints beneath normal-flow siblings regardless
                 of DOM order (an absolutely-positioned z-index:0 element would actually
                 paint ABOVE later static content per CSS stacking rules — this avoids that). ── */}
            {watermarkUrl && (
                <img
                    src={watermarkUrl}
                    alt=""
                    aria-hidden="true"
                    className="absolute top-[80px] left-1/2 -translate-x-1/2 w-[520px] max-w-[85%] opacity-[0.05] pointer-events-none select-none print:opacity-[0.05] -z-10"
                />
            )}

            {/* ── Letterhead: Pesanest mark + the company's own uploadable logo ── */}
            <div className="flex items-center justify-between gap-4 pb-4" style={{ borderBottom: HAIRLINE }}>
                <BrandLogo width={130} height={34} color="#111827" />
                <EditableImage
                    settingKey="watermark_logo"
                    defaultSrc=""
                    alt="Company Logo"
                    className="w-[100px] h-[50px]"
                />
            </div>

            {/* ── Header ── */}
            <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <div className="w-[30px] h-[30px] rounded-[7px] bg-[#059669] flex items-center justify-center shrink-0">
                            <PiFileText className="text-white text-[15px]" />
                        </div>
                        <h1 className="text-[19px] font-[600] text-gray-900 tracking-tight">Management Report</h1>
                    </div>
                    <p className="text-[12px] text-gray-400 pl-[38px]">Business overview · {periodLabel}</p>
                </div>
                <ReportExportButton data={exportData} />
            </div>

            {/* ── Period picker ── */}
            <div className="flex items-center gap-1 flex-wrap">
                {PRESETS.map(p => (
                    <Link key={p.key} href={pageUrl(p.key)}
                        className={`px-3 py-1.5 rounded-full text-[11.5px] font-[500] transition-colors border ${
                            activePreset === p.key
                                ? 'bg-[#059669] text-white border-[#059669]'
                                : 'bg-white text-gray-500 border-gray-200 hover:border-[#059669]/40 hover:text-[#059669]'
                        }`}>
                        {p.label}
                    </Link>
                ))}
            </div>

            {/* ── KPI strip ── */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <KpiBox label="Net Revenue" value={fmt(pl.revenue.total)} color="#059669" />
                <KpiBox label="Total Expenses" value={`(${fmt(pl.expenses.total)})`} color="#dc2626" />
                <KpiBox label="Net Profit / Loss" value={pl.netIncome < 0 ? `(${fmt(pl.netIncome)})` : fmt(pl.netIncome)}
                    color={pl.netIncome >= 0 ? '#059669' : '#dc2626'} sub={`${pct(pl.netIncome, pl.revenue.total)} margin`} />
                <KpiBox label="Cash Position" value={fmt(cashPosition)} sub="As of period end" />
                <KpiBox label="Approval Rate" value={`${approvalRate.toFixed(1)}%`} sub={`${approved.length} of ${submitted.length} submitted`} />
                <KpiBox label="Pending Approvals" value={fmt(pendingTotal)} color="#d97706" sub={`${pendingReqs.length} item${pendingReqs.length !== 1 ? 's' : ''}`} />
            </div>

            {/* ── Income Statement summary ── */}
            <div className="bg-white rounded-[10px] overflow-hidden" style={{ border: HAIRLINE }}>
                <SectionHeader title="Income Statement Summary" color="#059669" />
                {pl.revenue.accounts.map(a => <Row key={a.code} label={`${a.code} · ${a.name}`} value={a.balance} />)}
                {pl.expenses.accounts.map(a => <Row key={a.code} label={`${a.code} · ${a.name}`} value={a.balance} negative />)}
                <Row label="Net Income" value={pl.netIncome} negative={pl.netIncome < 0} bold />
            </div>

            {/* ── Balance Sheet summary ── */}
            <div className="bg-white rounded-[10px] overflow-hidden" style={{ border: HAIRLINE }}>
                <SectionHeader title="Balance Sheet Summary" color="#0284c7" />
                <Row label="Total Assets" value={bs.assets.total} bold />
                <Row label="Total Liabilities" value={bs.liabilities.total} bold />
                <Row label="Total Equity" value={bs.equity.total} bold />
            </div>

            {/* ── Two-column: categories + pipeline ── */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="bg-white rounded-[10px] overflow-hidden" style={{ border: HAIRLINE }}>
                    <SectionHeader title="Top Spending Categories" color="#6366f1" />
                    {topCategories.length === 0
                        ? <p className="px-5 py-4 text-[11.5px] text-gray-400 italic">No spending recorded this period</p>
                        : topCategories.map(c => <Row key={c.category} label={c.category} sub={`${c.count} expense${c.count !== 1 ? 's' : ''}`} value={c.amount} />)
                    }
                </div>

                <div className="bg-white rounded-[10px] overflow-hidden" style={{ border: HAIRLINE }}>
                    <SectionHeader title="Requisition Pipeline" color="#9333ea" />
                    {pipeline.map(p => <Row key={p.label} label={p.label} sub={`${p.count} item${p.count !== 1 ? 's' : ''}`} value={p.amount} />)}
                </div>
            </div>

            {/* ── Budget utilization ── */}
            {budgetRows.length > 0 && (
                <div className="bg-white rounded-[10px] overflow-hidden" style={{ border: HAIRLINE }}>
                    <SectionHeader title="Budget Utilization" color="#0284c7" />
                    {budgetRows.map((b: any, i: number) => {
                        const p = b.allocated > 0 ? Math.min((b.spent / b.allocated) * 100, 100) : 0;
                        const color = p >= 90 ? '#dc2626' : p >= 70 ? '#d97706' : '#059669';
                        return (
                            <div key={i} className="px-5 py-3" style={{ borderBottom: HAIRLINE }}>
                                <div className="flex items-center justify-between mb-1.5">
                                    <span className="text-[12px] font-[500] text-gray-700">{b.category}</span>
                                    <span className="text-[11px] font-mono text-gray-400">
                                        KES {fmt(b.spent)} / {fmt(b.allocated)} ({p.toFixed(0)}%)
                                    </span>
                                </div>
                                <div className="h-[5px] w-full rounded-full overflow-hidden" style={{ background: 'rgba(0,0,0,0.05)' }}>
                                    <div className="h-full rounded-full" style={{ width: `${p}%`, background: color }} />
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* ── Spending alerts ── */}
            {alerts.length > 0 && (
                <div className="bg-white rounded-[10px] overflow-hidden" style={{ border: HAIRLINE }}>
                    <SectionHeader title="Spending Alerts" color="#dc2626" />
                    <div className="flex items-start gap-2.5 px-5 py-3" style={{ borderBottom: HAIRLINE, background: 'rgba(220,38,38,0.03)' }}>
                        <PiInfo className="text-[14px] text-rose-500 mt-0.5 shrink-0" />
                        <p className="text-[11.5px] text-rose-700">Expenses well above this period's average — worth a second look.</p>
                    </div>
                    {alerts.map((a: any) => (
                        <Row key={a.id} label={a.title} sub={a.category} value={a.amount} />
                    ))}
                </div>
            )}

            <p className="text-[11px] text-gray-400 text-center">
                {companyName} · Management Report · All amounts in KES · Figures rounded to 2 decimal places
            </p>
        </div>
    );
}
