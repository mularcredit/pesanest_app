"use client";

import { useState, useMemo } from "react";
import { PiMagnifyingGlass, PiClock, PiCheckCircle, PiList } from "react-icons/pi";
import { cn } from "@/lib/utils";
import { RequisitionList } from "./RequisitionList";
import { DateRangeFilter, filterByDateRange, type DateRange } from "@/components/ui/DateRangeFilter";

interface RequisitionListWithFilterProps {
    requisitions: any[];
    monthlyBudgets: any[];
}

export function RequisitionListWithFilter({ requisitions, monthlyBudgets }: RequisitionListWithFilterProps) {
    const [statusFilter, setStatusFilter] = useState<'active' | 'fulfilled' | 'all'>('active');
    const [search, setSearch] = useState('');
    const [dateRange, setDateRange] = useState<DateRange>({ from: null, to: null });

    const filteredRequisitions = useMemo(() => {
        let rows = requisitions;
        if (statusFilter === 'active') rows = rows.filter(req => req.status !== 'FULFILLED');
        else if (statusFilter === 'fulfilled') rows = rows.filter(req => req.status === 'FULFILLED');

        const q = search.trim().toLowerCase();
        if (q) rows = rows.filter(req => req.title?.toLowerCase().includes(q) || req.id?.toLowerCase().includes(q));

        return filterByDateRange(rows, dateRange, 'createdAt');
    }, [requisitions, statusFilter, search, dateRange]);

    const statusCounts = useMemo(() => ({
        active: requisitions.filter(req => req.status !== 'FULFILLED').length,
        fulfilled: requisitions.filter(req => req.status === 'FULFILLED').length,
        all: requisitions.length
    }), [requisitions]);

    const navItems = [
        { id: 'active' as const, label: 'Active', sub: 'Pending approval or payment', icon: PiClock },
        { id: 'fulfilled' as const, label: 'Fulfilled', sub: 'Disbursements complete', icon: PiCheckCircle },
        { id: 'all' as const, label: 'All History', sub: 'Full ledger view', icon: PiList },
    ];

    return (
        <div className="flex gap-0 -mt-6 -mx-0">

            {/* Left Sidebar */}
            <aside className="w-[190px] shrink-0 border-t border-r border-gray-200 bg-white flex flex-col">
                <div className="px-4 pt-5 pb-3 border-b border-gray-100">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">Filter by</p>
                    <h2 className="text-sm font-semibold text-gray-900 mt-0.5">Status</h2>
                </div>
                <nav className="divide-y divide-gray-100">
                    {navItems.map(item => {
                        const isActive = statusFilter === item.id;
                        const Icon = item.icon;
                        return (
                            <button
                                key={item.id}
                                onClick={() => setStatusFilter(item.id)}
                                className={cn(
                                    "w-full flex items-center gap-3 px-4 py-3.5 text-sm font-medium transition-all text-left rounded-lg mx-1 my-0.5",
                                    isActive ? "bg-indigo-50 text-[#6366F1]" : "text-slate-500 hover:bg-gray-50 hover:text-slate-800"
                                )}
                            >
                                <Icon className="shrink-0 text-base" />
                                <span className="flex-1 truncate">{item.label}</span>
                                <span className={cn(
                                    "text-[10px] font-semibold px-1.5 py-0.5 rounded-full min-w-[20px] text-center",
                                    isActive ? "bg-[#6366F1]/15 text-[#6366F1]" : "bg-white/70 text-slate-500"
                                )}>{statusCounts[item.id]}</span>
                            </button>
                        );
                    })}
                </nav>
            </aside>

            {/* Main Content */}
            <div className="flex-1 min-w-0 pl-6 space-y-4">
                {/* Search & Filter bar */}
                <div className="flex items-center gap-4 flex-wrap">
                    <div className="relative flex-1 min-w-[220px]">
                        <PiMagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
                        <input
                            type="text"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Search by ID or title..."
                            className="w-full bg-gray-50 border border-gray-200 rounded-lg pl-9 pr-4 py-2.5 text-sm text-gray-900 focus:ring-1 focus:ring-gray-900 focus:outline-none transition-all"
                        />
                    </div>
                    <DateRangeFilter value={dateRange} onChange={setDateRange} />
                </div>

                {/* Table */}
                <RequisitionList
                    requisitions={filteredRequisitions}
                    monthlyBudgets={monthlyBudgets}
                />
            </div>
        </div>
    );
}
