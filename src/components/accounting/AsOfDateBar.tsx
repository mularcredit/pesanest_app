"use client";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useState } from "react";
import { PiCalendarBlank } from "react-icons/pi";
import { DatePicker } from "@/components/ui/DatePicker";

// A Trial Balance is a cumulative snapshot "as at" one date — every posted
// entry up to that point — not a flow bounded by a start date the way an
// Income Statement period is. So this picks a single date, not a from/to
// range (see DateRangeBar for that shape).
const PRESETS = [
    { label: "Today",              key: "today" },
    { label: "End of last month",  key: "eo_last_month" },
    { label: "End of last quarter", key: "eo_last_quarter" },
    { label: "End of last year",   key: "eo_last_year" },
    { label: "Custom…",            key: "custom" },
] as const;

function fmtLocal(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
}

function parseLocalDate(s: string): Date | undefined {
    if (!s) return undefined;
    const [y, m, d] = s.split("-").map(Number);
    if (!y || !m || !d) return undefined;
    return new Date(y, m - 1, d);
}

function presetToDate(key: string): string {
    const now = new Date();
    const y = now.getFullYear(), m = now.getMonth();
    const q = Math.floor(m / 3);
    switch (key) {
        case "today":           return fmtLocal(now);
        case "eo_last_month":   return fmtLocal(new Date(y, m, 0));
        case "eo_last_quarter": return fmtLocal(new Date(y, q * 3, 0));
        case "eo_last_year":    return fmtLocal(new Date(y - 1, 11, 31));
        default:                return "";
    }
}

export function AsOfDateBar() {
    const router   = useRouter();
    const pathname = usePathname();
    const sp       = useSearchParams();
    const asOf = sp.get("asOf") ?? "";

    const [showCustom, setShowCustom] = useState(false);
    const [customDate, setCustomDate] = useState(asOf);

    function navigate(value: string) {
        const p = new URLSearchParams(sp.toString());
        value ? p.set("asOf", value) : p.delete("asOf");
        router.push(`${pathname}?${p.toString()}`);
    }

    function applyPreset(key: string) {
        if (key === "custom") { setShowCustom(true); return; }
        setShowCustom(false);
        navigate(presetToDate(key));
    }

    const activeLabel = !asOf ? "Today"
        : PRESETS.slice(0, -1).find(p => presetToDate(p.key) === asOf)?.label
        ?? asOf;

    return (
        <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 flex-wrap">
                {PRESETS.map(p => (
                    <button
                        key={p.key}
                        onClick={() => applyPreset(p.key)}
                        className={`px-3 py-1.5 rounded-full text-[11.5px] font-[500] transition-colors border ${
                            activeLabel === p.label
                                ? "bg-[#6366F1] text-white border-[#6366F1]"
                                : "bg-white text-gray-500 border-gray-200 hover:border-indigo-300 hover:text-indigo-600"
                        }`}
                    >
                        {p.label}
                    </button>
                ))}
            </div>

            {showCustom && (
                <div className="flex items-center gap-2 ml-1">
                    <PiCalendarBlank className="text-gray-400 text-[14px]" />
                    <DatePicker
                        value={parseLocalDate(customDate)}
                        onChange={d => setCustomDate(fmtLocal(d))}
                        placeholder="As at"
                        className="!w-[150px] text-xs [&>div]:min-h-[36px] [&>div]:py-1.5"
                    />
                    <button
                        onClick={() => { navigate(customDate); setShowCustom(false); }}
                        disabled={!customDate}
                        className="px-3 py-1.5 rounded-[6px] bg-[#6366F1] text-white text-[11.5px] font-[500] hover:bg-indigo-700 transition-colors disabled:opacity-40"
                    >Apply</button>
                </div>
            )}
        </div>
    );
}
