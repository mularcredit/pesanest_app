import prisma from "@/lib/prisma";
import { auth } from "@/auth";
import { paystackService } from "@/lib/payments/paystack";
import { redirect } from "next/navigation";
import { StatsCard } from "@/components/dashboard/StatsCard";
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
} from "react-icons/pi";
import { WalletCard } from "@/components/dashboard/WalletCard";
import { DashboardQuickActions } from "@/components/dashboard/DashboardQuickActions";

const CARD_STYLE: React.CSSProperties = { border: '1px solid rgba(0,0,0,0.09)' };

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

    const isPrivileged = ['SYSTEM_ADMIN', 'FINANCE_APPROVER', 'MANAGER'].includes(currentUserWithPaystack?.role || '');
    const isSystemAdmin = currentUserWithPaystack?.role === 'SYSTEM_ADMIN';
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
        prisma.monthlyBudget.findMany({ where: { month: currentMonthNum, year: currentYear } }),
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
    const disbursedThisMonth   = thisMonthReqs.filter((r: any) => ['APPROVED', 'PAID'].includes(r.status));
    const disbursedTotal       = disbursedThisMonth.reduce((s: number, r: any) => s + r.amount, 0);
    const approvedAllTime      = allRequisitions.filter((r: any) => ['APPROVED', 'PAID'].includes(r.status)).length;
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

    // ── Sparklines (last 7 days) ──
    const sparkSubmitted = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(now); d.setDate(d.getDate() - (6 - i));
        const s = new Date(d.getFullYear(), d.getMonth(), d.getDate());
        const e = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
        return allRequisitions
            .filter((x: any) => { const xd = new Date(x.createdAt); return xd >= s && xd < e && x.status !== 'DRAFT'; })
            .reduce((sum: number, x: any) => sum + x.amount, 0);
    });
    const sparkDisbursed = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(now); d.setDate(d.getDate() - (6 - i));
        const s = new Date(d.getFullYear(), d.getMonth(), d.getDate());
        const e = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
        return allRequisitions
            .filter((x: any) => { const xd = new Date(x.createdAt); return xd >= s && xd < e && ['APPROVED','PAID'].includes(x.status); })
            .reduce((sum: number, x: any) => sum + x.amount, 0);
    });
    const sparkPending = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(now); d.setDate(d.getDate() - (6 - i));
        const cutoff = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
        return allRequisitions.filter((x: any) => new Date(x.createdAt) < cutoff && x.status === 'PENDING').length;
    });
    const sparkRate = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(now); d.setDate(d.getDate() - (6 - i));
        const cutoff = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
        const subset = allRequisitions.filter((x: any) => new Date(x.createdAt) < cutoff && x.status !== 'DRAFT');
        const app    = subset.filter((x: any) => ['APPROVED','PAID'].includes(x.status));
        return subset.length > 0 ? (app.length / subset.length) * 100 : 0;
    });

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
        { name: 'Draft',    key: 'DRAFT',    color: '#9ca3af', bg: 'rgba(156,163,175,0.08)' },
        { name: 'Pending',  key: 'PENDING',  color: '#f59e0b', bg: 'rgba(245,158,11,0.08)'  },
        { name: 'Approved', key: 'APPROVED', color: '#6366f1', bg: 'rgba(99,102,241,0.08)'  },
        { name: 'Paid',     key: 'PAID',     color: '#10b981', bg: 'rgba(16,185,129,0.08)'  },
        { name: 'Rejected', key: 'REJECTED', color: '#ef4444', bg: 'rgba(239,68,68,0.08)'   },
    ];
    const funnelStages: FunnelStage[] = FUNNEL_CFG.map(cfg => ({
        name:   cfg.name,
        count:  allRequisitions.filter((r: any) => r.status === cfg.key).length,
        amount: allRequisitions.filter((r: any) => r.status === cfg.key).reduce((s: number, r: any) => s + r.amount, 0),
        color:  cfg.color,
        bg:     cfg.bg,
    }));

    // ── Budget utilization ──
    const budgetRows = activeBudgets.map((b: any) => {
        const spent = allRequisitions
            .filter((r: any) => r.category === b.category && !['DRAFT','REJECTED'].includes(r.status))
            .reduce((s: number, r: any) => s + r.amount, 0);
        return { category: b.category, allocated: b.amount, spent };
    });

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

    return (
        <div className="space-y-6 pb-12">

            {/* ── HEADER ── */}
            <div className="flex items-end justify-between">
                <div>
                    <h1 className="text-[20px] font-[600] text-gray-900 tracking-tight">Expense Dashboard</h1>
                    <p className="text-[12.5px] text-gray-400 mt-0.5">
                        {now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })} · 30-day view
                    </p>
                </div>
                <Link href="/dashboard/reports"
                    className="flex items-center gap-1.5 px-4 py-2 rounded-[6px] text-[12.5px] font-[500] text-gray-600 bg-white hover:bg-gray-50 transition-colors"
                    style={CARD_STYLE}>
                    <PiDownloadSimple className="text-[14px]" /> Export
                </Link>
            </div>

            {/* ── STAT CARDS with sparklines ── */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatsCard
                    title="Submitted This Month"
                    value={`KES ${submittedTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
                    trend={monthOverMonthChange > 0 ? `+${monthOverMonthChange.toFixed(1)}%` : `${monthOverMonthChange.toFixed(1)}%`}
                    trendUp={monthOverMonthChange <= 0}
                    icon={PiReceipt}
                    color="indigo"
                    lastMonthLabel={`${submittedCount} report${submittedCount !== 1 ? 's' : ''} submitted`}
                    sparkline={sparkSubmitted}
                />
                <StatsCard
                    title="Pending Approval"
                    value={`KES ${pendingTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
                    trend={pendingCount === 0 ? "All clear" : `${pendingCount} item${pendingCount !== 1 ? 's' : ''}`}
                    trendUp={pendingCount === 0}
                    icon={PiClock}
                    color="amber"
                    lastMonthLabel="Awaiting review"
                    sparkline={sparkPending}
                />
                <StatsCard
                    title="Disbursed This Month"
                    value={`KES ${disbursedTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
                    trend={disbursedThisMonth.length === 0 ? "None yet" : `${disbursedThisMonth.length} paid`}
                    trendUp={disbursedThisMonth.length > 0}
                    icon={PiCoins}
                    color="emerald"
                    lastMonthLabel="Paid & reimbursed"
                    sparkline={sparkDisbursed}
                />
                <StatsCard
                    title="Approval Rate"
                    value={`${approvalRate.toFixed(1)}%`}
                    trend={rejectedCount > 0 ? `${rejectedCount} rejected` : "No rejections"}
                    trendUp={rejectedCount === 0}
                    icon={PiChartBar}
                    color="purple"
                    lastMonthLabel={`${approvedAllTime} of ${submittedAllTime} approved`}
                    sparkline={sparkRate}
                />
            </div>

            {/* ── MAIN GRID ── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* LEFT — charts + funnel + table */}
                <div className="lg:col-span-2 space-y-5">

                    {/* 12-month trend area chart */}
                    <OverviewChart data={monthlyData} />

                    {/* This month by week — bar chart */}
                    {weeklyData.some(w => w.amount > 0) && (
                        <WeeklyExpenseChart data={weeklyData} />
                    )}

                    {/* Month-over-month grouped bar chart */}
                    {top5Comparison.length > 0 && (
                        <MonthComparisonChart
                            data={top5Comparison}
                            thisMonthLabel={thisMonthLabel}
                            lastMonthLabel={lastMonthLabel}
                        />
                    )}

                    {/* Category spending breakdown */}
                    <CategoryBreakdown data={categoryData} totalAmount={totalCategoryAmount} />

                    {/* Expense funnel */}
                    <ExpenseFunnel stages={funnelStages} />

                    {/* Spending alerts */}
                    {recentLargeExpenses.length > 0 && (
                        <div className="bg-white rounded-[8px] overflow-hidden" style={CARD_STYLE}>
                            {/* Header */}
                            <div className="flex items-center justify-between px-5 py-3.5"
                                style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                                <div className="flex items-center gap-2.5">
                                    <span className="relative flex h-2 w-2 shrink-0">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-60" />
                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500" />
                                    </span>
                                    <span className="text-[13px] font-[600] text-gray-900">Spending Alerts</span>
                                </div>
                                <span className="text-[10.5px] font-[600] tabular-nums px-2 py-0.5 rounded-[4px]"
                                    style={{ background: 'rgba(239,68,68,0.07)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.15)' }}>
                                    {recentLargeExpenses.length} {recentLargeExpenses.length === 1 ? 'anomaly' : 'anomalies'}
                                </span>
                            </div>

                            {/* Rows */}
                            <div className="divide-y" style={{ '--tw-divide-opacity': 1 } as any}>
                                {recentLargeExpenses.map((exp: any, i: number) => {
                                    const multiple = (exp.amount / avgDailySpend).toFixed(1);
                                    return (
                                        <div key={exp.id} className="flex items-center gap-4 px-5 py-3.5"
                                            style={{ borderBottom: i < recentLargeExpenses.length - 1 ? '1px solid rgba(0,0,0,0.05)' : 'none' }}>
                                            {/* Icon */}
                                            <div className="w-8 h-8 rounded-[7px] shrink-0 flex items-center justify-center"
                                                style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.15)' }}>
                                                <PiWarning className="text-rose-500 text-[14px]" />
                                            </div>

                                            {/* Info */}
                                            <div className="flex-1 min-w-0">
                                                <p className="text-[12.5px] font-[500] text-gray-900 truncate">{exp.title}</p>
                                                {exp.category && (
                                                    <p className="text-[11px] text-gray-400 truncate mt-0.5">{exp.category}</p>
                                                )}
                                            </div>

                                            {/* Multiple badge */}
                                            <span className="text-[10px] font-[700] font-mono tabular-nums shrink-0 px-1.5 py-0.5 rounded-[4px]"
                                                style={{ background: 'rgba(239,68,68,0.07)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.12)' }}>
                                                {multiple}× avg
                                            </span>

                                            {/* Amount */}
                                            <span className="text-[12.5px] font-[600] font-mono tabular-nums shrink-0 text-gray-900">
                                                KES {Number(exp.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Recent transactions */}
                    <TransactionTable expenses={thisMonthReqs.slice(0, 10)} />
                </div>

                {/* RIGHT — wallet + gauge + status + budget */}
                <div className="space-y-5">
                    <WalletCard
                        balance={liveBalance}
                        currency={wallet?.currency === 'USD' ? 'KES' : (wallet?.currency ?? 'KES')}
                        branches={branchesData.map((b: { id: string; name: string }) => ({ id: b.id, name: b.name }))}
                        isPaystack={paystackConnected}
                        holderName={currentUserWithPaystack?.name || "Corporate Wallet"}
                    />

                    {/* Approval ring chart */}
                    <ApprovalGauge
                        approved={gaugeApproved}
                        pending={gaugePending}
                        rejected={gaugeRejected}
                    />

                    <ExpenseStatusSummary {...statusSummary} />

                    <DashboardQuickActions />

                    {/* Budget utilization */}
                    {budgetRows.length > 0 && <BudgetUtilization budgets={budgetRows} />}

                    {/* Active requisitions */}
                    {requisitions.length > 0 && (
                        <div className="bg-white rounded-[8px] overflow-hidden" style={CARD_STYLE}>
                            <div className="px-5 py-3.5 text-[10.5px] font-[500] uppercase tracking-[0.08em] text-gray-400"
                                style={{ borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
                                Active Expenses
                            </div>
                            <div className="p-4 space-y-2">
                                {requisitions.slice(0, 3).map((req: any) => (
                                    <div key={req.id} className="p-3.5 rounded-[8px]"
                                        style={{ border: '1px solid rgba(0,0,0,0.07)' }}>
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
