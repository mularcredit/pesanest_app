import prisma from "@/lib/prisma";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import {
    PiTrendUp, PiTrendDown, PiChartPieSlice,
    PiCheckCircle, PiClock, PiFileText, PiBookOpenText,
} from "react-icons/pi";
import { AnalyticsCharts } from "@/components/dashboard/AnalyticsCharts";

const CARD: React.CSSProperties = { border: '1px solid rgba(0,0,0,0.09)' };

export default async function ReportsPage({ searchParams }: { searchParams: { branch?: string } }) {
    const session = await auth();
    if (!session?.user?.id) return redirect("/login");

    const branch = searchParams?.branch || 'all';
    const userId = session.user.id;

    const reqs = await prisma.requisition.findMany({
        where: {
            userId,
            ...(branch !== 'all' ? { branch } : {}),
        },
        orderBy: { createdAt: 'desc' },
    });

    // Monthly data — last 6 months
    const months: string[] = [];
    const monthlyStats: Record<string, { expense: number; revenue: number }> = {};
    const today = new Date();
    for (let i = 5; i >= 0; i--) {
        const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
        const key = d.toLocaleString('default', { month: 'short', year: '2-digit' });
        months.push(key);
        monthlyStats[key] = { expense: 0, revenue: 0 };
    }
    reqs.forEach((r: any) => {
        const key = new Date(r.createdAt).toLocaleString('default', { month: 'short', year: '2-digit' });
        if (monthlyStats[key]) monthlyStats[key].expense += r.amount;
    });
    const monthlyData = months.map(m => ({ month: m, expense: monthlyStats[m].expense, revenue: 0 }));

    // Category breakdown
    const categoryTotals: Record<string, number> = {};
    reqs.forEach((r: any) => {
        categoryTotals[r.category] = (categoryTotals[r.category] || 0) + r.amount;
    });
    const categoryData = Object.entries(categoryTotals).map(([name, amount]) => ({ name, amount }));

    // Status breakdown
    const statusCounts: Record<string, number> = {};
    reqs.forEach((r: any) => { statusCounts[r.status] = (statusCounts[r.status] || 0) + 1; });
    const statusData = Object.entries(statusCounts).map(([status, count]) => ({ status, count }));

    // Totals
    const totalAmount  = reqs.reduce((s: number, r: any) => s + r.amount, 0);
    const approved     = reqs.filter((r: any) => r.status === 'APPROVED').length;
    const pending      = reqs.filter((r: any) => r.status === 'PENDING').length;
    const approvalRate = reqs.length > 0 ? Math.round((approved / reqs.length) * 100) : 0;

    const fmt = (n: number) => `KES ${n.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

    const STATS = [
        {
            label: 'Total Submitted',
            value: fmt(totalAmount),
            sub: `${reqs.length} requisitions`,
            icon: PiChartPieSlice,
            color: '#6366f1',
            bg: 'bg-indigo-50',
        },
        {
            label: 'Approved',
            value: approved.toString(),
            sub: `${approvalRate}% approval rate`,
            icon: PiCheckCircle,
            color: '#10b981',
            bg: 'bg-emerald-50',
        },
        {
            label: 'Pending Review',
            value: pending.toString(),
            sub: 'Awaiting decision',
            icon: PiClock,
            color: '#f59e0b',
            bg: 'bg-amber-50',
        },
        {
            label: 'This Month',
            value: fmt(monthlyStats[months[months.length - 1]]?.expense ?? 0),
            sub: 'Current month spend',
            icon: approvalRate >= 50 ? PiTrendUp : PiTrendDown,
            color: approvalRate >= 50 ? '#10b981' : '#ef4444',
            bg: approvalRate >= 50 ? 'bg-emerald-50' : 'bg-rose-50',
        },
    ];

    return (
        <div className="space-y-6">

            {/* Header */}
            <div className="flex items-end justify-between">
                <div>
                    <h1 className="text-[20px] font-[700] text-gray-900">Analytics</h1>
                    <p className="text-[12.5px] text-gray-400 mt-0.5">
                        Expense performance · {today.toLocaleString('default', { month: 'long', year: 'numeric' })}
                    </p>
                </div>
            </div>

            {/* Stat cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {STATS.map(({ label, value, sub, icon: Icon, color, bg }) => (
                    <div key={label} className="bg-white rounded-[8px] p-4" style={CARD}>
                        <div className="flex items-center justify-between mb-3">
                            <p className="text-[11px] font-[500] text-gray-400 uppercase tracking-[0.06em]">{label}</p>
                            <div className={`w-7 h-7 rounded-[6px] flex items-center justify-center ${bg}`}>
                                <Icon className="text-[14px]" style={{ color }} />
                            </div>
                        </div>
                        <p className="text-[20px] font-[700] text-gray-900 leading-none tabular-nums">{value}</p>
                        <p className="text-[11px] text-gray-400 mt-1">{sub}</p>
                    </div>
                ))}
            </div>

            {/* Charts */}
            <AnalyticsCharts
                categoryData={categoryData}
                monthlyData={monthlyData}
                statusData={statusData}
            />

            {/* Bottom row: category leaderboard + quick links */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

                {/* Top categories */}
                <div className="bg-white rounded-[8px] p-5" style={CARD}>
                    <h3 className="text-[13px] font-[600] text-gray-900 mb-4">Top Categories</h3>
                    {categoryData.length === 0 ? (
                        <p className="text-[12px] text-gray-400 py-4 text-center">No data yet</p>
                    ) : (
                        <div className="space-y-3">
                            {categoryData.sort((a, b) => b.amount - a.amount).slice(0, 5).map((cat, i) => {
                                const pct = totalAmount > 0 ? (cat.amount / totalAmount) * 100 : 0;
                                return (
                                    <div key={i}>
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-[12px] font-[500] text-gray-700">{cat.name}</span>
                                            <span className="text-[11.5px] font-[600] text-gray-500 tabular-nums">
                                                KES {cat.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                            </span>
                                        </div>
                                        <div className="h-[5px] rounded-full overflow-hidden"
                                            style={{ background: 'rgba(0,0,0,0.05)' }}>
                                            <div className="h-full rounded-full"
                                                style={{ width: `${pct}%`, background: '#6366f1' }} />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Quick links */}
                <div className="flex flex-col gap-3">
                    <a href="/dashboard/accounting/reports/balance-sheet"
                        className="bg-white rounded-[8px] p-4 flex items-center justify-between group hover:bg-gray-50 transition-colors"
                        style={CARD}>
                        <div>
                            <p className="text-[13px] font-[600] text-gray-900 group-hover:text-[#6366f1] transition-colors">
                                Balance Sheet
                            </p>
                            <p className="text-[11.5px] text-gray-400 mt-0.5">Assets, liabilities & equity</p>
                        </div>
                        <PiFileText className="text-[18px] text-gray-300 group-hover:text-[#6366f1] transition-colors" />
                    </a>
                    <a href="/dashboard/accounting/ledger"
                        className="bg-white rounded-[8px] p-4 flex items-center justify-between group hover:bg-gray-50 transition-colors"
                        style={CARD}>
                        <div>
                            <p className="text-[13px] font-[600] text-gray-900 group-hover:text-[#6366f1] transition-colors">
                                General Ledger
                            </p>
                            <p className="text-[11.5px] text-gray-400 mt-0.5">Detailed transaction record</p>
                        </div>
                        <PiBookOpenText className="text-[18px] text-gray-300 group-hover:text-[#6366f1] transition-colors" />
                    </a>
                    <a href="/dashboard/requisitions"
                        className="bg-white rounded-[8px] p-4 flex items-center justify-between group hover:bg-gray-50 transition-colors"
                        style={CARD}>
                        <div>
                            <p className="text-[13px] font-[600] text-gray-900 group-hover:text-[#6366f1] transition-colors">
                                All Expenses
                            </p>
                            <p className="text-[11.5px] text-gray-400 mt-0.5">View full expense history</p>
                        </div>
                        <PiChartPieSlice className="text-[18px] text-gray-300 group-hover:text-[#6366f1] transition-colors" />
                    </a>
                </div>
            </div>
        </div>
    );
}
