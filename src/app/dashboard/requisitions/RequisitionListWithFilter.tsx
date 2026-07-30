"use client";

import { useState, useMemo } from "react";
import { PiFunnel, PiMagnifyingGlass, PiClock, PiCheckCircle, PiList } from "react-icons/pi";
import { cn } from "@/lib/utils";
import { RequisitionList } from "./RequisitionList";

interface RequisitionListWithFilterProps {
    requisitions: any[];
    monthlyBudgets: any[];
}

export function RequisitionListWithFilter({ requisitions, monthlyBudgets }: RequisitionListWithFilterProps) {
    const [statusFilter, setStatusFilter] = useState<'active' | 'fulfilled' | 'all'>('active');

    const filteredRequisitions = useMemo(() => {
        if (statusFilter === 'active') return requisitions.filter(req => req.status !== 'FULFILLED');
        if (statusFilter === 'fulfilled') return requisitions.filter(req => req.status === 'FULFILLED');
        return requisitions;
    }, [requisitions, statusFilter]);

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
                <div className="flex gap-4">
                    <div className="flex-1">
                        <input
                            type="text"
                            placeholder="Search by ID or title..."
                            className="w-full bg-gray-50 border border-gray-200 rounded-lg pl-3 pr-4 py-2.5 text-sm text-gray-900 focus:ring-1 focus:ring-gray-900 focus:outline-none transition-all"
                        />
                    </div>
                    <button className="px-5 py-2.5 bg-white border border-gray-200 rounded-lg flex items-center gap-2 text-gray-500 hover:text-gray-900 hover:border-gray-900 transition-all">
                        <PiFunnel />
                        <span className="text-xs font-semibold">Filter</span>
                    </button>
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
