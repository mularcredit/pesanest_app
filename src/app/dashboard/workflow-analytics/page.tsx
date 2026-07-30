'use client';

import { useState, useEffect } from 'react';
import {
    PiCheckCircle, PiXCircle, PiClock, PiWarning,
    PiUsers, PiSpinner,
} from 'react-icons/pi';
import { EscalationPanel } from '@/components/workflow/DelegationEscalation';
import { CustomSelect } from "@/components/ui/CustomSelect";

const CARD: React.CSSProperties = { border: '1px solid rgba(0,0,0,0.09)' };
const SELECT = "bg-white rounded-[6px] px-3 py-2 text-[12.5px] font-[500] text-gray-700 outline-none";

interface AnalyticsData {
    summary: {
        total: number;
        approved: number;
        rejected: number;
        pending: number;
        delegated: number;
        approvalRate: number;
        avgResponseTimeHours: number;
        overdueCount: number;
    };
    byLevel: Record<number, any>;
    byCategory: Record<string, any>;
    dailyTrend: Array<{ date: string; total: number; approved: number; rejected: number; pending: number }>;
    overdueApprovals: Array<any>;
    topApprovers?: Array<any>;
    period: { days: number; scope: string };
}

export default function WorkflowAnalyticsPage() {
    const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
    const [loading, setLoading]     = useState(true);
    const [scope, setScope]         = useState<'personal' | 'system'>('personal');
    const [days, setDays]           = useState(30);

    useEffect(() => { fetchAnalytics(); }, [scope, days]);

    const fetchAnalytics = async () => {
        setLoading(true);
        try {
            const res  = await fetch(`/api/workflow/analytics?scope=${scope}&days=${days}`);
            const data = await res.json();
            setAnalytics(data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    if (loading || !analytics) {
        return (
            <div className="flex items-center justify-center min-h-[50vh]">
                <PiSpinner className="animate-spin text-[28px] text-[#6366f1]" />
            </div>
        );
    }

    const { summary, dailyTrend, byCategory, overdueApprovals, topApprovers } = analytics;
    const maxDay = Math.max(...dailyTrend.map(d => d.total), 1);

    const STATS = [
        {
            label: 'Approved',
            value: summary.approved,
            sub: `${summary.approvalRate}% rate`,
            icon: PiCheckCircle,
            color: '#10b981',
            bg: 'bg-emerald-50',
        },
        {
            label: 'Rejected',
            value: summary.rejected,
            sub: `${summary.total} total`,
            icon: PiXCircle,
            color: '#ef4444',
            bg: 'bg-rose-50',
        },
        {
            label: 'Avg Response',
            value: `${summary.avgResponseTimeHours.toFixed(1)}h`,
            sub: 'Processing time',
            icon: PiClock,
            color: '#f59e0b',
            bg: 'bg-amber-50',
        },
        {
            label: 'Overdue',
            value: summary.overdueCount,
            sub: summary.overdueCount > 0 ? 'Needs attention' : 'All clear',
            icon: PiWarning,
            color: summary.overdueCount > 0 ? '#ef4444' : '#10b981',
            bg: summary.overdueCount > 0 ? 'bg-rose-50' : 'bg-emerald-50',
        },
    ];

    return (
        <div className="space-y-6">

            {/* Header */}
            <div className="flex items-end justify-between gap-4 flex-wrap">
                <div>
                    <h1 className="text-[20px] font-[700] text-gray-900">Workflow Analytics</h1>
                    <p className="text-[12.5px] text-gray-400 mt-0.5">Approval performance & response metrics</p>
                </div>

                <div className="flex items-center gap-2">
                    {/* Days selector */}
                    <CustomSelect
                        value={String(days)}
                        onChange={val => setDays(parseInt(val))}
                        options={[
                            { value: "7", label: "Last 7 days" },
                            { value: "30", label: "Last 30 days" },
                            { value: "90", label: "Last 90 days" },
                        ]}
                        className={SELECT}
                        style={CARD}
                    />

                    {/* Scope toggle */}
                    <div className="flex items-center bg-white rounded-[6px] p-0.5" style={CARD}>
                        {(['personal', 'system'] as const).map(s => (
                            <button key={s} onClick={() => setScope(s)}
                                className="px-3 py-1.5 rounded-[5px] text-[12px] font-[500] transition-all"
                                style={scope === s
                                    ? { background: '#6366f1', color: '#fff' }
                                    : { color: '#6b7280' }}>
                                {s === 'personal' ? 'Personal' : 'System-wide'}
                            </button>
                        ))}
                    </div>
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
                        <p className="text-[22px] font-[700] text-gray-900 leading-none tabular-nums">{value}</p>
                        <p className="text-[11px] text-gray-400 mt-1">{sub}</p>
                    </div>
                ))}
            </div>

            {/* Daily trend + category breakdown */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

                {/* Daily trend */}
                <div className="bg-white rounded-[8px] p-5" style={CARD}>
                    <h3 className="text-[13px] font-[600] text-gray-900 mb-4">Daily Trend</h3>
                    <div className="space-y-2.5">
                        {dailyTrend.slice(-14).map((day, i) => {
                            const pct = (day.total / maxDay) * 100;
                            return (
                                <div key={i}>
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-[11px] text-gray-400 font-[500]">
                                            {new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                        </span>
                                        <div className="flex items-center gap-3 text-[10.5px] font-[600]">
                                            <span className="text-emerald-600">{day.approved} ✓</span>
                                            <span className="text-rose-500">{day.rejected} ✗</span>
                                            <span className="text-amber-500">{day.pending} ⏳</span>
                                        </div>
                                    </div>
                                    <div className="h-[5px] rounded-full overflow-hidden"
                                        style={{ background: 'rgba(0,0,0,0.05)' }}>
                                        <div className="h-full rounded-full transition-all"
                                            style={{ width: `${pct}%`, background: '#6366f1' }} />
                                    </div>
                                </div>
                            );
                        })}
                        {dailyTrend.length === 0 && (
                            <p className="text-[12px] text-gray-400 py-4 text-center">No activity in this period</p>
                        )}
                    </div>
                </div>

                {/* By category */}
                <div className="bg-white rounded-[8px] p-5" style={CARD}>
                    <h3 className="text-[13px] font-[600] text-gray-900 mb-4">By Category</h3>
                    {Object.keys(byCategory).length === 0 ? (
                        <p className="text-[12px] text-gray-400 py-4 text-center">No data yet</p>
                    ) : (
                        <div className="space-y-3.5">
                            {Object.entries(byCategory).map(([cat, stats]: [string, any]) => {
                                const rate = stats.total > 0 ? Math.round((stats.approved / stats.total) * 100) : 0;
                                return (
                                    <div key={cat}>
                                        <div className="flex items-center justify-between mb-1.5">
                                            <span className="text-[12px] font-[500] text-gray-700">{cat}</span>
                                            <div className="flex items-center gap-2">
                                                <span className="text-[11px] text-gray-400">
                                                    {stats.approved}/{stats.total}
                                                </span>
                                                <span className="text-[10.5px] font-[600] px-1.5 py-0.5 rounded-[4px]"
                                                    style={{
                                                        background: rate >= 70 ? 'rgba(16,185,129,0.1)' : 'rgba(245,158,11,0.1)',
                                                        color: rate >= 70 ? '#10b981' : '#f59e0b',
                                                    }}>
                                                    {rate}%
                                                </span>
                                            </div>
                                        </div>
                                        <div className="h-[5px] rounded-full overflow-hidden"
                                            style={{ background: 'rgba(0,0,0,0.05)' }}>
                                            <div className="h-full rounded-full"
                                                style={{ width: `${rate}%`, background: rate >= 70 ? '#10b981' : '#f59e0b' }} />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* Overdue approvals */}
            {overdueApprovals.length > 0 && (
                <div className="bg-white rounded-[8px] p-5" style={CARD}>
                    <div className="flex items-center gap-2 mb-4">
                        <PiWarning className="text-[15px] text-rose-500" />
                        <h3 className="text-[13px] font-[600] text-gray-900">Overdue Approvals</h3>
                        <span className="ml-auto text-[10.5px] font-[600] text-rose-600 px-2 py-0.5 rounded-[4px]"
                            style={{ background: 'rgba(239,68,68,0.08)' }}>
                            {overdueApprovals.length} overdue
                        </span>
                    </div>
                    <div className="space-y-2">
                        {overdueApprovals.slice(0, 5).map((a: any) => (
                            <div key={a.id} className="flex items-center justify-between px-3 py-2.5 rounded-[6px]"
                                style={{ background: 'rgba(239,68,68,0.04)', border: '1px solid rgba(239,68,68,0.12)' }}>
                                <div>
                                    <p className="text-[12.5px] font-[500] text-gray-900">{a.title}</p>
                                    <p className="text-[11px] text-gray-400 mt-0.5">
                                        {a.submitter} · KES {Number(a.amount).toLocaleString()}
                                    </p>
                                </div>
                                <span className="text-[10.5px] font-[700] text-rose-600 shrink-0 ml-4">
                                    {a.daysOverdue}d overdue
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Top approvers — system wide only */}
            {scope === 'system' && topApprovers && topApprovers.length > 0 && (
                <div className="bg-white rounded-[8px] p-5" style={CARD}>
                    <div className="flex items-center gap-2 mb-4">
                        <PiUsers className="text-[15px] text-[#6366f1]" />
                        <h3 className="text-[13px] font-[600] text-gray-900">Top Approvers</h3>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {topApprovers.slice(0, 6).map((a: any, i: number) => (
                            <div key={i} className="flex items-center gap-3 p-3 rounded-[6px]"
                                style={{ background: 'rgba(0,0,0,0.02)', border: '1px solid rgba(0,0,0,0.06)' }}>
                                <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-[11px] font-[700]"
                                    style={{ background: 'rgba(99,102,241,0.1)', color: '#6366f1' }}>
                                    #{i + 1}
                                </div>
                                <div className="min-w-0">
                                    <p className="text-[12.5px] font-[600] text-gray-900 truncate">{a.name}</p>
                                    <div className="flex items-center gap-2 mt-0.5">
                                        <span className="text-[10.5px] text-gray-400">{a.total} decisions</span>
                                        <span className="text-[10.5px] font-[600] text-emerald-600">
                                            {a.approvalRate.toFixed(0)}%
                                        </span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Escalation panel — system wide only */}
            {scope === 'system' && (
                <EscalationPanel onTrigger={fetchAnalytics} />
            )}
        </div>
    );
}
