import prisma from "@/lib/prisma";
import { auth } from "@/auth";
import { paystackService } from "@/lib/payments/paystack";
import { redirect } from "next/navigation";
import { CARD_STYLE, HAIRLINE } from "@/components/dashboard/SectionHeader";
import { OverviewChart } from "@/components/dashboard/OverviewChart";
import { TransactionTable } from "@/components/dashboard/TransactionTable";
import { BudgetUtilization } from "@/components/dashboard/BudgetUtilization";
import { WeeklyExpenseChart } from "@/components/dashboard/WeeklyExpenseChart";
import { CategoryBreakdown } from "@/components/dashboard/CategoryBreakdown";
import { ExpenseStatusSummary } from "@/components/dashboard/ExpenseStatusSummary";
import { MonthComparisonChart } from "@/components/dashboard/MonthComparisonChart";
import { ApprovalGauge } from "@/components/dashboard/ApprovalGauge";
import { ExpenseFunnel, FunnelStage } from "@/components/dashboard/ExpenseFunnel";
import Link from "next/link";
import {
    PiReceipt,
    PiClock,
    PiCoins,
    PiDownloadSimple,
    PiChartBar,
    PiWarning,
    PiSparkle,
    PiArrowUp,
    PiArrowDown,
    PiFunnel,
    PiGaugeFill,
    PiListChecks,
} from "react-icons/pi";
import { WalletCard } from "@/components/dashboard/WalletCard";
import { DashboardQuickActions } from "@/components/dashboard/DashboardQuickActions";

