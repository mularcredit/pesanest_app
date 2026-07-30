"use client";

import { useState } from "react";
import Link from "next/link";
import { PiSquaresFour as LayoutGrid, PiList as List, PiDownloadSimple as Download, PiPlus as Plus } from "react-icons/pi";
import {
    PiTag, PiGear, PiPackage, PiUsers, PiMonitor, PiSpeakerHigh,
    PiAirplaneTilt, PiLightbulb, PiHardDrive, PiBriefcase, PiGlobe,
    PiClock, PiCheckCircle, PiXCircle, PiArchive, PiArrowRight,
} from "react-icons/pi";
import { cn } from "@/lib/utils";
import { AccountingActions } from "@/components/accounting/AccountingActions";

interface AccountData {
    id: string;
    name: string;
    code: string;
    total: number;
    totalAmount: number;
    pending: number;
    approved: number;
    fulfilled: number;
    rejected: number;
    lastActivity?: string | null;
}

interface Props {
    accountsData: AccountData[];
    totalRequisitions: number;
    totalAmount: number;
    totalPending: number;
    allRequisitions: any[];
    monthlyBudgets: any[];
}

function getAccountIcon(name: string) {
    const n = name.toLowerCase();
    if (n.includes('oper')) return PiGear;
    if (n.includes('inv') || n.includes('stock') || n.includes('supplies')) return PiPackage;
    if (n.includes('pay') || n.includes('sal') || n.includes('hr')) return PiUsers;
    if (n.includes('it') || n.includes('soft') || n.includes('hard') || n.includes('ict') || n.includes('computer')) return PiMonitor;
    if (n.includes('mark') || n.includes('ad')) return PiSpeakerHigh;
    if (n.includes('trav') || n.includes('accommodation')) return PiAirplaneTilt;
    if (n.includes('util') || n.includes('elect')) return PiLightbulb;
    if (n.includes('data') || n.includes('serv') || n.includes('internet')) return PiHardDrive;
    if (n.includes('office') || n.includes('stationery')) return PiBriefcase;
    if (n.includes('log') || n.includes('ship') || n.includes('fuel')) return PiGlobe;
    return PiTag;
}

function formatCurrency(amount: number) {
    return `KSh ${amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
}

function formatTimeAgo(date?: string | null) {
    if (!date) return 'No activity';
    const diff = Date.now() - new Date(date).getTime();
    const days = Math.floor(diff / 86400000);
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days}d ago`;
    if (days < 30) return `${Math.floor(days / 7)}w ago`;
    return `${Math.floor(days / 30)}mo ago`;
}

const STATUS_FILTERS = [
    { id: 'all',       label: 'All Accounts' },
    { id: 'pending',   label: 'Has Pending' },
    { id: 'approved',  label: 'Has Approved' },
    { id: 'fulfilled', label: 'Fulfilled' },
] as const;

type FilterId = typeof STATUS_FILTERS[number]['id'];

