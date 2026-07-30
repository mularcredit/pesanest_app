"use client";

import { useEffect, useState } from "react";
import {
    PiPlus, PiCheckCircle, PiWarningCircle, PiXCircle, PiSpinner,
    PiCurrencyDollar, PiShieldCheck, PiTag, PiGear, PiPackage,
    PiUsers, PiMonitor, PiSpeakerHigh, PiAirplaneTilt, PiLightbulb,
    PiHardDrive, PiBriefcase, PiGlobe,
} from "react-icons/pi";
import { cn } from "@/lib/utils";
import { CreateBudgetModal } from "@/components/dashboard/budgets/CreateBudgetModal";

interface Budget {
    id: string;
    category: string;
    amount: number;
    spent: number;
    remaining: number;
    percentUsed: number;
    status: 'HEALTHY' | 'WARNING' | 'CRITICAL' | 'EXCEEDED';
}

interface BudgetAlert {
    id: string;
    type: string;
    category: string;
    message: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    daysRemaining: number;
    projectedOverspend?: number;
}

const CARD_STYLE: React.CSSProperties = { border: '1px solid rgba(0,0,0,0.09)' };

const STATUS_FILTERS = [
    { id: 'all',      label: 'All' },
    { id: 'HEALTHY',  label: 'Healthy' },
    { id: 'WARNING',  label: 'Warning' },
    { id: 'CRITICAL', label: 'Critical' },
    { id: 'EXCEEDED', label: 'Exceeded' },
] as const;
type FilterId = typeof STATUS_FILTERS[number]['id'];

function fmt(n: number) {
    return `KES ${new Intl.NumberFormat('en-US').format(Math.round(n))}`;
}

function getCategoryIcon(name: string) {
    const n = name.toLowerCase();
    if (n.includes('oper')) return PiGear;
    if (n.includes('inv') || n.includes('stock') || n.includes('supplies')) return PiPackage;
    if (n.includes('pay') || n.includes('sal') || n.includes('hr')) return PiUsers;
    if (n.includes('it') || n.includes('soft') || n.includes('ict') || n.includes('computer')) return PiMonitor;
    if (n.includes('mark') || n.includes('ad')) return PiSpeakerHigh;
    if (n.includes('trav') || n.includes('accommodation')) return PiAirplaneTilt;
    if (n.includes('util') || n.includes('elect')) return PiLightbulb;
    if (n.includes('data') || n.includes('serv') || n.includes('internet')) return PiHardDrive;
    if (n.includes('office') || n.includes('stationery')) return PiBriefcase;
    if (n.includes('log') || n.includes('ship') || n.includes('fuel')) return PiGlobe;
    return PiTag;
}

function statusMeta(status: Budget['status']) {
    switch (status) {
        case 'HEALTHY':  return { label: 'Healthy',  bar: 'bg-emerald-500', text: 'text-emerald-600', bg: 'bg-emerald-50', border: 'rgba(16,185,129,0.2)' };
        case 'WARNING':  return { label: 'Warning',  bar: 'bg-amber-400',   text: 'text-amber-600',   bg: 'bg-amber-50',   border: 'rgba(245,158,11,0.2)' };
        case 'CRITICAL': return { label: 'Critical', bar: 'bg-[#6366F1]',   text: 'text-[#6366F1]',  bg: 'bg-indigo-50',  border: 'rgba(99,102,241,0.25)' };
        case 'EXCEEDED': return { label: 'Exceeded', bar: 'bg-rose-500',    text: 'text-rose-600',   bg: 'bg-rose-50',    border: 'rgba(239,68,68,0.2)' };
    }
}

function alertMeta(severity: BudgetAlert['severity']) {
    switch (severity) {
        case 'critical': return { icon: PiXCircle,       iconClass: 'text-rose-500',   bg: 'bg-rose-50',   border: 'rgba(239,68,68,0.15)' };
        case 'high':     return { icon: PiWarningCircle, iconClass: 'text-[#6366F1]',  bg: 'bg-indigo-50', border: 'rgba(99,102,241,0.2)' };
        case 'medium':   return { icon: PiWarningCircle, iconClass: 'text-amber-500',  bg: 'bg-amber-50',  border: 'rgba(245,158,11,0.2)' };
        default:         return { icon: PiWarningCircle, iconClass: 'text-gray-400',   bg: 'bg-gray-50',   border: 'rgba(0,0,0,0.07)' };
    }
}

