import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import prisma from '@/lib/prisma';
import { FinancialReports } from '@/lib/accounting/reports';
import { PiFileText, PiInfo } from 'react-icons/pi';
import { ReportExportButton } from '@/components/accounting/ReportExportButton';
import type { ReportExportData } from '@/components/accounting/ReportExportButton';
import { BrandLogo } from '@/components/ui/BrandLogo';
import { EditableImage } from '@/components/finance-studio/EditableImage';
import { EditableCompanyName } from '@/components/finance-studio/EditableCompanyName';
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
        systemSettingRows,
        requisitionsInPeriod,
        activeBudgets,
    ] = await Promise.all([
        FinancialReports.getProfitAndLoss(fromDate, toDate),
        FinancialReports.getBalanceSheet(toDate),
        getCashPosition(toDate),
        (prisma as any).systemSetting.findMany({
            where: { key: { in: ['company_name', 'registration_number', 'headquarters_address', 'watermark_logo'] } },
        }).catch(() => [] as any[]),
        prisma.requisition.findMany({
            where: { createdAt: { gte: fromDate, lte: toDate } },
            include: { user: { select: { name: true } } },
            orderBy: { createdAt: 'asc' },
        }),
        prisma.monthlyBudget.findMany({
            where: { month: toDate.getUTCMonth() + 1, year: toDate.getUTCFullYear(), status: 'APPROVED' },
            include: { items: true },
        }),
    ]);

    const settingsMap: Record<string, string> = {};
    for (const row of systemSettingRows as any[]) settingsMap[row.key] = row.value;

    const companyName = settingsMap['company_name'] || 'Company';
    const registrationNumber = settingsMap['registration_number'] || null;
    const headquartersAddress = settingsMap['headquarters_address'] || null;
    // '__REMOVE__' is EditableImage's sentinel for "logo was explicitly cleared" —
    // treat that the same as "never uploaded" (no watermark), not as a real URL.
    const watermarkUrl = settingsMap['watermark_logo'] && settingsMap['watermark_logo'] !== '__REMOVE__'
        ? settingsMap['watermark_logo']
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
    const totalCategorySpend = Object.values(catMap).reduce((s, v) => s + v.amount, 0);
    const topCategories = Object.entries(catMap)
        .sort(([, a], [, b]) => b.amount - a.amount)
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

    // ── Executive summary — a plain-language roll-up of the numbers below,
    // generated from the same figures rather than free-text AI narration. ──
    const executiveSummary = `During ${periodLabel}, ${companyName} recorded net revenue of KES ${fmt(pl.revenue.total)} against total expenses of KES ${fmt(pl.expenses.total)}, resulting in a net ${pl.netIncome >= 0 ? 'profit' : 'loss'} of KES ${fmt(pl.netIncome)}. Cash position stood at KES ${fmt(cashPosition)} as of period end. Of ${submitted.length} requisition${submitted.length !== 1 ? 's' : ''} submitted for approval, ${approved.length} (${approvalRate.toFixed(1)}%) were approved, with ${pendingReqs.length} item${pendingReqs.length !== 1 ? 's' : ''} totaling KES ${fmt(pendingTotal)} still pending.`;

    // ── Recommendations — deterministic, derived from data already computed
    // above (no free-text generation): flag whatever actually needs attention. ──
    const overBudgetCategories = budgetRows.filter((b: any) => b.allocated > 0 && b.spent / b.allocated >= 0.9);
    const recommendations: string[] = [];
    if (pendingReqs.length > 0) {
        recommendations.push(`Follow up on ${pendingReqs.length} pending requisition${pendingReqs.length !== 1 ? 's' : ''} totaling KES ${fmt(pendingTotal)} awaiting approval.`);
    }
    if (overBudgetCategories.length > 0) {
        recommendations.push(`Review budget allocations for ${overBudgetCategories.map((b: any) => b.category).join(', ')} — utilization has reached or exceeded 90% of the amount allocated for this period.`);
    }
    if (alerts.length > 0) {
        recommendations.push(`Investigate ${alerts.length} flagged transaction${alerts.length !== 1 ? 's' : ''} identified as significantly above this period's average spend.`);
    }
    if (submitted.length > 0 && approvalRate < 70) {
        recommendations.push(`Approval rate for this period was ${approvalRate.toFixed(1)}%, below the typical target — consider reviewing the approval workflow for bottlenecks.`);
    }
    if (recommendations.length === 0) {
        recommendations.push('No immediate action items identified for this period.');
    }

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
                title: 'Executive Summary',
                lines: [{ name: executiveSummary, current: 0, note: true }],
            },
            {
                title: 'Reporting Period & Scope',
                lines: [{
                    name: `This report covers all requisition, budget, and financial activity for ${companyName} for the period ${periodLabel}, prepared for internal management review.`,
                    current: 0, note: true,
                }],
            },
            {
                title: 'Key Financial Metrics',
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
                title: 'Spending by Category',
                lines: topCategories.map(c => ({ name: `${c.category} (${c.count}, ${pct(c.amount, totalCategorySpend)})`, current: c.amount })),
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
                title: 'Risks & Spending Alerts',
                lines: alerts.map((a: any) => ({ name: a.title, current: a.amount })),
            }] : []),
            {
                title: 'Recommendations & Next Steps',
                lines: recommendations.map(r => ({ name: r, current: 0, note: true })),
            },
            {
                // Full itemized listing — every requisition in the period, not just
                // the rolled-up category/status/pipeline summaries above. This is
                // the actual auditable detail behind those totals — kept as an
                // appendix at the very end, after the summary and analysis.
                title: `Detailed Transactions (${requisitionsInPeriod.length})`,
                lines: requisitionsInPeriod.length === 0
                    ? [{ name: 'No requisitions recorded in this period', current: 0 }]
                    : requisitionsInPeriod.map((r: any) => ({
                        name: `${new Date(r.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}  ·  ${r.title}  ·  ${r.category || 'Uncategorized'}  ·  Requested by ${r.user?.name || 'Unknown'}  ·  ${r.status}`,
                        current: r.amount,
                    })),
            },
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

            {/* ── Letterhead ── */}
            <div className="relative z-10 bg-white rounded-[10px] overflow-hidden" style={{ border: HAIRLINE }}>

                {/* Logo row: Pesanest mark (left), company name (center), the
                    company's own uploadable logo (right) */}
                <div className="flex items-center justify-between gap-4 px-5 pt-4 pb-3">
                    <BrandLogo width={110} height={30} color="#111827" />
                    <div className="flex-1 flex justify-center px-2 min-w-0">
                        <EditableCompanyName value={companyName} className="text-[13px] font-[700] text-gray-900 text-center truncate max-w-full" />
                    </div>
                    <EditableImage
                        settingKey="watermark_logo"
                        defaultSrc=""
                        alt="Company Logo"
                        className="w-[90px] h-[42px] shrink-0"
                    />
                </div>

                {/* Metadata strip */}
                <div className="grid grid-cols-3 gap-4 px-5 py-3" style={{ borderTop: HAIRLINE, borderBottom: HAIRLINE, background: '#FAFAFA' }}>
                    <div>
                        <p className="text-[9.5px] font-[600] uppercase tracking-[0.08em] text-gray-400 mb-0.5">Period</p>
                        <p className="text-[12px] font-[500] text-gray-800">{periodLabel}</p>
                    </div>
                    <div>
                        <p className="text-[9.5px] font-[600] uppercase tracking-[0.08em] text-gray-400 mb-0.5">Generated</p>
                        <p className="text-[12px] font-[500] text-gray-800">{now.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                    </div>
                    <div>
                        <p className="text-[9.5px] font-[600] uppercase tracking-[0.08em] text-gray-400 mb-0.5">Currency</p>
                        <p className="text-[12px] font-[500] text-gray-800">KES</p>
                    </div>
                </div>

                {/* Title band */}
                <div className="flex items-center gap-2.5 px-5 py-3" style={{ background: '#059669' }}>
                    <div className="w-[26px] h-[26px] rounded-[6px] bg-white/15 flex items-center justify-center shrink-0">
                        <PiFileText className="text-white text-[13px]" />
                    </div>
                    <h1 className="text-[15px] font-[700] text-white uppercase tracking-[0.04em]">Management Report</h1>
                </div>

                {/* Company details */}
                {(registrationNumber || headquartersAddress) && (
                    <div className="px-5 py-2.5 flex flex-wrap gap-x-6 gap-y-1" style={{ borderTop: HAIRLINE }}>
                        {registrationNumber && (
                            <p className="text-[11px] text-gray-500"><span className="text-gray-400">Reg. No:</span> {registrationNumber}</p>
                        )}
                        {headquartersAddress && (
                            <p className="text-[11px] text-gray-500"><span className="text-gray-400">Address:</span> {headquartersAddress}</p>
                        )}
                    </div>
                )}
            </div>

            {/* ── Toolbar: export ── */}
            <div className="relative z-10 flex items-center justify-end">
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
                    <SectionHeader title="Spending by Category" color="#6366f1" />
                    {topCategories.length === 0
                        ? <p className="px-5 py-4 text-[11.5px] text-gray-400 italic">No spending recorded this period</p>
                        : topCategories.map(c => (
                            <Row key={c.category} label={c.category}
                                sub={`${c.count} expense${c.count !== 1 ? 's' : ''} · ${pct(c.amount, totalCategorySpend)} of total`}
                                value={c.amount} />
                        ))
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

            {/* ── Footer ── */}
            <div className="relative z-10 pt-4 flex items-center justify-between gap-4" style={{ borderTop: HAIRLINE }}>
                <div className="flex items-center gap-2.5">
                    <BrandLogo width={70} height={19} color="#9ca3af" />
                    <p className="text-[10.5px] text-gray-400">
                        Prepared by {companyName} · Powered by Pesanest
                    </p>
                </div>
                <p className="text-[10.5px] text-gray-400">
                    All amounts in KES · Figures rounded to 2 decimal places
                </p>
            </div>
        </div>
    );
}
