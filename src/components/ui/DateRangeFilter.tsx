"use client";

import { useMemo } from "react";
import { startOfDay, endOfDay, startOfWeek, startOfMonth, startOfYear, subDays, isWithinInterval } from "date-fns";
import { PiCalendarBlank, PiX } from "react-icons/pi";
import { DatePicker } from "@/components/ui/DatePicker";

export interface DateRange {
    from: Date | null;
    to: Date | null;
}

interface DateRangeFilterProps {
    value: DateRange;
    onChange: (range: DateRange) => void;
    className?: string;
}

const PRESETS: { label: string; range: () => DateRange }[] = [
    { label: "Today", range: () => ({ from: startOfDay(new Date()), to: endOfDay(new Date()) }) },
    { label: "Last 7 days", range: () => ({ from: startOfDay(subDays(new Date(), 6)), to: endOfDay(new Date()) }) },
    { label: "This week", range: () => ({ from: startOfWeek(new Date()), to: endOfDay(new Date()) }) },
    { label: "This month", range: () => ({ from: startOfMonth(new Date()), to: endOfDay(new Date()) }) },
    { label: "This year", range: () => ({ from: startOfYear(new Date()), to: endOfDay(new Date()) }) },
];

/**
 * Drop-in date/date-range filter for any list or table across the app — a single
 * source of truth for the "filter by when this happened" UI so every module looks
 * and behaves the same way. Pair with `filterByDateRange` below to apply it.
 */
export function DateRangeFilter({ value, onChange, className = "" }: DateRangeFilterProps) {
    const isActive = !!(value.from || value.to);

    return (
        <div className={`flex items-center gap-2 flex-wrap ${className}`}>
            <div className="flex items-center gap-1.5 text-gray-400 pl-1">
                <PiCalendarBlank className="text-[15px]" />
                <span className="text-[11px] font-[500] uppercase tracking-[0.06em]">Date</span>
            </div>

            <DatePicker
                value={value.from ?? undefined}
                onChange={(d) => onChange({ ...value, from: startOfDay(d) })}
                placeholder="From"
                className="!w-[140px] text-xs [&>div]:min-h-[36px] [&>div]:py-1.5"
            />
            <DatePicker
                value={value.to ?? undefined}
                onChange={(d) => onChange({ ...value, to: endOfDay(d) })}
                placeholder="To"
                className="!w-[140px] text-xs [&>div]:min-h-[36px] [&>div]:py-1.5"
            />

            <div className="flex items-center gap-1">
                {PRESETS.map(p => (
                    <button
                        key={p.label}
                        type="button"
                        onClick={() => onChange(p.range())}
                        className="px-2.5 py-1.5 rounded-md text-[11.5px] font-[500] text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors whitespace-nowrap"
                    >
                        {p.label}
                    </button>
                ))}
            </div>

            {isActive && (
                <button
                    type="button"
                    onClick={() => onChange({ from: null, to: null })}
                    className="flex items-center gap-1 px-2 py-1.5 rounded-md text-[11.5px] font-[500] text-gray-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                    title="Clear date filter"
                >
                    <PiX className="text-[12px]" /> Clear
                </button>
            )}
        </div>
    );
}

/** Apply a DateRange to a list, reading `dateField` off each item (defaults to createdAt). */
export function filterByDateRange<T extends Record<string, any>>(items: T[], range: DateRange, dateField: string = "createdAt"): T[] {
    if (!range.from && !range.to) return items;
    return items.filter(item => {
        const raw = item[dateField];
        if (!raw) return false;
        const date = new Date(raw);
        if (range.from && range.to) return isWithinInterval(date, { start: range.from, end: range.to });
        if (range.from) return date >= range.from;
        if (range.to) return date <= range.to;
        return true;
    });
}

export function useEmptyDateRange(): DateRange {
    return useMemo(() => ({ from: null, to: null }), []);
}
