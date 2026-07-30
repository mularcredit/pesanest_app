"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";
import { PiMagnifyingGlass } from "react-icons/pi";
import { CustomSelect } from "@/components/ui/CustomSelect";

const CARD_STYLE: React.CSSProperties = { border: '1px solid rgba(0,0,0,0.09)' };
const SELECT_CLS = "w-full h-9 rounded-[6px] px-3 text-[12px] text-gray-700 outline-none focus:ring-1 focus:ring-[#6366F1] transition-colors bg-white";

interface SalesFilterProps {
    customers: { id: string; name: string }[];
}

export function SalesFilter({ customers }: SalesFilterProps) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    const [query, setQuery] = useState(searchParams.get("query") || "");
    const [status, setStatus] = useState(searchParams.get("status") || "ALL");
    const [customerId, setCustomerId] = useState(searchParams.get("customerId") || "ALL");
    const [dateRange, setDateRange] = useState(searchParams.get("dateRange") || "ALL");

    useEffect(() => {
        const handler = setTimeout(() => { updateFilters({ query }); }, 300);
        return () => clearTimeout(handler);
    }, [query]);

    const updateFilters = (updates: Record<string, string | null>) => {
        const params = new URLSearchParams(searchParams.toString());
        Object.entries(updates).forEach(([key, value]) => {
            if (value && value !== "ALL") params.set(key, value);
            else params.delete(key);
        });
        router.push(`${pathname}?${params.toString()}`);
    };

    return (
        <div className="bg-white rounded-[8px] p-3 flex flex-col lg:flex-row gap-3 items-center" style={CARD_STYLE}>
            {/* Search */}
            <div className="flex-1 min-w-[200px] w-full">
                <input
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    placeholder="Search invoice #..."
                    className="w-full h-9 pl-3 pr-3 rounded-[6px] text-[12px] text-gray-700 placeholder:text-gray-300 outline-none focus:ring-1 focus:ring-[#6366F1] transition-colors bg-white"
                    style={CARD_STYLE}
                />
            </div>

            {/* Status */}
            <div className="w-full lg:w-[150px]">
                <CustomSelect
                    value={status}
                    onChange={val => { setStatus(val); updateFilters({ status: val }); }}
                    options={[
                        { value: 'ALL', label: 'All Statuses' },
                        { value: 'PAID', label: 'Paid' },
                        { value: 'PENDING', label: 'Pending' },
                        { value: 'OVERDUE', label: 'Overdue' },
                        { value: 'DRAFT', label: 'Draft' },
                    ]}
                    className={SELECT_CLS}
                    style={CARD_STYLE}
                />
            </div>

            {/* Customer */}
            <div className="w-full lg:w-[200px]">
                <CustomSelect
                    value={customerId}
                    onChange={val => { setCustomerId(val); updateFilters({ customerId: val }); }}
                    options={[
                        { value: 'ALL', label: 'All Customers' },
                        ...customers.map(c => ({ value: c.id, label: c.name })),
                    ]}
                    className={SELECT_CLS}
                    style={CARD_STYLE}
                />
            </div>

            {/* Date Range */}
            <div className="w-full lg:w-[150px]">
                <CustomSelect
                    value={dateRange}
                    onChange={val => { setDateRange(val); updateFilters({ dateRange: val }); }}
                    options={[
                        { value: 'ALL', label: 'All Time' },
                        { value: 'THIS_MONTH', label: 'This Month' },
                        { value: 'LAST_MONTH', label: 'Last Month' },
                        { value: 'LAST_3_MONTHS', label: 'Last 3 Months' },
                        { value: 'THIS_YEAR', label: 'This Year' },
                    ]}
                    className={SELECT_CLS}
                    style={CARD_STYLE}
                />
            </div>
        </div>
    );
}
