import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import prisma from '@/lib/prisma';
import { FinancialReports } from '@/lib/accounting/reports';
import { ReportExportButton } from '@/components/accounting/ReportExportButton';
import type { ReportExportData } from '@/components/accounting/ReportExportButton';
import { BrandLogo } from '@/components/ui/BrandLogo';
import { EditableImage } from '@/components/finance-studio/EditableImage';
import Link from 'next/link';

// Classic corporate palette — navy ink, plain hairlines, one muted accent
// used only for positive/negative number color, never as a fill. Sharp
// corners throughout (no rounded-[Npx] anywhere in this report).
const INK = '#0F172A';
const RULE = '#D1D5DB';
const GREEN = '#14532D';
const RED = '#7F1D1D';

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

// ── shared, sharp-cornered building blocks ──────────────────────────────────

function SectionTitle({ n, title }: { n: number; title: string }) {
    return (
        <div className="pt-7 pb-2 first:pt-0">
            <h3 className="text-[13px] font-[700] tracking-[0.02em]" style={{ color: INK }}>
                {n}. {title.toUpperCase()}
            </h3>
            <div className="mt-1.5 h-[2px] w-10" style={{ background: INK }} />
        </div>
    );
}

function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
    return (
        <th className={`px-3 py-2 text-[10px] font-[700] uppercase tracking-[0.05em] ${right ? 'text-right' : 'text-left'}`}
            style={{ color: '#475569', background: '#F1F5F9', border: `1px solid ${RULE}` }}>
            {children}
        </th>
    );
}

function Td({ children, right, bold, colorValue }: { children: React.ReactNode; right?: boolean; bold?: boolean; colorValue?: number }) {
    const color = colorValue !== undefined ? (colorValue < 0 ? RED : undefined) : undefined;
    return (
        <td className={`px-3 py-2 text-[12px] ${right ? 'text-right font-mono tabular-nums' : ''} ${bold ? 'font-[700]' : ''}`}
            style={{ border: `1px solid ${RULE}`, color: color ?? '#1F2937' }}>
            {children}
        </td>
    );
}

