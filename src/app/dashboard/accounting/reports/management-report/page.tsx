import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import prisma from '@/lib/prisma';
import { FinancialReports } from '@/lib/accounting/reports';
import { ManagementReportPdf } from '@/components/accounting/ManagementReportPdf';
import type { ManagementReportData } from '@/components/accounting/ManagementReportPdf';
import { BrandLogo } from '@/components/ui/BrandLogo';
import { EditableImage } from '@/components/finance-studio/EditableImage';
import { EditableCompanyName } from '@/components/finance-studio/EditableCompanyName';
import Link from 'next/link';
import { Inter } from 'next/font/google';

// Scoped to this page only — the rest of the app reads in Lexend/Outfit,
// but a report meant to be printed and shared reads better set in Inter,
// the same typeface the PDF export below now embeds for itself.
const inter = Inter({ subsets: ['latin'], display: 'swap' });

const HAIRLINE = '1px solid rgba(0,0,0,0.08)';
const SEV_COLOR: Record<string, string> = { high: '#dc2626', medium: '#d97706', low: '#059669' };
const STATUS_COLOR: Record<string, string> = { Flagged: '#dc2626', Resolved: '#059669', Monitor: '#6b7280', Open: '#d97706' };

// Same "cash-like" subtypes used across bank reconciliation / transfers —
// a live snapshot of what the business actually has on hand right now,
// not a full cash-flow statement (see cash-flow/page.tsx for that).
const CASH_SUBTYPES = ['CURRENT_ASSET', 'CASH', 'CURRENT', 'PAYBILL', 'BANK'];