export function AccountsGridClient({ accountsData, totalRequisitions, totalAmount }: Props) {
    const [view, setView] = useState<'grid' | 'list'>('grid');
    const [statusFilter, setStatusFilter] = useState<FilterId>('all');

    const filtered =
        statusFilter === 'pending'   ? accountsData.filter(a => a.pending > 0) :
        statusFilter === 'approved'  ? accountsData.filter(a => a.approved > 0) :
        statusFilter === 'fulfilled' ? accountsData.filter(a => a.fulfilled > 0) :
        accountsData;

    return (
        <div className="space-y-5">
            {/* Page header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-[20px] font-[600] text-gray-900 tracking-tight">Expenses</h1>
                    <p className="text-[12.5px] text-gray-400 mt-0.5">
                        {accountsData.length} {accountsData.length === 1 ? 'account' : 'accounts'} · {totalRequisitions} requests · {formatCurrency(totalAmount)}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] bg-white text-gray-500 text-[12px] hover:bg-gray-50 transition-colors"
                        style={{ border: '1px solid rgba(0,0,0,0.09)' }}>
                        <Download size={12} strokeWidth={1.75} />
                        Export
                    </button>
                    <AccountingActions type="NEW_ACCOUNT" variant="secondary" />
                    <Link href="/dashboard/requisitions/new"
                        className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-[6px] bg-[#6366F1] text-white text-[12px] font-[500] hover:bg-indigo-600 transition-colors">
                        <Plus size={12} strokeWidth={2} />
                        New Expense
                    </Link>
                </div>
            </div>

            {/* Toolbar */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                    {STATUS_FILTERS.map(f => (
                        <button key={f.id} onClick={() => setStatusFilter(f.id)}
                            className={cn(
                                "px-3 py-1.5 rounded-[6px] text-[12px] transition-colors",
                                statusFilter === f.id
                                    ? "bg-[#6366F1] text-white"
                                    : "bg-white text-gray-500 hover:bg-gray-50"
                            )}
                            style={{ border: statusFilter === f.id ? '1px solid #6366F1' : '1px solid rgba(0,0,0,0.09)' }}>
                            {f.label}
                        </button>
                    ))}
                </div>
                <div className="flex items-center rounded-[6px] overflow-hidden"
                    style={{ border: '1px solid rgba(0,0,0,0.09)' }}>
                    <button onClick={() => setView('grid')}
                        className={cn("px-2.5 py-1.5 transition-colors",
                            view === 'grid' ? "bg-indigo-50 text-[#6366F1]" : "bg-white text-gray-400 hover:bg-gray-50")}>
                        <LayoutGrid size={13} strokeWidth={1.75} />
                    </button>
                    <button onClick={() => setView('list')}
                        className={cn("px-2.5 py-1.5 transition-colors",
                            view === 'list' ? "bg-indigo-50 text-[#6366F1]" : "bg-white text-gray-400 hover:bg-gray-50")}
                        style={{ borderLeft: '1px solid rgba(0,0,0,0.09)' }}>
                        <List size={13} strokeWidth={1.75} />
                    </button>
                </div>
            </div>

            {/* Empty state */}
            {filtered.length === 0 && (
                <div className="flex flex-col items-center justify-center py-24 text-center bg-white rounded-[8px]"
                    style={{ border: '1px solid rgba(0,0,0,0.09)' }}>
                    <div className="w-10 h-10 rounded-[8px] bg-gray-50 flex items-center justify-center mb-3"
                        style={{ border: '1px solid rgba(0,0,0,0.06)' }}>
                        <PiArchive className="text-xl text-gray-300" />
                    </div>
                    <p className="text-[13px] font-[500] text-gray-700">No accounts found</p>
                    <p className="text-[12px] text-gray-400 mt-1">
                        {statusFilter === 'all' ? 'Ledger accounts will appear here once created.' : 'No accounts match this filter.'}
                    </p>
                </div>
            )}

            {/* Grid view */}
            {view === 'grid' && filtered.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                    {filtered.map(acc => {
                        const Icon = getAccountIcon(acc.name);
                        const slug = encodeURIComponent(acc.name);
                        const activeCount = acc.total - acc.fulfilled - acc.rejected;
                        return (
                            <Link key={acc.id}
                                href={`/dashboard/requisitions/category/${slug}`}
                                className="group bg-white rounded-[8px] p-4 flex flex-col gap-3.5 hover:shadow-sm transition-shadow"
                                style={{ border: '1px solid rgba(0,0,0,0.09)' }}>

                                {/* Top row: icon + name + arrow */}
                                <div className="flex items-start justify-between">
                                    <div className="flex items-center gap-2.5">
                                        <div className="w-8 h-8 rounded-[6px] bg-indigo-50 flex items-center justify-center shrink-0">
                                            <Icon className="text-[#6366F1] text-[15px]" />
                                        </div>
                                        <div>
                                            <h2 className="text-[13px] font-[500] text-gray-900 leading-tight">{acc.name}</h2>
                                            <p className="text-[11px] text-gray-400 mt-0.5">GL-{acc.code} · {acc.total} {acc.total === 1 ? 'req' : 'reqs'}</p>
                                        </div>
                                    </div>
                                    <PiArrowRight className="text-gray-300 text-[15px] group-hover:text-[#6366F1] transition-colors mt-0.5 flex-shrink-0" />
                                </div>

                                {/* Amount */}
                                <div>
                                    <div className="text-[18px] font-[600] text-gray-900 font-mono tabular-nums tracking-tight">
                                        {formatCurrency(acc.totalAmount)}
                                    </div>
                                    <div className="text-[11px] text-gray-400">total requested</div>
                                </div>

                                {/* Status pills */}
                                <div className="flex items-center gap-1.5 flex-wrap">
                                    {acc.pending > 0 && (
                                        <span className="flex items-center gap-1 px-2 py-0.5 rounded-[4px] text-[10.5px] font-[500] bg-amber-50 text-amber-600">
                                            <PiClock className="text-[9px]" />{acc.pending} pending
                                        </span>
                                    )}
                                    {acc.approved > 0 && (
                                        <span className="flex items-center gap-1 px-2 py-0.5 rounded-[4px] text-[10.5px] font-[500] bg-emerald-50 text-emerald-600">
                                            <PiCheckCircle className="text-[9px]" />{acc.approved} approved
                                        </span>
                                    )}
                                    {acc.fulfilled > 0 && (
                                        <span className="flex items-center gap-1 px-2 py-0.5 rounded-[4px] text-[10.5px] font-[500] bg-indigo-50 text-indigo-600">
                                            <PiCheckCircle className="text-[9px]" />{acc.fulfilled} fulfilled
                                        </span>
                                    )}
                                    {acc.rejected > 0 && (
                                        <span className="flex items-center gap-1 px-2 py-0.5 rounded-[4px] text-[10.5px] font-[500] bg-rose-50 text-rose-500">
                                            <PiXCircle className="text-[9px]" />{acc.rejected} rejected
                                        </span>
                                    )}
                                    {acc.total === 0 && (
                                        <span className="text-[10.5px] text-gray-300">No expenses yet</span>
                                    )}
                                </div>

                                {/* Footer */}
                                <div className="flex items-center justify-between pt-3"
                                    style={{ borderTop: '1px solid rgba(0,0,0,0.06)' }}>
                                    <span className="text-[11px] text-gray-400">
                                        {acc.lastActivity ? formatTimeAgo(acc.lastActivity) : 'No activity'}
                                    </span>
                                    <span className={cn("text-[11px] font-[500]",
                                        activeCount > 0 ? "text-[#6366F1]" : "text-gray-300")}>
                                        {activeCount > 0 ? `${activeCount} active` : 'All closed'}
                                    </span>
                                </div>
                            </Link>
                        );
                    })}
                </div>
            )}

            {/* List view */}
            {view === 'list' && filtered.length > 0 && (
                <div className="bg-white rounded-[8px] overflow-hidden"
                    style={{ border: '1px solid rgba(0,0,0,0.09)' }}>
                    <table className="w-full">
                        <thead>
                            <tr className="bg-gray-50/60" style={{ borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
                                {['Account', 'GL Code', 'Total', 'Amount', 'Pending', 'Approved', 'Fulfilled', 'Last Activity'].map(c => (
                                    <th key={c} className="px-5 py-2.5 text-left text-[10.5px] font-[500] uppercase tracking-[0.08em] text-gray-400 whitespace-nowrap">{c}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map((acc, i) => {
                                const Icon = getAccountIcon(acc.name);
                                const slug = encodeURIComponent(acc.name);
                                return (
                                    <tr key={acc.id}
                                        className="hover:bg-gray-50/60 transition-colors"
                                        style={i < filtered.length - 1 ? { borderBottom: '1px solid rgba(0,0,0,0.06)' } : {}}>
                                        <td className="px-5 py-3.5">
                                            <Link href={`/dashboard/requisitions/category/${slug}`}
                                                className="flex items-center gap-2.5">
                                                <div className="w-7 h-7 rounded-[6px] bg-indigo-50 flex items-center justify-center shrink-0">
                                                    <Icon className="text-[#6366F1] text-[13px]" />
                                                </div>
                                                <span className="text-[13px] font-[500] text-gray-900 hover:text-[#6366F1] transition-colors">{acc.name}</span>
                                            </Link>
                                        </td>
                                        <td className="px-5 py-3.5 text-[12px] text-gray-400 font-mono">GL-{acc.code}</td>
                                        <td className="px-5 py-3.5 text-[13px] font-[500] text-gray-900 tabular-nums">{acc.total}</td>
                                        <td className="px-5 py-3.5 text-[13px] font-[500] text-gray-900 tabular-nums">{formatCurrency(acc.totalAmount)}</td>
                                        <td className="px-5 py-3.5">
                                            {acc.pending > 0
                                                ? <span className="text-[11.5px] font-[500] text-amber-600 bg-amber-50 px-2 py-0.5 rounded-[4px]">{acc.pending}</span>
                                                : <span className="text-[12px] text-gray-300">—</span>}
                                        </td>
                                        <td className="px-5 py-3.5">
                                            {acc.approved > 0
                                                ? <span className="text-[11.5px] font-[500] text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-[4px]">{acc.approved}</span>
                                                : <span className="text-[12px] text-gray-300">—</span>}
                                        </td>
                                        <td className="px-5 py-3.5">
                                            {acc.fulfilled > 0
                                                ? <span className="text-[11.5px] font-[500] text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-[4px]">{acc.fulfilled}</span>
                                                : <span className="text-[12px] text-gray-300">—</span>}
                                        </td>
                                        <td className="px-5 py-3.5 text-[12px] text-gray-400 whitespace-nowrap">{formatTimeAgo(acc.lastActivity)}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