function Money({ n, negativeParens }: { n: number; negativeParens?: boolean }) {
    const isNeg = negativeParens || n < 0;
    return <span style={{ color: isNeg ? RED : GREEN }}>{isNeg ? `(${fmt(n)})` : fmt(n)}</span>;
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
        prisma.requisition.findMany({ where: { createdAt: { gte: fromDate, lte: toDate } } }),
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

    // ── Spending by category ──
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

    // ── Executive summary — the actual point of a management report: a
    // written narrative, not a grid of colorful tiles ──
    const executiveSummary =
        `Revenue for the period totaled KES ${fmt(pl.revenue.total)} against expenses of KES ${fmt(pl.expenses.total)}, ` +
        `yielding a net ${pl.netIncome >= 0 ? 'profit' : 'loss'} of KES ${fmt(pl.netIncome)} (${pct(pl.netIncome, pl.revenue.total)} margin). ` +
        `Cash position stands at KES ${fmt(cashPosition)}. Approval rate held at ${approvalRate.toFixed(1)}%` +
        (pendingReqs.length > 0 ? `, with ${pendingReqs.length} item${pendingReqs.length !== 1 ? 's' : ''} pending disbursement totaling KES ${fmt(pendingTotal)}.` : ', with no items currently pending disbursement.');

    // ── Assemble export data ──
    let sectionNum = 1;
    const exportData: ReportExportData = {
        title: 'Management Report',
        subtitle: `For the Period Ended ${new Date(to).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`,
        company: companyName,
        currency: 'KES',
        logoUrl: '/pesanest/pesanest-light-new.png',
        watermarkUrl: watermarkUrl ?? undefined,
        executiveSummary,
        sections: [
            {
                title: `${++sectionNum}. Financial Summary`,
                lines: [
                    { name: 'Net Revenue', current: pl.revenue.total },
                    { name: 'Total Expenses', current: pl.expenses.total, isNegative: true },
                    { name: 'Net Profit / Loss', current: pl.netIncome, isBold: true, isSubtotal: true },
                    { name: 'Cash Position (as of period end)', current: cashPosition },
                    { name: 'Pending Approvals (amount)', current: pendingTotal },
                ],
            },
            {
                title: `${++sectionNum}. Income Statement`,
                lines: [
                    ...pl.revenue.accounts.map(a => ({ code: a.code, name: a.name, current: a.balance })),
                    ...pl.expenses.accounts.map(a => ({ code: a.code, name: a.name, current: a.balance, isNegative: true as const, indent: true as const })),
                    { name: 'Net Income', current: pl.netIncome, isBold: true, isGrandTotal: true },
                ],
            },
            {
                title: `${++sectionNum}. Balance Sheet`,
                lines: [
                    { name: 'Total Assets', current: bs.assets.total, isBold: true },
                    { name: 'Total Liabilities', current: bs.liabilities.total, isBold: true },
                    { name: 'Total Equity', current: bs.equity.total, isBold: true, isSubtotal: true },
                ],
            },
            {
                title: `${++sectionNum}. Spending by Category`,
                lines: topCategories.map(c => ({ name: `${c.category} (${c.count}, ${pct(c.amount, totalCategorySpend)})`, current: c.amount })),
            },
            {
                title: `${++sectionNum}. Requisition Pipeline`,
                lines: pipeline.map(p => ({ name: `${p.label} (${p.count})`, current: p.amount })),
            },
            ...(budgetRows.length > 0 ? [{
                title: `${++sectionNum}. Budget Utilization`,
                lines: budgetRows.map((b: any) => ({ name: b.category, current: b.spent, prior: b.allocated })),
            }] : []),
            ...(alerts.length > 0 ? [{
                title: `${++sectionNum}. Spending Alerts`,
                lines: alerts.map((a: any) => ({ name: a.title, current: a.amount })),
            }] : []),
        ],
    };

    return (
        <div className="pb-20 max-w-[880px] relative">

            {/* ── Watermark: the company's own uploaded logo, faint, behind everything.
                 Negative z-index so it paints beneath normal-flow siblings regardless
                 of DOM order (an absolutely-positioned z-index:0 element would actually
                 paint ABOVE later static content per CSS stacking rules — this avoids that). ── */}
            {watermarkUrl && (
                <img
                    src={watermarkUrl}
                    alt=""
                    aria-hidden="true"
                    className="absolute top-[100px] left-1/2 -translate-x-1/2 w-[480px] max-w-[85%] opacity-[0.04] pointer-events-none select-none print:opacity-[0.04] -z-10"
                />
            )}

            {/* ── Letterhead ── */}
            <div className="relative z-10 bg-white" style={{ border: `1px solid ${INK}` }}>
                <div className="flex items-center justify-between gap-4 px-6 pt-4 pb-3">
                    <BrandLogo width={100} height={27} color={INK} />
                    <EditableImage
                        settingKey="watermark_logo"
                        defaultSrc=""
                        alt="Company Logo"
                        className="w-[80px] h-[36px] shrink-0"
                    />
                </div>
                <div className="text-center px-6 pb-2">
                    <p className="text-[13px] font-[700]" style={{ color: INK }}>{companyName}</p>
                    {(registrationNumber || headquartersAddress) && (
                        <p className="text-[10.5px] text-gray-500 mt-0.5">
                            {[headquartersAddress, registrationNumber ? `Reg. No. ${registrationNumber}` : null].filter(Boolean).join(' · ')}
                        </p>
                    )}
                </div>
                <div style={{ borderTop: `1px solid ${INK}` }} className="text-center px-6 py-3">
                    <h1 className="text-[16px] font-[700] uppercase tracking-[0.08em]" style={{ color: INK }}>Management Report</h1>
                    <p className="text-[11px] text-gray-500 mt-1">
                        For the Period Ended {new Date(to).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </p>
                </div>
            </div>

            {/* ── Toolbar: period picker + export ── */}
            <div className="relative z-10 flex items-center justify-between gap-4 flex-wrap mt-4 mb-2 print:hidden">
                <div className="flex items-center gap-1 flex-wrap">
                    {PRESETS.map(p => (
                        <Link key={p.key} href={pageUrl(p.key)}
                            className={`px-3 py-1.5 text-[11.5px] font-[500] transition-colors border ${
                                activePreset === p.key ? 'text-white' : 'bg-white text-gray-500 border-gray-300 hover:border-gray-500'
                            }`}
                            style={activePreset === p.key ? { background: INK, borderColor: INK } : undefined}>
                            {p.label}
                        </Link>
                    ))}
                </div>
                <ReportExportButton data={exportData} />
            </div>

            {/* ── 1. Executive Summary ── */}
            <SectionTitle n={1} title="Executive Summary" />
            <div className="text-[12.5px] leading-relaxed text-gray-800 px-4 py-3" style={{ border: `1px solid ${RULE}` }}>
                {executiveSummary}
            </div>

            {/* ── 2. Financial Summary ── */}
            <SectionTitle n={2} title="Financial Summary" />
            <table className="w-full border-collapse">
                <thead><tr><Th>Metric</Th><Th right>Amount (KES)</Th></tr></thead>
                <tbody>
                    <tr><Td>Net Revenue</Td><Td right><Money n={pl.revenue.total} /></Td></tr>
                    <tr><Td>Total Expenses</Td><Td right><Money n={pl.expenses.total} negativeParens /></Td></tr>
                    <tr><Td bold>Net Profit / Loss ({pct(pl.netIncome, pl.revenue.total)} margin)</Td><Td right bold><Money n={pl.netIncome} /></Td></tr>
                    <tr><Td>Cash Position (as of period end)</Td><Td right><Money n={cashPosition} /></Td></tr>
                    <tr><Td>Approval Rate</Td><Td right>{approvalRate.toFixed(1)}% ({approved.length} of {submitted.length})</Td></tr>
                    <tr><Td>Pending Approvals</Td><Td right><Money n={pendingTotal} /> ({pendingReqs.length})</Td></tr>
                </tbody>
            </table>

            {/* ── 3. Income Statement ── */}
            <SectionTitle n={3} title="Income Statement" />
            <table className="w-full border-collapse">
                <thead><tr><Th>Code</Th><Th>Account</Th><Th right>Amount (KES)</Th></tr></thead>
                <tbody>
                    {pl.revenue.accounts.map(a => (
                        <tr key={a.code}><Td>{a.code}</Td><Td>{a.name}</Td><Td right><Money n={a.balance} /></Td></tr>
                    ))}
                    {pl.expenses.accounts.map(a => (
                        <tr key={a.code}><Td>{a.code}</Td><Td>{a.name}</Td><Td right><Money n={a.balance} negativeParens /></Td></tr>
                    ))}
                    <tr><Td bold>—</Td><Td bold>Net Income</Td><Td right bold><Money n={pl.netIncome} /></Td></tr>
                </tbody>
            </table>

            {/* ── 4. Balance Sheet ── */}
            <SectionTitle n={4} title="Balance Sheet" />
            <table className="w-full border-collapse">
                <thead><tr><Th>Metric</Th><Th right>Amount (KES)</Th></tr></thead>
                <tbody>
                    <tr><Td bold>Total Assets</Td><Td right bold><Money n={bs.assets.total} /></Td></tr>
                    <tr><Td bold>Total Liabilities</Td><Td right bold><Money n={bs.liabilities.total} /></Td></tr>
                    <tr><Td bold>Total Equity</Td><Td right bold><Money n={bs.equity.total} /></Td></tr>
                </tbody>
            </table>

            {/* ── 5. Spending by Category ── */}
            <SectionTitle n={5} title="Spending by Category" />
            {topCategories.length === 0 ? (
                <p className="text-[11.5px] text-gray-400 italic py-2">No spending recorded this period.</p>
            ) : (
                <table className="w-full border-collapse">
                    <thead><tr><Th>Category</Th><Th right>Count</Th><Th right>% of Total</Th><Th right>Amount (KES)</Th></tr></thead>
                    <tbody>
                        {topCategories.map(c => (
                            <tr key={c.category}>
                                <Td>{c.category}</Td>
                                <Td right>{c.count}</Td>
                                <Td right>{pct(c.amount, totalCategorySpend)}</Td>
                                <Td right><Money n={c.amount} /></Td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}

            {/* ── 6. Requisition Pipeline ── */}
            <SectionTitle n={6} title="Requisition Pipeline" />
            <table className="w-full border-collapse">
                <thead><tr><Th>Status</Th><Th right>Count</Th><Th right>Amount (KES)</Th></tr></thead>
                <tbody>
                    {pipeline.map(p => (
                        <tr key={p.label}><Td>{p.label}</Td><Td right>{p.count}</Td><Td right><Money n={p.amount} /></Td></tr>
                    ))}
                </tbody>
            </table>

            {/* ── 7. Budget Utilization ── */}
            {budgetRows.length > 0 && (
                <>
                    <SectionTitle n={7} title="Budget Utilization" />
                    <table className="w-full border-collapse">
                        <thead><tr><Th>Category</Th><Th right>Allocated</Th><Th right>Spent</Th><Th right>Utilization</Th></tr></thead>
                        <tbody>
                            {budgetRows.map((b: any, i: number) => {
                                const p = b.allocated > 0 ? Math.min((b.spent / b.allocated) * 100, 100) : 0;
                                return (
                                    <tr key={i}>
                                        <Td>{b.category}</Td>
                                        <Td right>{fmt(b.allocated)}</Td>
                                        <Td right>{fmt(b.spent)}</Td>
                                        <Td right colorValue={p >= 90 ? -1 : undefined}>{p.toFixed(0)}%</Td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </>
            )}

            {/* ── 8. Spending Alerts ── */}
            {alerts.length > 0 && (
                <>
                    <SectionTitle n={budgetRows.length > 0 ? 8 : 7} title="Spending Alerts" />
                    <p className="text-[11px] text-gray-500 italic mb-2">Expenses well above this period's average — worth a second look.</p>
                    <table className="w-full border-collapse">
                        <thead><tr><Th>Description</Th><Th>Category</Th><Th right>Amount (KES)</Th></tr></thead>
                        <tbody>
                            {alerts.map((a: any) => (
                                <tr key={a.id}><Td>{a.title}</Td><Td>{a.category || '—'}</Td><Td right><Money n={a.amount} /></Td></tr>
                            ))}
                        </tbody>
                    </table>
                </>
            )}

            {/* ── Footer ── */}
            <div className="relative z-10 pt-4 mt-8 flex items-center justify-between gap-4" style={{ borderTop: `1px solid ${INK}` }}>
                <p className="text-[10px] text-gray-500">{companyName} · Management Report · For internal management use only</p>
                <p className="text-[10px] text-gray-500">All amounts in KES</p>
            </div>
        </div>
    );
}