function fmt(n: number) {
    return new Intl.NumberFormat('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Math.abs(n));
}

function fmtSigned(n: number) {
    return n < 0 ? `(${fmt(n)})` : fmt(n);
}

function pctOf(n: number, base: number) {
    if (!base) return '—';
    return (Math.abs(n / base) * 100).toFixed(1) + '%';
}

// A net margin specifically — unlike pctOf (a share of a whole, always
// 0–100%), net income can exceed revenue itself when a loss is larger
// than the revenue base, producing a "539% margin" that is mathematically
// correct but meaningless to a reader. Flag those as NM (not meaningful)
// rather than print a distorted percentage.
function marginPct(net: number, revenue: number): string {
    if (!revenue || revenue <= 0) return 'NM';
    const ratio = net / revenue;
    if (Math.abs(ratio) > 1) return 'NM';
    return `${(ratio * 100).toFixed(1)}%`;
}

// A short "vs last period" trend line for a KPI — the comparative baseline
// every board-reporting guide treats as non-negotiable (a single month's
// figure in isolation tells a director nothing about whether it's normal).
// Plain words rather than ▲▼ glyphs — the PDF's embedded font subset only
// covers the Latin characters actually used elsewhere in the report, so an
// arrow glyph silently drops out instead of rendering.
function trendLabel(curr: number, prev: number): string | undefined {
    if (prev === 0) return curr === 0 ? undefined : 'up from nil last period';
    const pct = ((curr - prev) / Math.abs(prev)) * 100;
    if (Math.abs(pct) < 0.05) return 'flat vs last period';
    return `${pct > 0 ? 'up' : 'down'} ${Math.abs(pct).toFixed(1)}% vs last period`;
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

// ── executive-report building blocks (understated: thin borders, thin green
// accents, no rounded cards/shadows/gradients — see the approved redesign plan) ──

function LayerHeading({ n, title }: { n: number; title: string }) {
    return (
        <div className="flex items-baseline gap-4 pb-3.5" style={{ borderBottom: '2px solid #059669' }}>
            <span className="text-[11px] font-[700] uppercase tracking-[0.1em] px-2.5 py-1 rounded-[5px] whitespace-nowrap" style={{ color: '#059669', background: '#ECFDF5' }}>
                Section {String(n).padStart(2, '0')}
            </span>
            <h2 className="text-[26px] font-[700] text-gray-900 tracking-[-0.02em] leading-none">{title}</h2>
        </div>
    );
}

function SubTitle({ children }: { children: React.ReactNode }) {
    return (
        <h3 className="text-[11.5px] font-[700] uppercase tracking-[0.1em] mb-3.5 mt-8 pb-2 first:mt-0" style={{ color: '#059669', borderBottom: HAIRLINE }}>
            {children}
        </h3>
    );
}

// A page's point, stated first — a thin green rule, larger type than body
// text, before the tables that back it up.
function Lead({ children }: { children: React.ReactNode }) {
    return (
        <p className="text-[16px] text-gray-900 leading-[1.6] pl-5 py-1" style={{ borderLeft: '3px solid #059669' }}>
            {children}
        </p>
    );
}

// A basis-of-preparation / methodology note — not just a plain paragraph.
function Callout({ children }: { children: React.ReactNode }) {
    return (
        <div className="px-5 py-4" style={{ background: '#ECFDF5', borderLeft: '4px solid #059669', borderRadius: '0 10px 10px 0' }}>
            <p className="text-[10.5px] font-[700] uppercase tracking-[0.08em] text-[#047857] mb-1.5">Basis of Preparation</p>
            <p className="text-[12px] text-gray-700 leading-relaxed">{children}</p>
        </div>
    );
}

// A band of stat tiles — big colored figures over a small caps label, the
// way a set of headline numbers earns its own visual weight instead of
// reading as just another two-column table.
const KPI_TONE: Record<string, string> = { brand: '#059669', green: '#059669', red: '#dc2626', amber: '#d97706', dark: '#111827' };
function kpiTone(label: string, value: string): string {
    if (label === 'Net Result') return value.trim().startsWith('(') ? 'red' : 'green';
    if (label === 'Pending Approvals') return 'amber';
    if (label === 'Total Expenditure') return 'dark';
    return 'brand';
}
function KpiBand({ items }: { items: { label: string; value: string; sub: string }[] }) {
    return (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 divide-x divide-y divide-gray-100 overflow-hidden" style={{ border: HAIRLINE, borderRadius: 10 }}>
            {items.map(k => (
                <div key={k.label} className="px-5 py-4">
                    <div className="font-mono tabular-nums font-[700] leading-none" style={{ fontSize: 22, letterSpacing: '-0.02em', color: KPI_TONE[kpiTone(k.label, k.value)] }}>
                        {k.value}
                    </div>
                    <div className="text-[10.5px] font-[600] uppercase tracking-[0.08em] text-gray-400 mt-2.5">{k.label}</div>
                    {k.sub && <div className="text-[10.5px] text-gray-400 mt-1 leading-snug">{k.sub}</div>}
                </div>
            ))}
        </div>
    );
}

// A proper ruled accounting statement — green header, alternating row
// shading, shaded subtotal rows, bold dark grand-total footer — used
// identically for the Income Statement, Balance Sheet and Cash Flow
// Statement so all three carry the same visual weight as the rest of the
// report instead of reading as plain label/amount lists.
function StatementTable({ groups, totalLabel, totalAmount }: {
    groups: { label: string; rows: { name: string; amount: number }[]; subtotal?: { label: string; amount: number } }[];
    totalLabel: string;
    totalAmount: number;
}) {
    return (
        <div className="overflow-hidden" style={{ border: HAIRLINE, borderRadius: 10 }}>
            <table className="w-full text-[12px]">
                <thead>
                    <tr style={{ background: '#059669' }}>
                        <th className="text-left font-[700] text-white uppercase tracking-[0.07em] text-[10.5px] px-5 py-3">Description / Account</th>
                        <th className="text-right font-[700] text-white uppercase tracking-[0.07em] text-[10.5px] px-5 py-3">KES</th>
                    </tr>
                </thead>
                <tbody>
                    {groups.flatMap((g, gi) => [
                        <tr key={`${gi}-h`} style={{ background: '#ECFDF5' }}>
                            <td colSpan={2} className="px-5 py-2 text-[10.5px] font-[700] uppercase tracking-[0.08em]" style={{ color: '#059669' }}>{g.label}</td>
                        </tr>,
                        ...(g.rows.length === 0 ? [
                            <tr key={`${gi}-empty`}>
                                <td colSpan={2} className="px-5 py-3 text-[12px] text-gray-400 italic">No activity recorded</td>
                            </tr>,
                        ] : g.rows.map((r, ri) => (
                            <tr key={`${gi}-${ri}`} style={{ background: ri % 2 === 1 ? '#FAFAFA' : 'white' }}>
                                <td className="px-5 py-2.5 text-gray-700 leading-relaxed">{r.name}</td>
                                <td className="px-5 py-2.5 text-right font-mono tabular-nums text-gray-900">{fmtSigned(r.amount)}</td>
                            </tr>
                        ))),
                        ...(g.subtotal ? [
                            <tr key={`${gi}-sub`} style={{ background: '#F3F4F6' }}>
                                <td className="px-5 py-2.5 font-[600] text-gray-700">{g.subtotal.label}</td>
                                <td className="px-5 py-2.5 text-right font-[700] font-mono tabular-nums text-gray-900">{fmtSigned(g.subtotal.amount)}</td>
                            </tr>,
                        ] : []),
                    ])}
                </tbody>
                <tfoot>
                    <tr style={{ background: '#111827' }}>
                        <td className="px-5 py-3.5 font-[700] text-white uppercase tracking-[0.04em] text-[12.5px]">{totalLabel}</td>
                        <td className="px-5 py-3.5 text-right font-[800] font-mono tabular-nums text-white text-[14px]">{fmtSigned(totalAmount)}</td>
                    </tr>
                </tfoot>
            </table>
        </div>
    );
}

function CategoryBar({ category, amount, share, count, maxAmount, rank }: { category: string; amount: number; share: string; count: number; maxAmount: number; rank: number }) {
    const widthPct = maxAmount > 0 ? Math.max(0.6, (amount / maxAmount) * 100) : 0;
    return (
        <div className="px-5 py-3.5" style={{ borderBottom: HAIRLINE }}>
            <div className="flex items-baseline justify-between gap-3 mb-2">
                <span className="text-[12px] text-gray-700 truncate">{category} <span className="text-gray-400">({count}, {share})</span></span>
                <span className="text-[12px] font-mono tabular-nums text-gray-900 font-[600] shrink-0">{fmt(amount)}</span>
            </div>
            <div className="h-[6px] bg-gray-100 overflow-hidden">
                <div className="h-full" style={{ width: `${widthPct}%`, background: rank === 0 ? '#059669' : '#6ec3a5' }} />
            </div>
        </div>
    );
}

function PipelineTable({ stages }: { stages: { label: string; count: number; amount: number }[] }) {
    return (
        <div className="overflow-hidden" style={{ border: HAIRLINE, borderRadius: 10 }}>
            <table className="w-full text-[12px]">
                <thead>
                    <tr style={{ background: '#059669' }}>
                        <th className="text-left font-[700] text-white uppercase tracking-[0.07em] text-[10.5px] px-5 py-3">Stage</th>
                        <th className="text-right font-[700] text-white uppercase tracking-[0.07em] text-[10.5px] px-5 py-3">Items</th>
                        <th className="text-right font-[700] text-white uppercase tracking-[0.07em] text-[10.5px] px-5 py-3">KES</th>
                    </tr>
                </thead>
                <tbody>
                    {stages.map((s, i) => (
                        <tr key={s.label} style={{ background: i % 2 === 1 ? '#FAFAFA' : 'white' }}>
                            <td className="px-5 py-3 text-gray-700">{s.label}</td>
                            <td className="px-5 py-3 text-right font-mono tabular-nums text-gray-900">{s.count}</td>
                            <td className="px-5 py-3 text-right font-mono tabular-nums text-gray-900 font-[600]">{fmt(s.amount)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

// Budget vs Actual — the comparison every CFO board-reporting guide treats
// as non-negotiable, built from budget data the app already collects
// (MonthlyBudget/BudgetItem) but this report wasn't previously showing.
function BudgetTable({ rows }: { rows: { category: string; allocated: number; spent: number; pctUsed: number }[] }) {
    return (
        <div className="overflow-hidden" style={{ border: HAIRLINE, borderRadius: 10 }}>
            <table className="w-full text-[12px]">
                <thead>
                    <tr style={{ background: '#059669' }}>
                        <th className="text-left font-[700] text-white uppercase tracking-[0.07em] text-[10.5px] px-5 py-3">Category</th>
                        <th className="text-right font-[700] text-white uppercase tracking-[0.07em] text-[10.5px] px-5 py-3">Allocated</th>
                        <th className="text-right font-[700] text-white uppercase tracking-[0.07em] text-[10.5px] px-5 py-3">Spent</th>
                        <th className="text-right font-[700] text-white uppercase tracking-[0.07em] text-[10.5px] px-5 py-3">Variance</th>
                        <th className="text-right font-[700] text-white uppercase tracking-[0.07em] text-[10.5px] px-5 py-3">% Used</th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map((b, i) => (
                        <tr key={b.category} style={{ background: i % 2 === 1 ? '#FAFAFA' : 'white' }}>
                            <td className="px-5 py-3 text-gray-700">{b.category}</td>
                            <td className="px-5 py-3 text-right font-mono tabular-nums text-gray-900">{fmt(b.allocated)}</td>
                            <td className="px-5 py-3 text-right font-mono tabular-nums text-gray-900">{fmt(b.spent)}</td>
                            <td className="px-5 py-3 text-right font-mono tabular-nums text-gray-900">{fmtSigned(b.allocated - b.spent)}</td>
                            <td className="px-5 py-3 text-right font-mono tabular-nums font-[700]" style={{ color: b.pctUsed >= 100 ? '#dc2626' : b.pctUsed >= 90 ? '#d97706' : '#059669' }}>
                                {b.pctUsed.toFixed(0)}%
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

// A short, escalated list of items that need a board decision — not routine
// follow-up (that's Management Actions), only what genuinely needs sign-off:
// a fully exhausted budget line, or a high-severity spending exception.
function BoardDecisions({ items }: { items: string[] }) {
    if (items.length === 0) return null;
    return (
        <div className="px-5 py-4" style={{ background: '#FEF2F2', borderLeft: '4px solid #dc2626', borderRadius: '0 10px 10px 0' }}>
            <p className="text-[10.5px] font-[700] uppercase tracking-[0.08em] text-[#b91c1c] mb-2">Requires Board Decision</p>
            <ul className="space-y-1.5">
                {items.map((item, i) => (
                    <li key={i} className="text-[12px] text-gray-700 leading-relaxed pl-3 relative">
                        <span className="absolute left-0 top-[7px] w-[5px] h-[5px] rounded-full" style={{ background: '#dc2626' }} />
                        {item}
                    </li>
                ))}
            </ul>
        </div>
    );
}

function RiskRow({ severity, title, amount, status }: { severity: 'high' | 'medium' | 'low'; title: string; amount: number; status: string }) {
    return (
        <div className="flex items-center gap-3 px-5 py-3.5" style={{ borderBottom: HAIRLINE }}>
            <span className="w-[7px] h-[7px] rounded-full shrink-0" style={{ background: SEV_COLOR[severity] }} />
            <div className="flex-1 min-w-0">
                <p className="text-[12px] text-gray-800 truncate">{title}</p>
                <p className="text-[11px] text-gray-400 mt-1">{status}</p>
            </div>
            <span className="text-[12px] font-mono tabular-nums text-gray-900 font-[600] shrink-0">{fmt(amount)}</span>
        </div>
    );
}

function ActionRow({ action, owner, dueDate, status }: { action: string; owner?: string; dueDate?: string; status: string }) {
    return (
        <div className="grid grid-cols-[1fr_100px_90px_80px] gap-3 px-5 py-3.5 items-center" style={{ borderBottom: HAIRLINE }}>
            <p className="text-[12px] text-gray-800 leading-relaxed">{action}</p>
            <p className="text-[11.5px] text-gray-400 truncate">{owner || '—'}</p>
            <p className="text-[11.5px] text-gray-400 truncate">{dueDate || '—'}</p>
            <span className="text-[11px] font-[600] justify-self-start" style={{ color: STATUS_COLOR[status] ?? '#6b7280' }}>{status}</span>
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

// Indirect-method cash flow statement, scoped to the report's period —
// same approach as cash-flow/page.tsx, but filtered by date range instead
// of all-time, so it lines up with the rest of this report.
async function getCashFlowActivity(fromDate: Date, toDate: Date) {
    const accounts = await prisma.account.findMany({
        include: {
            journalLines: {
                where: { entry: { date: { gte: fromDate, lte: toDate }, status: { in: ['POSTED', 'VOID'] } } },
            },
        },
    });

    const accountBalances = accounts.map(acc => {
        const dr = acc.journalLines.reduce((s, l) => s + l.debit, 0);
        const cr = acc.journalLines.reduce((s, l) => s + l.credit, 0);
        const isDebitNormal = acc.type === 'ASSET' || acc.type === 'EXPENSE';
        return { id: acc.id, name: acc.name, type: acc.type, subtype: acc.subtype, balance: isDebitNormal ? dr - cr : cr - dr };
    });

    const isCash = (a: typeof accountBalances[0]) => {
        if (a.type !== 'ASSET') return false;
        const n = a.name.toLowerCase();
        return n.includes('bank') || n.includes('cash') || n.includes('wallet') || n.includes('pesa') || n.includes('stripe');
    };

    const revenues = accountBalances.filter(a => a.type === 'REVENUE');
    const expenses = accountBalances.filter(a => a.type === 'EXPENSE');
    const netIncome = revenues.reduce((s, a) => s + a.balance, 0) - expenses.reduce((s, a) => s + a.balance, 0);

    const depreciationAddBack = expenses.filter(a => a.name.toLowerCase().includes('depreciation')).reduce((s, a) => s + a.balance, 0);

    const receivables = accountBalances.filter(a => a.type === 'ASSET' && !isCash(a) &&
        (a.subtype?.toUpperCase() === 'RECEIVABLE' || a.name.toLowerCase().includes('receivable')));
    const changeReceivables = receivables.reduce((s, a) => s + a.balance, 0);

    const payables = accountBalances.filter(a => a.type === 'LIABILITY' &&
        (a.subtype?.toUpperCase() === 'PAYABLE' || a.name.toLowerCase().includes('payable')));
    const changePayables = payables.reduce((s, a) => s + a.balance, 0);

    const operatingTotal = netIncome + depreciationAddBack + changePayables - changeReceivables;

    const fixedAssets = accountBalances.filter(a => a.type === 'ASSET' && !isCash(a) && !receivables.includes(a));
    const investingTotal = -1 * fixedAssets.reduce((s, a) => s + a.balance, 0);

    const loans = accountBalances.filter(a => a.type === 'LIABILITY' && !payables.includes(a));
    const equity = accountBalances.filter(a => a.type === 'EQUITY');
    const changeLoans = loans.reduce((s, a) => s + a.balance, 0);
    const changeEquity = equity.reduce((s, a) => s + a.balance, 0);
    const financingTotal = changeLoans + changeEquity;

    return {
        operating: {
            items: [
                { name: 'Net Income / (Loss)', amount: netIncome },
                ...(depreciationAddBack !== 0 ? [{ name: 'Add back: Depreciation', amount: depreciationAddBack }] : []),
                ...(changeReceivables !== 0 ? [{ name: 'Change in Accounts Receivable', amount: -changeReceivables }] : []),
                ...(changePayables !== 0 ? [{ name: 'Change in Accounts Payable', amount: changePayables }] : []),
            ],
            total: operatingTotal,
        },
        investing: {
            items: fixedAssets.length > 0 ? [{ name: 'Net Purchases of Fixed Assets', amount: investingTotal }] : [],
            total: investingTotal,
        },
        financing: {
            items: [
                ...(changeLoans !== 0 ? [{ name: 'Change in Loans & Liabilities', amount: changeLoans }] : []),
                ...(changeEquity !== 0 ? [{ name: 'Change in Equity & Capital', amount: changeEquity }] : []),
            ],
            total: financingTotal,
        },
        netChange: operatingTotal + investingTotal + financingTotal,
    };
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

    // The immediately preceding period of equal length — every board-report
    // guide treats "vs last period" as the minimum comparative baseline; a
    // single month's figures in isolation don't tell a director anything.
    const periodLengthMs = toDate.getTime() - fromDate.getTime();
    const prevToDate = new Date(fromDate.getTime() - 1);
    const prevFromDate = new Date(prevToDate.getTime() - periodLengthMs);

    const [
        pl,
        bs,
        cashPosition,
        cashFlow,
        systemSettingRows,
        requisitionsInPeriod,
        activeBudgets,
        plComparative,
        prevCashPosition,
        prevBs,
    ] = await Promise.all([
        FinancialReports.getProfitAndLoss(fromDate, toDate),
        FinancialReports.getBalanceSheet(toDate),
        getCashPosition(toDate),
        getCashFlowActivity(fromDate, toDate),
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
        FinancialReports.getComparative({ start: fromDate, end: toDate }, { start: prevFromDate, end: prevToDate }, 'PL'),
        getCashPosition(prevToDate),
        FinancialReports.getBalanceSheet(prevToDate),
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
    const pipelineAll = [
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
    const maxCategoryAmount = Math.max(...topCategories.map(c => c.amount), 1);

    // ── Budget utilization ──
    const budgetRows = activeBudgets.flatMap((b: any) =>
        b.items.map((item: any) => {
            const spent = requisitionsInPeriod
                .filter((r: any) => r.category === item.category && !['DRAFT', 'REJECTED'].includes(r.status))
                .reduce((s: number, r: any) => s + r.amount, 0);
            return { category: item.category, allocated: item.amount, spent };
        })
    );
    const budget = budgetRows
        .map((b: any) => ({ ...b, pctUsed: b.allocated > 0 ? (b.spent / b.allocated) * 100 : 0 }))
        .sort((a: any, b: any) => b.pctUsed - a.pctUsed);

    // ── Prior-period trend for the headline KPIs — "vs last period" is the
    // baseline every board-reporting guide treats as required, not optional. ──
    const revTrend = trendLabel(pl.revenue.total, plComparative.summary?.period2.revenue ?? 0);
    const expTrend = trendLabel(pl.expenses.total, plComparative.summary?.period2.expenses ?? 0);
    const netTrend = trendLabel(pl.netIncome, plComparative.summary?.period2.netIncome ?? 0);
    const cashTrend = trendLabel(cashPosition, prevCashPosition);
    const equityTrend = trendLabel(bs.equity.total, prevBs.equity.total);

    // ── Spending alerts → risk exceptions (severity derived from the same
    // ratio already computed, not invented) ──
    const daySpan = Math.max(1, Math.round((toDate.getTime() - fromDate.getTime()) / 86400000));
    const avgDailySpend = submitted.length > 0 ? submitted.reduce((s: number, r: any) => s + r.amount, 0) / daySpan : 0;
    const alerts = submitted.filter((r: any) => avgDailySpend > 0 && r.amount > avgDailySpend * 3).slice(0, 5);
    const risks = alerts.map((a: any) => {
        const ratio = avgDailySpend > 0 ? a.amount / avgDailySpend : 0;
        const severity: 'high' | 'medium' | 'low' = ratio >= 6 ? 'high' : ratio >= 4 ? 'medium' : 'low';
        return { severity, title: a.title, amount: a.amount, status: `${ratio.toFixed(1)}× average daily spend` };
    });

    const periodLabel = `${new Date(from).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} – ${new Date(to).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`;
    const monthLabel = new Date(to).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
    const generatedLabel = now.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    const pageUrl = (preset: string) => `?preset=${preset}`;

    // ── Executive summary — a plain-language roll-up of the numbers below,
    // generated from the same figures rather than free-text AI narration.
    // Leads with what changed vs last period, not just the raw totals — a
    // number with no comparative baseline doesn't tell a director anything. ──
    const executiveSummary = `During ${periodLabel}, ${companyName} recorded net revenue of KES ${fmt(pl.revenue.total)} (${revTrend ?? 'no prior-period activity to compare'}) against total expenses of KES ${fmt(pl.expenses.total)} (${expTrend ?? 'no prior-period activity to compare'}), resulting in a net ${pl.netIncome >= 0 ? 'profit' : 'loss'} of KES ${fmt(pl.netIncome)}. Cash position stood at KES ${fmt(cashPosition)} as of period end${cashTrend ? `, ${cashTrend}` : ''}. Of ${submitted.length} requisition${submitted.length !== 1 ? 's' : ''} submitted for approval, ${approved.length} (${approvalRate.toFixed(1)}%) were approved, with ${pendingReqs.length} item${pendingReqs.length !== 1 ? 's' : ''} totaling KES ${fmt(pendingTotal)} still pending.`;

    // ── Performance highlights — scannable bullets, derived from the same
    // figures as the executive summary, not restated financial statements. ──
    const highlights: string[] = [
        `Net ${pl.netIncome >= 0 ? 'profit' : 'loss'} of KES ${fmt(pl.netIncome)} (${marginPct(pl.netIncome, pl.revenue.total)} margin)${netTrend ? `, ${netTrend}` : ''}.`,
        `Cash position of KES ${fmt(cashPosition)} as of period end${cashTrend ? `, ${cashTrend}` : ''}.`,
        `Requisition approval rate of ${approvalRate.toFixed(1)}% (${approved.length} of ${submitted.length} submitted).`,
    ];
    if (topCategories.length > 0) {
        highlights.push(`Largest spending category: ${topCategories[0].category} at ${pctOf(topCategories[0].amount, totalCategorySpend)} of total spend.`);
    }

    // ── Management actions — deterministic, derived from data already
    // computed above (no free-text generation): flag whatever actually needs
    // attention. Owner/due-date are intentionally left unset — no such data
    // exists in the system yet; the layout simply supports those fields. ──
    const overBudgetCategories = budgetRows.filter((b: any) => b.allocated > 0 && b.spent / b.allocated >= 0.9);
    const fullyOverBudget = budgetRows.filter((b: any) => b.allocated > 0 && b.spent / b.allocated >= 1);
    const actionItems: string[] = [];
    if (pendingReqs.length > 0) {
        actionItems.push(`Follow up on ${pendingReqs.length} pending requisition${pendingReqs.length !== 1 ? 's' : ''} totaling KES ${fmt(pendingTotal)} awaiting approval.`);
    }
    if (overBudgetCategories.length > 0) {
        actionItems.push(`Review budget allocations for ${overBudgetCategories.map((b: any) => b.category).join(', ')} — utilization has reached or exceeded 90% of the amount allocated for this period.`);
    }
    if (risks.length > 0) {
        actionItems.push(`Investigate ${risks.length} flagged transaction${risks.length !== 1 ? 's' : ''} identified as significantly above this period's average spend.`);
    }
    if (submitted.length > 0 && approvalRate < 70) {
        actionItems.push(`Approval rate for this period was ${approvalRate.toFixed(1)}%, below the typical target — consider reviewing the approval workflow for bottlenecks.`);
    }
    const actions = actionItems.map(a => ({ action: a, status: 'Open' }));

    // ── Board decisions required — escalated separately from routine
    // Management Actions: only what genuinely needs sign-off (a fully
    // exhausted budget line, or a high-severity spending exception), not
    // day-to-day follow-up. ──
    const boardDecisionItems: string[] = [];
    if (fullyOverBudget.length > 0) {
        boardDecisionItems.push(`Budget fully exhausted for ${fullyOverBudget.map((b: any) => b.category).join(', ')} — authorize further spend or reallocate budget.`);
    }
    const highRisks = risks.filter(r => r.severity === 'high');
    if (highRisks.length > 0) {
        boardDecisionItems.push(`${highRisks.length} high-severity spending exception${highRisks.length !== 1 ? 's' : ''} totaling KES ${fmt(highRisks.reduce((s, r) => s + r.amount, 0))} requires review and sign-off.`);
    }

    const balanceSheetLead = `Total assets of KES ${fmt(bs.assets.total)} are financed by KES ${fmt(bs.liabilities.total)} in liabilities and KES ${fmt(bs.equity.total)} in shareholders' equity${equityTrend ? `, ${equityTrend}` : ''}.`;
    const spendingAnalysisLead = topCategories.length > 0
        ? `${topCategories[0].category} was the largest cost category this period at ${pctOf(topCategories[0].amount, totalCategorySpend)} of total spend (KES ${fmt(topCategories[0].amount)}).`
        : 'No categorized spending recorded for this period.';

    // ── Assemble the report data (shared by the on-screen page and the PDF/CSV export) ──
    const reportData: ManagementReportData = {
        meta: {
            companyName,
            logoUrl: '/pesanest/pesanest-light-new.png',
            watermarkUrl: watermarkUrl ?? undefined,
            periodLabel,
            monthLabel,
            currency: 'KES',
            generatedLabel,
        },
        kpis: [
            { label: 'Net Revenue', value: fmt(pl.revenue.total), sub: `Total recognized revenue${revTrend ? `  ·  ${revTrend}` : ''}` },
            { label: 'Net Result', value: fmtSigned(pl.netIncome), sub: `${marginPct(pl.netIncome, pl.revenue.total)} margin${netTrend ? `  ·  ${netTrend}` : ''}` },
            { label: 'Cash Position', value: fmt(cashPosition), sub: `As of period end${cashTrend ? `  ·  ${cashTrend}` : ''}` },
            { label: 'Total Expenditure', value: fmt(pl.expenses.total), sub: `All operating expenses${expTrend ? `  ·  ${expTrend}` : ''}` },
            { label: 'Pending Approvals', value: fmt(pendingTotal), sub: `${pendingReqs.length} item${pendingReqs.length !== 1 ? 's' : ''}` },
        ],
        executiveSummary,
        highlights,
        risks,
        actions,
        boardDecisions: boardDecisionItems,
        budget,
        balanceSheetLead,
        spendingAnalysisLead,
        incomeStatement: {
            revenue: pl.revenue.accounts.map(a => ({ code: a.code, name: a.name, amount: a.balance })),
            expenses: pl.expenses.accounts.map(a => ({ code: a.code, name: a.name, amount: a.balance })),
            netIncome: pl.netIncome,
        },
        balanceSheet: {
            assets: bs.assets.accounts.map((a: any) => ({ code: a.code, name: a.name, amount: a.balance })),
            totalAssets: bs.assets.total,
            liabilities: bs.liabilities.accounts.map((a: any) => ({ code: a.code, name: a.name, amount: a.balance })),
            totalLiabilities: bs.liabilities.total,
            equity: bs.equity.accounts.map((a: any) => ({ code: a.code, name: a.name, amount: a.balance })),
            totalEquity: bs.equity.total,
        },
        cashFlow,
        cashPosition,
        spendingCategories: topCategories.map(c => ({
            category: c.category, amount: c.amount, count: c.count,
            pct: totalCategorySpend > 0 ? (c.amount / totalCategorySpend) * 100 : 0,
        })),
        pipeline: pipelineAll,
        transactions: requisitionsInPeriod.map((r: any) => ({
            date: new Date(r.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
            description: r.title,
            category: r.category || 'Uncategorized',
            requestedBy: r.user?.name || 'Unknown',
            status: r.status,
            amount: r.amount,
        })),
    };

    return (
        <div className={`${inter.className} pb-20 space-y-10 max-w-[1120px] relative`}>

            {/* ── Watermark: the company's own uploaded logo, faint, behind everything.
                 Negative z-index so it paints beneath normal-flow siblings regardless
                 of DOM order (an absolutely-positioned z-index:0 element would actually
                 paint ABOVE later static content per CSS stacking rules — this avoids that). ── */}
            {watermarkUrl && (
                <img
                    src={watermarkUrl}
                    alt=""
                    aria-hidden="true"
                    className="absolute top-[80px] left-1/2 -translate-x-1/2 w-[760px] max-w-[95%] opacity-[0.05] pointer-events-none select-none print:opacity-[0.05] -z-10"
                />
            )}

            {/* ── Masthead ── */}
            <div className="relative z-10 bg-white overflow-hidden" style={{ border: HAIRLINE, borderRadius: 12 }}>

                {/* A single accent band across the head of the letterhead —
                    the report's identity mark, the way a letterhead's rule
                    reads before any text does. */}
                <div className="h-[5px] w-full" style={{ background: '#059669' }} />

                {/* Logo row: Pesanest mark (left), company name (center), the
                    company's own uploadable logo (right) */}
                <div className="flex items-center justify-between gap-4 px-6 pt-5 pb-3">
                    <div className="flex items-center gap-2 shrink-0">
                        <BrandLogo width={28} height={28} color="#111827" />
                        <span className="text-[16px] font-[800] text-gray-900 tracking-[-0.01em]">Pesanest</span>
                    </div>
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

                {/* Title band — the document's title, given the scale a
                    letterhead masthead earns rather than an app toolbar's. */}
                <div className="flex items-end justify-between gap-4 px-6 pt-2 pb-5" style={{ borderTop: HAIRLINE }}>
                    <div>
                        <span className="inline-block text-[10.5px] font-[700] uppercase tracking-[0.12em] px-2.5 py-1 rounded-[5px] mb-2" style={{ color: '#047857', background: '#ECFDF5' }}>
                            {monthLabel}
                        </span>
                        <h1 className="text-[28px] font-[700] text-gray-900 tracking-[-0.02em] leading-none">Management Report</h1>
                    </div>
                    <p className="text-[11px] text-gray-400 text-right leading-[1.6] whitespace-nowrap">
                        {companyName}<br />Financial &amp; Operational Performance
                    </p>
                </div>

                {/* Metadata strip */}
                <div className="grid grid-cols-3 gap-4 px-6 py-4" style={{ borderTop: HAIRLINE, borderBottom: HAIRLINE, background: '#FAFAFA' }}>
                    <div>
                        <p className="text-[10px] font-[600] uppercase tracking-[0.08em] text-gray-400 mb-1">Period</p>
                        <p className="text-[12px] font-[500] text-gray-800">{periodLabel}</p>
                    </div>
                    <div>
                        <p className="text-[10px] font-[600] uppercase tracking-[0.08em] text-gray-400 mb-1">Generated</p>
                        <p className="text-[12px] font-[500] text-gray-800">{generatedLabel}</p>
                    </div>
                    <div>
                        <p className="text-[10px] font-[600] uppercase tracking-[0.08em] text-gray-400 mb-1">Currency</p>
                        <p className="text-[12px] font-[500] text-gray-800">KES</p>
                    </div>
                </div>

                {/* Company details + confidentiality mark */}
                <div className="px-6 py-3 flex flex-wrap items-center justify-between gap-x-6 gap-y-1.5">
                    <div className="flex flex-wrap gap-x-6 gap-y-1.5">
                        {registrationNumber && (
                            <p className="text-[11.5px] text-gray-500"><span className="text-gray-400">Reg. No:</span> {registrationNumber}</p>
                        )}
                        {headquartersAddress && (
                            <p className="text-[11.5px] text-gray-500"><span className="text-gray-400">Address:</span> {headquartersAddress}</p>
                        )}
                    </div>
                    <p className="text-[10px] font-[700] uppercase tracking-[0.08em]" style={{ color: '#dc2626' }}>Confidential — Internal Management Use</p>
                </div>
            </div>

            {/* ── Toolbar: export ── */}
            <div className="relative z-10 flex items-center justify-end -mt-2">
                <ManagementReportPdf data={reportData} />
            </div>

            {/* ── Period picker ── */}
            <div className="flex items-center gap-1 flex-wrap">
                {PRESETS.map(p => (
                    <Link key={p.key} href={pageUrl(p.key)}
                        className={`px-3.5 py-1.5 rounded-full text-[12px] font-[500] transition-colors border ${
                            activePreset === p.key
                                ? 'bg-[#059669] text-white border-[#059669]'
                                : 'bg-white text-gray-500 border-gray-200 hover:border-[#059669]/40 hover:text-[#059669]'
                        }`}>
                        {p.label}
                    </Link>
                ))}
            </div>

            {/* ═══ 01 · EXECUTIVE OVERVIEW ═══ */}
            <div className="space-y-5">
                <LayerHeading n={1} title="Executive Overview" />

                <Lead>
                    {companyName} reported a net {pl.netIncome >= 0 ? 'profit' : 'loss'} of {fmtSigned(pl.netIncome)}, a {marginPct(pl.netIncome, pl.revenue.total)} margin, on cash reserves of {fmt(cashPosition)}.
                </Lead>

                <SubTitle>Key Financial Metrics</SubTitle>
                <KpiBand items={reportData.kpis} />

                <SubTitle>Executive Summary</SubTitle>
                <p className="text-[13px] text-gray-600 leading-[1.75]">{executiveSummary}</p>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-1">
                    <div>
                        <SubTitle>Performance Highlights</SubTitle>
                        <ul className="space-y-2.5">
                            {highlights.map((h, i) => (
                                <li key={i} className="flex items-start gap-2.5 text-[12px] text-gray-600 leading-relaxed">
                                    <span className="w-[5px] h-[5px] rounded-full bg-[#059669] mt-[7px] shrink-0" />
                                    {h}
                                </li>
                            ))}
                        </ul>
                    </div>
                    <div>
                        <SubTitle>Key Risks & Exceptions</SubTitle>
                        <ul className="space-y-2.5">
                            {risks.length > 0 ? risks.slice(0, 3).map((r, i) => (
                                <li key={i} className="flex items-start gap-2.5 text-[12px] text-gray-600 leading-relaxed">
                                    <span className="w-[5px] h-[5px] rounded-full mt-[7px] shrink-0" style={{ background: SEV_COLOR[r.severity] }} />
                                    {r.title} — KES {fmt(r.amount)}
                                </li>
                            )) : <li className="text-[12px] text-gray-400 italic">No exceptions flagged this period.</li>}
                        </ul>
                    </div>
                    <div>
                        <SubTitle>Management Attention</SubTitle>
                        <ul className="space-y-2.5">
                            {actions.length > 0 ? actions.map((a, i) => (
                                <li key={i} className="flex items-start gap-2.5 text-[12px] text-gray-600 leading-relaxed">
                                    <span className="w-[5px] h-[5px] rounded-full bg-[#d97706] mt-[7px] shrink-0" />
                                    {a.action}
                                </li>
                            )) : <li className="text-[12px] text-gray-400 italic">No outstanding actions this period.</li>}
                        </ul>
                    </div>
                </div>

                <BoardDecisions items={boardDecisionItems} />

                <Callout>
                    Every figure is drawn from posted journal entries — voided entries are included as their offsetting reversal, never netted out or dropped. Nothing here is estimated or carried forward by hand.
                </Callout>
            </div>

            {/* ═══ 02 · FINANCIAL PERFORMANCE ═══ */}
            <div className="space-y-5">
                <LayerHeading n={2} title="Financial Performance" />

                <SubTitle>Income Statement</SubTitle>
                <Lead>
                    Revenue of KES {fmt(pl.revenue.total)} against expenses of KES {fmt(pl.expenses.total)} left a net {pl.netIncome >= 0 ? 'profit' : 'loss'} of KES {fmt(pl.netIncome)} for the period.
                </Lead>
                <StatementTable
                    groups={[
                        { label: 'Revenue', rows: pl.revenue.accounts.map(a => ({ name: `${a.code} · ${a.name}`, amount: a.balance })) },
                        { label: 'Operating Expenses', rows: pl.expenses.accounts.map(a => ({ name: `${a.code} · ${a.name}`, amount: -a.balance })) },
                    ]}
                    totalLabel="Net Income"
                    totalAmount={pl.netIncome}
                />

                <SubTitle>Balance Sheet</SubTitle>
                <Lead>{balanceSheetLead}</Lead>
                <StatementTable
                    groups={[
                        { label: 'Assets', rows: bs.assets.accounts.map(a => ({ name: `${a.code} · ${a.name}`, amount: a.balance })), subtotal: { label: 'Total Assets', amount: bs.assets.total } },
                        { label: 'Liabilities', rows: bs.liabilities.accounts.map(a => ({ name: `${a.code} · ${a.name}`, amount: a.balance })), subtotal: { label: 'Total Liabilities', amount: bs.liabilities.total } },
                        { label: 'Equity', rows: bs.equity.accounts.map(a => ({ name: `${a.code} · ${a.name}`, amount: a.balance })), subtotal: { label: 'Total Equity', amount: bs.equity.total } },
                    ]}
                    totalLabel="Total Liabilities & Equity"
                    totalAmount={bs.liabilities.total + bs.equity.total}
                />

                <SubTitle>Cash Flow Statement</SubTitle>
                <StatementTable
                    groups={[
                        { label: 'Operating Activities', rows: cashFlow.operating.items, subtotal: { label: 'Net Cash from Operating Activities', amount: cashFlow.operating.total } },
                        { label: 'Investing Activities', rows: cashFlow.investing.items, subtotal: { label: 'Net Cash from Investing Activities', amount: cashFlow.investing.total } },
                        { label: 'Financing Activities', rows: cashFlow.financing.items, subtotal: { label: 'Net Cash from Financing Activities', amount: cashFlow.financing.total } },
                    ]}
                    totalLabel="Net Increase / (Decrease) in Cash"
                    totalAmount={cashFlow.netChange}
                />
                <div className="flex items-center gap-3 px-1">
                    <span className="flex-1 text-[12px] text-gray-400">Cash Balance on Books</span>
                    <span className="text-[12px] font-mono tabular-nums text-gray-500">{fmt(cashPosition)}</span>
                </div>

                <SubTitle>Spending Analysis</SubTitle>
                <Lead>{spendingAnalysisLead}</Lead>
                <div className="bg-white overflow-hidden" style={{ border: HAIRLINE, borderRadius: 10 }}>
                    {topCategories.length === 0
                        ? <p className="px-5 py-5 text-[12px] text-gray-400 italic">No spending recorded this period</p>
                        : topCategories.slice(0, 8).map((c, i) => (
                            <CategoryBar key={c.category} category={c.category} amount={c.amount} count={c.count}
                                share={pctOf(c.amount, totalCategorySpend)} maxAmount={maxCategoryAmount} rank={i} />
                        ))
                    }
                </div>

                {budget.length > 0 && (
                    <>
                        <SubTitle>Budget vs Actual</SubTitle>
                        <BudgetTable rows={budget} />
                    </>
                )}
            </div>

            {/* ═══ 03 · OPERATIONS & CONTROLS ═══ */}
            <div className="space-y-5">
                <LayerHeading n={3} title="Operations & Controls" />

                <SubTitle>Requisition Pipeline</SubTitle>
                <Lead>
                    {submitted.length} requisition{submitted.length !== 1 ? 's' : ''} moved through approval this period — {approvalRate.toFixed(1)}% approved, {pendingReqs.length} still pending, {risks.length} flagged for review.
                </Lead>
                <PipelineTable stages={pipelineAll} />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                        <SubTitle>Risks & Alerts</SubTitle>
                        <div className="bg-white overflow-hidden" style={{ border: HAIRLINE, borderRadius: 10 }}>
                            {risks.length > 0
                                ? risks.map((r, i) => <RiskRow key={i} {...r} />)
                                : <p className="px-5 py-5 text-[12px] text-gray-400 italic">No spending alerts identified for this period.</p>
                            }
                        </div>
                    </div>

                    <div>
                        <SubTitle>Management Actions</SubTitle>
                        <div className="bg-white overflow-hidden" style={{ border: HAIRLINE, borderRadius: 10 }}>
                            {actions.length > 0 ? (
                                <>
                                    <div className="grid grid-cols-[1fr_100px_90px_80px] gap-3 px-5 py-2.5" style={{ borderBottom: HAIRLINE, background: '#FAFAFA' }}>
                                        <span className="text-[10px] font-[700] uppercase tracking-[0.08em] text-gray-400">Action</span>
                                        <span className="text-[10px] font-[700] uppercase tracking-[0.08em] text-gray-400">Owner</span>
                                        <span className="text-[10px] font-[700] uppercase tracking-[0.08em] text-gray-400">Due Date</span>
                                        <span className="text-[10px] font-[700] uppercase tracking-[0.08em] text-gray-400">Status</span>
                                    </div>
                                    {actions.map((a, i) => <ActionRow key={i} {...a} />)}
                                </>
                            ) : (
                                <p className="px-5 py-5 text-[12px] text-gray-400 italic">No outstanding actions this period.</p>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* ═══ 04 · APPENDICES ═══ */}
            <div className="space-y-5">
                <LayerHeading n={4} title="Appendices" />
                <SubTitle>A — Detailed Transactions ({requisitionsInPeriod.length})</SubTitle>
                <p className="text-[12px] text-gray-400 -mt-1 mb-2">Full itemized listing of every requisition recorded in the reporting period, for reference.</p>
                <div className="bg-white overflow-x-auto" style={{ border: HAIRLINE, borderRadius: 10 }}>
                    {requisitionsInPeriod.length === 0 ? (
                        <p className="px-5 py-5 text-[12px] text-gray-400 italic">No requisitions recorded in this period.</p>
                    ) : (
                        <table className="w-full text-[12px] min-w-[720px]">
                            <thead>
                                <tr style={{ borderBottom: HAIRLINE, background: '#FAFAFA' }}>
                                    <th className="text-left font-[700] text-gray-400 uppercase tracking-[0.05em] text-[10px] px-5 py-2.5">Date</th>
                                    <th className="text-left font-[700] text-gray-400 uppercase tracking-[0.05em] text-[10px] px-3 py-2.5">Description</th>
                                    <th className="text-left font-[700] text-gray-400 uppercase tracking-[0.05em] text-[10px] px-3 py-2.5">Category</th>
                                    <th className="text-left font-[700] text-gray-400 uppercase tracking-[0.05em] text-[10px] px-3 py-2.5">Requested By</th>
                                    <th className="text-left font-[700] text-gray-400 uppercase tracking-[0.05em] text-[10px] px-3 py-2.5">Status</th>
                                    <th className="text-right font-[700] text-gray-400 uppercase tracking-[0.05em] text-[10px] px-5 py-2.5">Amount</th>
                                </tr>
                            </thead>
                            <tbody>
                                {reportData.transactions.map((t, i) => (
                                    <tr key={i} style={{ borderBottom: HAIRLINE, background: i % 2 === 1 ? '#FAFAFA' : 'white' }}>
                                        <td className="px-5 py-2.5 text-gray-500 whitespace-nowrap">{t.date}</td>
                                        <td className="px-3 py-2.5 text-gray-800">{t.description}</td>
                                        <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap">{t.category}</td>
                                        <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap">{t.requestedBy}</td>
                                        <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap">{t.status}</td>
                                        <td className="px-5 py-2.5 text-right font-mono tabular-nums text-gray-900">{fmt(t.amount)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {/* ── Footer ── */}
            <div className="relative z-10 pt-5 flex items-center justify-between gap-4" style={{ borderTop: HAIRLINE }}>
                <div className="flex items-center gap-1.5 text-[11px] text-gray-400">
                    <span>{companyName} · CONFIDENTIAL · Powered by</span>
                    <BrandLogo width={16} height={16} color="#9ca3af" />
                    <span className="font-[700] text-gray-500">Pesanest</span>
                </div>
                <p className="text-[11px] text-gray-400">
                    All amounts in KES · Figures rounded to 2 decimal places
                </p>
            </div>
        </div>
    );
}