export default async function DashboardPage() {
    const session = await auth();
    if (!session?.user?.id) return redirect("/login");

    const userId = session.user.id;
    const now = new Date();

    const currentUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { role: true, name: true }
    });

    if (!currentUser) return redirect("/api/auth/signout?callbackUrl=/login");

    // Fetch paystack status via raw SQL to avoid Prisma client schema mismatch
    const paystackRows = await prisma.$queryRaw<{ paystackCustomerCode: string | null }[]>`
        SELECT "paystackCustomerCode" FROM "User" WHERE id = ${userId} LIMIT 1
    `.catch(() => [{ paystackCustomerCode: null }]);
    const currentUserWithPaystack = { ...currentUser, paystackCustomerCode: paystackRows[0]?.paystackCustomerCode ?? null };

    const isPrivileged = ['SYSTEM_ADMIN', 'FINANCE_APPROVER', 'MANAGER', 'MASTER_VIEWER'].includes(currentUserWithPaystack?.role || '');
    const isSystemAdmin = currentUserWithPaystack?.role === 'SYSTEM_ADMIN' || currentUserWithPaystack?.role === 'MASTER_VIEWER';
    const expenseFilter = isPrivileged ? {} : { userId };

    const firstDayThisMonth = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const firstDayLastMonth = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
    const lastDayLastMonth  = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const currentMonthNum   = now.getMonth() + 1;
    const currentYear       = now.getFullYear();
    const oneYearAgo        = new Date(now.getFullYear(), now.getMonth() - 11, 1);

    const [
        activeBudgets,
        thisMonthExpenses,
        lastMonthExpenses,
        pendingApprovals,
        draftExpenses,
        allExpenses,
        allRequisitions,
        wallet,
        paystackBalances,
        requisitions,
        categories,
        branchesData,
        thisMonthSales,
    ] = await Promise.all([
        prisma.monthlyBudget.findMany({ where: { month: currentMonthNum, year: currentYear, status: 'APPROVED' }, include: { items: true } }),
        prisma.expense.findMany({ where: { ...expenseFilter, createdAt: { gte: firstDayThisMonth } }, orderBy: { createdAt: 'desc' } }),
        prisma.expense.findMany({ where: { ...expenseFilter, createdAt: { gte: firstDayLastMonth, lte: lastDayLastMonth } } }),
        prisma.expense.findMany({ where: { ...expenseFilter, status: { in: ['PENDING_APPROVAL', 'SUBMITTED'] } }, orderBy: { createdAt: 'desc' }, take: 10 }),
        prisma.expense.findMany({ where: { ...expenseFilter, status: 'DRAFT' } }),
        prisma.expense.findMany({ where: { ...expenseFilter, expenseDate: { gte: oneYearAgo } }, orderBy: { expenseDate: 'desc' } }),
        prisma.requisition.findMany({ where: { ...expenseFilter, createdAt: { gte: oneYearAgo } }, orderBy: { createdAt: 'desc' } }),
        prisma.wallet.findUnique({ where: { userId }, include: { transactions: { take: 5, orderBy: { createdAt: 'desc' } } } }),
        paystackService.getBalance().catch(() => []),
        prisma.requisition.findMany({ where: { userId, status: 'PENDING' } }),
        prisma.category.findMany({ where: { isActive: true }, select: { name: true } }),
        prisma.branch.findMany({ where: { isActive: true }, select: { id: true, name: true } }),
        isSystemAdmin
            ? prisma.sale.aggregate({ where: { issueDate: { gte: firstDayThisMonth }, status: { not: 'DRAFT' } }, _sum: { totalAmount: true } })
            : Promise.resolve({ _sum: { totalAmount: 0 } }),
    ]);

    // ── Wallet balance ──
    let liveBalance = wallet?.balance ?? 0;
    const targetCurrency = wallet?.currency || 'KES';
    const balanceData = (paystackBalances as any[]).find((b: any) =>
        b.currency?.toUpperCase() === targetCurrency.toUpperCase()
    );
    if (balanceData) liveBalance = balanceData.balance / 100;
    const paystackConnected = !!currentUserWithPaystack?.paystackCustomerCode;

    // ── Requisitions are the single source of truth for all financial data ──
    const thisMonthReqs  = allRequisitions.filter((r: any) => new Date(r.createdAt) >= firstDayThisMonth);
    const lastMonthReqs  = allRequisitions.filter((r: any) => {
        const d = new Date(r.createdAt);
        return d >= firstDayLastMonth && d <= lastDayLastMonth;
    });

    // ── KPIs ──
    const submittedThisMonth   = thisMonthReqs.filter((r: any) => r.status !== 'DRAFT');
    const submittedTotal       = submittedThisMonth.reduce((s: number, r: any) => s + r.amount, 0);
    const submittedCount       = submittedThisMonth.length;
    const lastMonthTotal       = lastMonthReqs.filter((r: any) => r.status !== 'DRAFT').reduce((s: number, r: any) => s + r.amount, 0);
    const monthOverMonthChange = lastMonthTotal > 0 ? ((submittedTotal - lastMonthTotal) / lastMonthTotal) * 100 : 0;
    const pendingReqs          = allRequisitions.filter((r: any) => r.status === 'PENDING');
    const pendingTotal         = pendingReqs.reduce((s: number, r: any) => s + r.amount, 0);
    const pendingCount         = pendingReqs.length;
    // "Disbursed" means it ever cleared the approval gate — APPROVED, PAID, CLOSED, FULFILLED,
    // PARTIALLY_PAID all qualify, since a requisition can't reach those without having been
    // approved first. Checking only for a *current* status of APPROVED/PAID undercounts badly,
    // since most approved requisitions move on to PAID → CLOSED/FULFILLED and no longer match.
    const undecidedOrRejectedStatuses = ['DRAFT', 'PENDING', 'REJECTED', 'NEEDS_INFO', 'ADJUSTMENT_REQUIRED'];
    const disbursedThisMonth   = thisMonthReqs.filter((r: any) => !undecidedOrRejectedStatuses.includes(r.status));
    const disbursedTotal       = disbursedThisMonth.reduce((s: number, r: any) => s + r.amount, 0);
    const approvedAllTime      = allRequisitions.filter((r: any) => !undecidedOrRejectedStatuses.includes(r.status)).length;
    const submittedAllTime     = allRequisitions.filter((r: any) => r.status !== 'DRAFT').length;
    const approvalRate         = submittedAllTime > 0 ? (approvedAllTime / submittedAllTime) * 100 : 0;
    const rejectedCount        = allRequisitions.filter((r: any) => r.status === 'REJECTED').length;

    // ── Category breakdown ──
    const categorySpending = allRequisitions.reduce((acc: any, r: any) => {
        if (!r.category) return acc;
        acc[r.category] = (acc[r.category] || 0) + r.amount;
        return acc;
    }, {});

    // ── Weekly data (current month) ──
    const weeklyData = [0, 1, 2, 3].map(week => {
        const weekStart = new Date(now.getFullYear(), now.getMonth(), week * 7 + 1);
        const weekEnd   = new Date(now.getFullYear(), now.getMonth(), (week + 1) * 7 + 1);
        const isCurrentWeek = now >= weekStart && now < weekEnd;
        const amount = thisMonthReqs.filter((r: any) => {
            const d = new Date(r.createdAt);
            return d >= weekStart && d < weekEnd && r.status !== 'DRAFT';
        }).reduce((s: number, r: any) => s + r.amount, 0);
        return { week: `Week ${week + 1}`, amount, isCurrentWeek };
    });

    // ── Category breakdown data ──
    const categoryData = Object.entries(categorySpending)
        .sort(([, a]: any, [, b]: any) => b - a)
        .slice(0, 8)
        .map(([category, amount]) => ({
            category,
            amount: amount as number,
            count: allRequisitions.filter((r: any) => r.category === category).length,
        }));
    const totalCategoryAmount = categoryData.reduce((s, c) => s + c.amount, 0);

    // ── Status summary ──
    const byStatus = (s: string | string[]) => {
        const statuses = Array.isArray(s) ? s : [s];
        const items = allRequisitions.filter((r: any) => statuses.includes(r.status));
        return { count: items.length, amount: items.reduce((sum: number, r: any) => sum + r.amount, 0) };
    };
    const statusSummary = {
        draft:     byStatus('DRAFT'),
        submitted: byStatus('PENDING'),
        pending:   { count: 0, amount: 0 },
        approved:  byStatus('APPROVED'),
        paid:      byStatus('PAID'),
        rejected:  byStatus('REJECTED'),
    };

    // ── Month-over-month comparison ──
    const thisMonthCatSpend = thisMonthReqs.reduce((acc: any, r: any) => {
        if (!r.category) return acc;
        acc[r.category] = (acc[r.category] || 0) + r.amount;
        return acc;
    }, {});
    const lastMonthCatSpend = lastMonthReqs.reduce((acc: any, r: any) => {
        if (!r.category) return acc;
        acc[r.category] = (acc[r.category] || 0) + r.amount;
        return acc;
    }, {});
    const top5Comparison = Object.entries(categorySpending)
        .sort(([, a]: any, [, b]: any) => b - a)
        .slice(0, 5)
        .map(([cat]) => ({
            category: cat.length > 11 ? cat.slice(0, 9) + '..' : cat,
            thisMonth: (thisMonthCatSpend[cat] as number) || 0,
            lastMonth: (lastMonthCatSpend[cat] as number) || 0,
        }));
    const thisMonthLabel = now.toLocaleDateString('en-US', { month: 'short' });
    const lastMonthLabel = new Date(now.getFullYear(), now.getMonth() - 1, 1).toLocaleDateString('en-US', { month: 'short' });

    // ── Approval gauge ──
    const gaugeApproved = approvedAllTime;
    const gaugePending  = pendingCount;
    const gaugeRejected = rejectedCount;

    // ── Funnel stages (requisition statuses) ──
    const FUNNEL_CFG: { name: string; key: string; color: string; bg: string }[] = [
        { name: 'Draft',    key: 'DRAFT',    color: '#6b7280', bg: 'rgba(107,114,128,0.08)' },
        { name: 'Pending',  key: 'PENDING',  color: '#d97706', bg: 'rgba(217,119,6,0.08)'   },
        { name: 'Approved', key: 'APPROVED', color: '#059669', bg: 'rgba(5,150,105,0.08)'   },
        { name: 'Paid',     key: 'PAID',     color: '#059669', bg: 'rgba(5,150,105,0.08)'   },
        { name: 'Rejected', key: 'REJECTED', color: '#dc2626', bg: 'rgba(220,38,38,0.08)'   },
    ];
    const funnelStages: FunnelStage[] = FUNNEL_CFG.map(cfg => ({
        name:   cfg.name,
        count:  allRequisitions.filter((r: any) => r.status === cfg.key).length,
        amount: allRequisitions.filter((r: any) => r.status === cfg.key).reduce((s: number, r: any) => s + r.amount, 0),
        color:  cfg.color,
        bg:     cfg.bg,
    }));

    // ── Budget utilization — flatten each approved budget's line items
    // (category + amount live on BudgetItem, not on MonthlyBudget itself) ──
    const budgetRows = activeBudgets.flatMap((b: any) =>
        b.items.map((item: any) => {
            const spent = allRequisitions
                .filter((r: any) => r.category === item.category && !['DRAFT','REJECTED'].includes(r.status))
                .reduce((s: number, r: any) => s + r.amount, 0);
            return { category: item.category, allocated: item.amount, spent };
        })
    );

    // ── Spending alerts ──
    const avgDailySpend       = allRequisitions.length > 0 ? allRequisitions.reduce((s: number, r: any) => s + r.amount, 0) / 30 : 0;
    const recentLargeExpenses = allRequisitions.filter((r: any) => r.amount > avgDailySpend * 3).slice(0, 3);

    // ── 12-month trend (requisitions only — they are the expenses) ──
    const monthlyData = [];
    for (let i = 11; i >= 0; i--) {
        const from = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const to   = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
        const amount = allRequisitions
            .filter((r: any) => { const d = new Date(r.createdAt); return d >= from && d < to; })
            .reduce((s: number, r: any) => s + r.amount, 0);
        monthlyData.push({ month: from.toLocaleDateString('en-US', { month: 'short' }), amount });
    }

    const hour = now.getHours();
    const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
    const firstName = (currentUser.name || '').trim().split(/\s+/)[0] || '';

    const hasBudget = budgetRows.length > 0;
    const hasAlerts = recentLargeExpenses.length > 0;

    // Ghost stats folded into the hero band itself, replacing a separate row
    // of four white KPI cards — the real trend visualization now lives in
    // the hero chart below, so these stay lean: label, number, one signal.
    const heroStats = [
        {
            label: 'Submitted', icon: PiReceipt,
            value: `KES ${submittedTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
            trend: monthOverMonthChange > 0 ? `+${monthOverMonthChange.toFixed(0)}%` : `${monthOverMonthChange.toFixed(0)}%`,
            trendUp: monthOverMonthChange <= 0,
        },
        {
            label: 'Pending Approval', icon: PiClock,
            value: `KES ${pendingTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
            trend: pendingCount === 0 ? 'All clear' : `${pendingCount} item${pendingCount !== 1 ? 's' : ''}`,
            trendUp: pendingCount === 0,
        },
        {
            label: 'Disbursed', icon: PiCoins,
            value: `KES ${disbursedTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
            trend: disbursedThisMonth.length === 0 ? 'None yet' : `${disbursedThisMonth.length} paid`,
            trendUp: disbursedThisMonth.length > 0,
        },
        {
            label: 'Approval Rate', icon: PiChartBar,
            value: `${approvalRate.toFixed(0)}%`,
            trend: rejectedCount > 0 ? `${rejectedCount} rejected` : 'No rejections',
            trendUp: rejectedCount === 0,
        },
    ];

    return (
        <div className="space-y-4 pb-6 relative">
            {/* ── HERO BAND — greeting, export, and the month's vitals folded into one object ── */}
            <div className="relative overflow-hidden rounded-[20px] px-6 pt-5 pb-6"
                style={{
                    background: 'linear-gradient(120deg, #054F27 0%, #007A3D 48%, #0E8F46 100%)',
                    boxShadow: '0 1px 2px rgba(0,58,25,0.1), 0 16px 32px -12px rgba(0,58,25,0.35)',
                }}>
                <div className="absolute inset-0 pointer-events-none" style={{
                    backgroundImage: 'url(/card-waves.jpeg)', backgroundSize: 'cover', backgroundPosition: 'center',
                    opacity: 0.08, mixBlendMode: 'screen',
                }} />
                <div className="absolute inset-0 pointer-events-none" style={{
                    background: 'radial-gradient(120% 140% at 85% 0%, rgba(255,255,255,0.14) 0%, rgba(255,255,255,0) 55%)',
                }} />

                <div className="relative z-10 flex items-end justify-between flex-wrap gap-4">
                    <div>
                        <div className="flex items-center gap-2 mb-1.5">
                            <PiSparkle className="text-[13px]" style={{ color: 'rgba(255,255,255,0.65)' }} />
                            <span className="text-[11px] font-[600] uppercase tracking-[0.1em]" style={{ color: 'rgba(255,255,255,0.65)' }}>
                                {greeting}{firstName ? `, ${firstName}` : ''}
                            </span>
                        </div>
                        <h1 className="text-[26px] font-[700] tracking-tight text-white">
                            Expense Dashboard
                        </h1>
                        <p className="text-[13px] mt-1" style={{ color: 'rgba(255,255,255,0.7)' }}>
                            {now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })} · 30-day view
                        </p>
                    </div>
                    <Link href="/dashboard/reports"
                        className="rounded-[10px] flex items-center gap-1.5 px-4 py-2.5 text-[12.5px] font-[600] transition-all hover:brightness-110 active:scale-[0.98] shrink-0"
                        style={{ background: 'rgba(255,255,255,0.14)', color: '#fff', border: '1px solid rgba(255,255,255,0.18)' }}>
                        <PiDownloadSimple className="text-[14px]" /> Export
                    </Link>
                </div>

                <div className="relative z-10 h-px my-5" style={{ background: 'rgba(255,255,255,0.14)' }} />

                <div className="relative z-10 grid grid-cols-2 md:grid-cols-4 gap-y-4 gap-x-6">
                    {heroStats.map(s => (
                        <div key={s.label}>
                            <div className="flex items-center gap-1.5 mb-1.5">
                                <s.icon className="text-[12px]" style={{ color: 'rgba(255,255,255,0.55)' }} />
                                <span className="text-[10px] font-[600] uppercase tracking-[0.08em]" style={{ color: 'rgba(255,255,255,0.55)' }}>
                                    {s.label}
                                </span>
                            </div>
                            <p className="text-[19px] font-[700] text-white tabular-nums leading-none mb-1.5 truncate">{s.value}</p>
                            <span className="inline-flex items-center gap-0.5 text-[10.5px] font-[600]"
                                style={{ color: s.trendUp ? '#6EE7B7' : '#FCA5A5' }}>
                                {s.trendUp ? <PiArrowUp className="text-[9px]" /> : <PiArrowDown className="text-[9px]" />}
                                {s.trend}
                            </span>
                        </div>
                    ))}
                </div>
            </div>

            {/* ── ZONE 2 — the hero chart paired directly with the wallet, not stacked below it ── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-stretch">
                <div className="lg:col-span-2">
                    <OverviewChart data={monthlyData} />
                </div>
                <WalletCard
                    balance={liveBalance}
                    currency={wallet?.currency === 'USD' ? 'KES' : (wallet?.currency ?? 'KES')}
                    branches={branchesData.map((b: { id: string; name: string }) => ({ id: b.id, name: b.name }))}
                    isPaystack={paystackConnected}
                    holderName={currentUserWithPaystack?.name || "Fahari Wallet"}
                />
            </div>

            {/* ── ZONE 3 — analysis trio, equal weight, read left-to-right ── */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {weeklyData.some(w => w.amount > 0) && (
                    <WeeklyExpenseChart data={weeklyData} compact />
                )}
                {top5Comparison.length > 0 && (
                    <MonthComparisonChart
                        data={top5Comparison}
                        thisMonthLabel={thisMonthLabel}
                        lastMonthLabel={lastMonthLabel}
                        compact
                    />
                )}
                <CategoryBreakdown data={categoryData} totalAmount={totalCategoryAmount} compact />
            </div>

            {/* ── ZONE 4 — "Where Things Stand": pipeline, approval outcomes and status
                 merged into one object instead of three disconnected cards ── */}
            <div className="bg-white rounded-[20px] overflow-hidden" style={CARD_STYLE}>
                <div className="px-5 py-4" style={{ borderBottom: HAIRLINE }}>
                    <h2 className="text-[13.5px] font-[600] text-gray-900">Where Things Stand</h2>
                    <p className="text-[11.5px] text-gray-400 mt-0.5">Pipeline, outcomes and review stage, at a glance</p>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-3">
                    <div className="p-5" style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                        <div className="flex items-center gap-2 mb-4">
                            <PiFunnel className="text-[13px]" style={{ color: '#D97706' }} />
                            <span className="text-[11px] font-[600] uppercase tracking-[0.07em] text-gray-400">Expense Pipeline</span>
                        </div>
                        <ExpenseFunnel stages={funnelStages} bare />
                    </div>
                    <div className="p-5 lg:border-x" style={{ borderColor: 'rgba(0,0,0,0.06)', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                        <div className="flex items-center gap-2 mb-4">
                            <PiGaugeFill className="text-[13px]" style={{ color: '#059669' }} />
                            <span className="text-[11px] font-[600] uppercase tracking-[0.07em] text-gray-400">Approval Rate</span>
                        </div>
                        <ApprovalGauge approved={gaugeApproved} pending={gaugePending} rejected={gaugeRejected} bare />
                    </div>
                    <div className="p-5">
                        <div className="flex items-center gap-2 mb-4">
                            <PiListChecks className="text-[13px]" style={{ color: '#6366F1' }} />
                            <span className="text-[11px] font-[600] uppercase tracking-[0.07em] text-gray-400">By Status</span>
                        </div>
                        <ExpenseStatusSummary {...statusSummary} bare />
                    </div>
                </div>
            </div>

            {/* ── ZONE 5 — budget discipline and anomalies, side by side ── */}
            {(hasBudget || hasAlerts) && (
                <div className={hasBudget && hasAlerts ? "grid grid-cols-1 lg:grid-cols-2 gap-4" : ""}>
                    {hasBudget && <BudgetUtilization budgets={budgetRows} />}
                    {hasAlerts && (
                        <div className="bg-white rounded-[16px] overflow-hidden" style={CARD_STYLE}>
                            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: HAIRLINE }}>
                                <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0 relative"
                                        style={{ background: 'rgba(220,38,38,0.1)' }}>
                                        <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-70" />
                                            <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500" />
                                        </span>
                                        <PiWarning className="text-rose-500 text-[16px]" />
                                    </div>
                                    <div>
                                        <span className="text-[13.5px] font-[600] text-gray-900">Spending Alerts</span>
                                        <p className="text-[11.5px] text-gray-400 mt-0.5">Unusually large requests this period</p>
                                    </div>
                                </div>
                                <span className="text-[10.5px] font-[600] tabular-nums px-2.5 py-1 rounded-[6px]"
                                    style={{ background: 'rgba(220,38,38,0.08)', color: '#dc2626' }}>
                                    {recentLargeExpenses.length} {recentLargeExpenses.length === 1 ? 'anomaly' : 'anomalies'}
                                </span>
                            </div>
                            <div>
                                {recentLargeExpenses.map((exp: any, i: number) => {
                                    const multiple = (exp.amount / avgDailySpend).toFixed(1);
                                    return (
                                        <div key={exp.id} className="flex items-center gap-4 px-5 py-3.5"
                                            style={{ borderBottom: i < recentLargeExpenses.length - 1 ? '1px solid rgba(0,0,0,0.06)' : 'none' }}>
                                            <div className="w-8 h-8 rounded-[8px] shrink-0 flex items-center justify-center"
                                                style={{ background: 'rgba(220,38,38,0.07)' }}>
                                                <PiWarning className="text-rose-500 text-[14px]" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-[12.5px] font-[500] text-gray-900 truncate">{exp.title}</p>
                                                {exp.category && (
                                                    <p className="text-[11px] text-gray-400 truncate mt-0.5">{exp.category}</p>
                                                )}
                                            </div>
                                            <span className="text-[10px] font-[700] font-mono tabular-nums shrink-0 px-1.5 py-0.5 rounded-[5px]"
                                                style={{ background: 'rgba(220,38,38,0.07)', color: '#dc2626' }}>
                                                {multiple}× avg
                                            </span>
                                            <span className="text-[12.5px] font-[600] font-mono tabular-nums shrink-0 text-gray-900">
                                                KES {Number(exp.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ── ZONE 6 — activity feed, with quick access and active items as a footer rail ── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="lg:col-span-2">
                    <TransactionTable expenses={thisMonthReqs.slice(0, 10)} />
                </div>
                <div className="space-y-4">
                    <DashboardQuickActions />
                    {requisitions.length > 0 && (
                        <div className="bg-white rounded-[16px] overflow-hidden" style={CARD_STYLE}>
                            <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: HAIRLINE }}>
                                <span className="text-[10.5px] font-[600] uppercase tracking-[0.08em] text-gray-400">Active Expenses</span>
                                <span className="text-[10.5px] font-[600] tabular-nums px-2 py-0.5 rounded-[5px] text-gray-500" style={{ background: 'rgba(0,0,0,0.04)' }}>
                                    {requisitions.length}
                                </span>
                            </div>
                            <div className="p-3.5 space-y-2">
                                {requisitions.slice(0, 3).map((req: any) => (
                                    <div key={req.id} className="p-3.5 rounded-[11px] hover:bg-gray-50/60 transition-colors"
                                        style={{ border: '1px solid rgba(15,23,42,0.06)' }}>
                                        <div className="flex justify-between items-start">
                                            <div className="flex-1 min-w-0 pr-3">
                                                <p className="text-[12.5px] font-[500] text-gray-900 truncate">{req.title}</p>
                                                <p className="text-[10.5px] text-gray-400 mt-0.5 uppercase tracking-[0.05em]">{req.category}</p>
                                            </div>
                                            <span className="text-[12.5px] font-[600] text-gray-900 font-mono whitespace-nowrap">
                                                KES {req.amount.toFixed(2)}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
