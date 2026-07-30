"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PiCalendar, PiFunnel, PiArrowClockwise, PiInfo, PiSlidersHorizontal, PiSparkle, PiSpinner } from "react-icons/pi";
import { Button } from "@/components/ui/Button";

import { DatePicker } from "@/components/ui/DatePicker";
import { format, parseISO } from "date-fns";

export function StatementFilterForm() {
    const router = useRouter();
    const searchParams = useSearchParams();

    // Default to current month
    const defaultStart = new Date();
    defaultStart.setDate(1);
    const defaultEnd = new Date();

    const [startDate, setStartDate] = useState<Date | undefined>(
        searchParams.get("from") ? parseISO(searchParams.get("from")!) : defaultStart
    );
    const [endDate, setEndDate] = useState<Date | undefined>(
        searchParams.get("to") ? parseISO(searchParams.get("to")!) : defaultEnd
    );

    const [isLoading, setIsLoading] = useState(false);

    const handleApply = () => {
        setIsLoading(true);
        const params = new URLSearchParams(searchParams.toString());
        if (startDate) params.set("from", format(startDate, "yyyy-MM-dd"));
        else params.delete("from");

        if (endDate) params.set("to", format(endDate, "yyyy-MM-dd"));
        else params.delete("to");

        router.push(`?${params.toString()}`);

        // Reset loading after a delay or on next render
        setTimeout(() => setIsLoading(false), 800);
    };

    const handleReset = () => {
        setStartDate(defaultStart);
        setEndDate(defaultEnd);

        const params = new URLSearchParams();
        const currentView = searchParams.get('view');
        if (currentView) params.set('view', currentView);

        router.push(params.toString() ? `?${params.toString()}` : "?");
    };

    return (
        <div className="bg-white border border-gray-300 rounded-2xl p-6 mb-8 no-print animate-fade-in-up">
            <div className="mb-6 bg-gradient-to-r from-cyan-50 to-emerald-50 p-6 rounded-xl text-cyan-900 border border-cyan-100 flex items-center justify-between relative overflow-hidden">
                <div className="relative z-10 flex-1">
                    <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-semibold text-base">Statement settings</h3>
                    </div>
                    <p className="text-sm text-cyan-800 flex items-start gap-1.5 font-medium ml-1 leading-relaxed">
                        <img src="/man.png" alt="Info" className="w-5 h-5 object-contain shrink-0 mt-0.5" />
                        <span>To generate a complete history, please ensure you have selected a valid <strong className="text-cyan-950 font-semibold underline decoration-cyan-400/40 underline-offset-4">date range</strong> below.</span>
                    </p>
                </div>

                <img src="/credit-card.png" alt="Card" className="w-16 h-16 object-contain relative z-10 ml-4" />

                <div className="absolute top-0 right-0 p-3 opacity-[0.05]">
                    <PiSparkle className="text-6xl text-cyan-600" />
                </div>
            </div>

            <div className="flex flex-wrap items-end gap-4">
                <div className="space-y-1.5 flex-1 min-w-[200px]">
                    <label className="text-[10px] font-semibold text-gray-400 tracking-tight pl-1">Start date</label>
                    <DatePicker
                        value={startDate}
                        onChange={setStartDate}
                        placeholder="Select start date"
                        className="text-xs"
                    />
                </div>

                <div className="space-y-1.5 flex-1 min-w-[200px]">
                    <label className="text-[10px] font-semibold text-gray-400 tracking-tight pl-1">End date</label>
                    <DatePicker
                        value={endDate}
                        onChange={setEndDate}
                        placeholder="Select end date"
                        className="text-xs"
                    />
                </div>

                <div className="flex gap-2">
                    <Button
                        onClick={handleReset}
                        variant="ghost"
                        className="h-[42px] px-4 rounded-[5px] text-gray-500 hover:text-gray-900 hover:bg-gray-100 border border-transparent hover:border-gray-300"
                        title="Reset to current month"
                    >
                        <PiArrowClockwise className="text-lg" />
                    </Button>
                    <button
                        onClick={handleApply}
                        disabled={isLoading}
                        className="bg-[#6366F1] hover:bg-[#6366F1]/90 text-white h-[42px] px-6 rounded-[5px] text-xs font-semibold transition-all border border-[#6366F1]/20 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                        {isLoading && <PiSpinner className="animate-spin text-sm" />}
                        {isLoading ? "Updating..." : "Update view"}
                    </button>
                </div>
            </div>
        </div>
    );
}