export default function BudgetsPage() {
    const [budgets, setBudgets] = useState<Budget[]>([]);
    const [alerts, setAlerts] = useState<BudgetAlert[]>([]);
    const [summary, setSummary] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [filter, setFilter] = useState<FilterId>('all');

    useEffect(() => { fetchBudgetData(); }, []);

    const fetchBudgetData = async () => {
        try {
            const res = await fetch('/api/budgets');
            const result = await res.json();
            if (result.success) {
                setBudgets(result.data.budgets);
                setAlerts(result.data.alerts);
                setSummary(result.data.summary);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const filtered = filter === 'all' ? budgets : budgets.filter(b => b.status === filter);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <PiSpinner className="text-[#6366F1] text-2xl animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-5 pb-24">

            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-[20px] font-[600] text-gray-900 tracking-tight">Budget Rules</h1>
                    <p className="text-[12.5px] text-gray-400 mt-0.5">
                        {budgets.length} {budgets.length === 1 ? 'category' : 'categories'}
                        {summary ? ` · ${summary.percentUsed?.toFixed(0)}% utilized` : ''}
                    </p>
                </div>
                <button onClick={() => setShowModal(true)}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-[6px] bg-[#6366F1] text-white text-[12px] font-[500] hover:bg-indigo-600 transition-colors">
                    <PiPlus className="text-[13px]" />
                    New Budget Rule
                </button>
            </div>

            {/* Summary chips */}
            {summary && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                        { label: 'Total Budget',    value: fmt(summary.totalBudget),     sub: null,                                     icon: PiCurrencyDollar, color: 'text-emerald-500' },
                        { label: 'Spent to Date',   value: fmt(summary.totalSpent),      sub: `${summary.percentUsed?.toFixed(1)}% utilized`, icon: PiShieldCheck,   color: 'text-[#6366F1]' },
                        { label: 'Remaining',       value: fmt(summary.totalRemaining),  sub: 'available',                              icon: PiCheckCircle,   color: 'text-emerald-500' },
                        { label: 'Needs Review',    value: `${(summary.criticalCount || 0) + (summary.exceededCount || 0)}`,            sub: 'categories',     icon: PiWarningCircle, color: 'text-amber-500' },
                    ].map(m => {
                        const Icon = m.icon;
                        return (
                            <div key={m.label} className="bg-white rounded-[8px] px-4 py-3.5" style={CARD_STYLE}>
                                <div className="flex items-center justify-between mb-2">
                                    <p className="text-[10.5px] font-[500] uppercase tracking-[0.08em] text-gray-400">{m.label}</p>
                                    <Icon className={cn("text-[15px]", m.color)} />
                                </div>
                                <p className="text-[17px] font-[600] text-gray-900 tabular-nums">{m.value}</p>
                                {m.sub && <p className="text-[11px] text-gray-400 mt-0.5">{m.sub}</p>}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Alerts */}
            {alerts.length > 0 && (
                <div className="bg-white rounded-[8px] overflow-hidden" style={CARD_STYLE}>
                    <div className="flex items-center gap-2 px-5 py-3" style={{ borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
                        <PiWarningCircle className="text-amber-500 text-[15px]" />
                        <span className="text-[10.5px] font-[600] uppercase tracking-[0.08em] text-gray-500">
                            {alerts.length} Active {alerts.length === 1 ? 'Alert' : 'Alerts'}
                        </span>
                    </div>
                    <div className="p-3 space-y-2">
                        {alerts.map(alert => {
                            const m = alertMeta(alert.severity);
                            const Icon = m.icon;
                            return (
                                <div key={alert.id} className="flex items-start gap-3 rounded-[7px] px-4 py-3"
                                    style={{ background: m.bg, border: `1px solid ${m.border}` }}>
                                    <Icon className={cn("text-[16px] shrink-0 mt-0.5", m.iconClass)} />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[12.5px] font-[500] text-gray-900">{alert.category}</p>
                                        <p className="text-[12px] text-gray-500 mt-0.5">{alert.message}</p>
                                        {alert.projectedOverspend && (
                                            <p className="text-[11.5px] font-[500] text-rose-600 mt-1">
                                                Projected overspend: {fmt(alert.projectedOverspend)}
                                            </p>
                                        )}
                                    </div>
                                    <span className="shrink-0 text-[10px] font-[500] text-gray-500 bg-white px-2 py-0.5 rounded-[4px] whitespace-nowrap"
                                        style={{ border: '1px solid rgba(0,0,0,0.08)' }}>
                                        {alert.daysRemaining}d left
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Filter tabs + grid */}
            <div>
                <div className="flex items-center gap-1.5 mb-4">
                    {STATUS_FILTERS.map(f => (
                        <button key={f.id} onClick={() => setFilter(f.id)}
                            className={cn("px-3 py-1.5 rounded-[6px] text-[12px] transition-colors",
                                filter === f.id ? "bg-[#6366F1] text-white" : "bg-white text-gray-500 hover:bg-gray-50")}
                            style={{ border: filter === f.id ? '1px solid #6366F1' : '1px solid rgba(0,0,0,0.09)' }}>
                            {f.label}
                            {f.id !== 'all' && (
                                <span className={cn("ml-1.5 text-[10px]",
                                    filter === f.id ? "opacity-70" : "text-gray-400")}>
                                    {budgets.filter(b => b.status === f.id).length}
                                </span>
                            )}
                        </button>
                    ))}
                </div>

                {filtered.length === 0 ? (
                    <div className="bg-white rounded-[8px] py-20 flex flex-col items-center" style={CARD_STYLE}>
                        <div className="w-10 h-10 rounded-[8px] bg-gray-50 flex items-center justify-center mb-3"
                            style={{ border: '1px solid rgba(0,0,0,0.07)' }}>
                            <PiTag className="text-gray-300 text-xl" />
                        </div>
                        <p className="text-[13px] font-[500] text-gray-700">No budget rules</p>
                        <p className="text-[12px] text-gray-400 mt-0.5">
                            {filter === 'all' ? 'Create your first rule to start tracking spend.' : 'No categories match this status.'}
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                        {filtered.map(budget => {
                            const Icon = getCategoryIcon(budget.category);
                            const m = statusMeta(budget.status);
                            const pct = Math.min(budget.percentUsed, 100);
                            return (
                                <div key={budget.id} className="bg-white rounded-[8px] p-4 flex flex-col gap-3" style={CARD_STYLE}>

                                    {/* Top row */}
                                    <div className="flex items-start justify-between">
                                        <div className="flex items-center gap-2.5">
                                            <div className="w-8 h-8 rounded-[6px] bg-indigo-50 flex items-center justify-center shrink-0">
                                                <Icon className="text-[#6366F1] text-[15px]" />
                                            </div>
                                            <div>
                                                <p className="text-[13px] font-[500] text-gray-900">{budget.category}</p>
                                                <p className="text-[11px] text-gray-400 mt-0.5">
                                                    {fmt(budget.spent)} of {fmt(budget.amount)}
                                                </p>
                                            </div>
                                        </div>
                                        <span className={cn("text-[10px] font-[500] px-2 py-0.5 rounded-[4px] shrink-0", m.text, m.bg)}
                                            style={{ border: `1px solid ${m.border}` }}>
                                            {m.label}
                                        </span>
                                    </div>

                                    {/* Percent + bar */}
                                    <div>
                                        <div className="flex items-baseline justify-between mb-1.5">
                                            <span className="text-[26px] font-[600] text-gray-900 tabular-nums leading-none">
                                                {budget.percentUsed.toFixed(0)}%
                                            </span>
                                            <span className="text-[11.5px] text-gray-400">utilized</span>
                                        </div>
                                        <div className="h-[4px] rounded-full bg-gray-100 overflow-hidden">
                                            <div className={cn("h-full rounded-full transition-all duration-500", m.bar)}
                                                style={{ width: `${pct}%` }} />
                                        </div>
                                        {budget.status === 'EXCEEDED' && (
                                            <p className="text-[10.5px] text-rose-500 font-[500] mt-1">
                                                Exceeded by {fmt(Math.abs(budget.remaining))}
                                            </p>
                                        )}
                                    </div>

                                    {/* Footer */}
                                    <div className="flex items-center justify-between pt-2" style={{ borderTop: '1px solid rgba(0,0,0,0.06)' }}>
                                        <span className="text-[11.5px] text-gray-400">
                                            {budget.remaining >= 0 ? fmt(budget.remaining) + ' remaining' : 'Over limit'}
                                        </span>
                                        <span className={cn("text-[11px] font-[500]", m.text)}>
                                            {budget.percentUsed.toFixed(1)}%
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Tip strip */}
            <div className="bg-white rounded-[8px] px-5 py-4" style={CARD_STYLE}>
                <p className="text-[10.5px] font-[600] uppercase tracking-[0.08em] text-gray-400 mb-3">How budget rules work</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2">
                    {[
                        'Expenses are checked against their category budget before submission.',
                        'You\'ll see a warning when any category reaches the alert threshold.',
                        'Submissions that exceed the limit require a manager override.',
                        'Forecasting uses your spending patterns to predict month-end totals.',
                    ].map((tip, i) => (
                        <p key={i} className="text-[12px] text-gray-500 flex gap-2">
                            <span className="text-[#6366F1] font-[600] shrink-0">·</span> {tip}
                        </p>
                    ))}
                </div>
            </div>

            <CreateBudgetModal
                isOpen={showModal}
                onClose={() => setShowModal(false)}
                onSuccess={() => { fetchBudgetData(); setShowModal(false); }}
            />
        </div>
    );
}
