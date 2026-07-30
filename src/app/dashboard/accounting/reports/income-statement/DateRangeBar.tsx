"use client";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useState } from "react";
import { PiCalendarBlank, PiCaretDown } from "react-icons/pi";

const PRESETS = [
    { label: "This month",    key: "this_month" },
    { label: "Last month",    key: "last_month" },
    { label: "This quarter",  key: "this_quarter" },
    { label: "Last quarter",  key: "last_quarter" },
    { label: "This year",     key: "this_year" },
    { label: "Last year",     key: "last_year" },
    { label: "All time",      key: "all_time" },
    { label: "Custom…",       key: "custom" },
] as const;

function presetToDates(key: string): { from: string; to: string } {
    const now = new Date();
    const y = now.getFullYear(), m = now.getMonth();
    const iso = (d: Date) => d.toISOString().slice(0, 10);
    const q = Math.floor(m / 3);
    switch (key) {
        case "this_month":   return { from: iso(new Date(y, m, 1)),      to: iso(new Date(y, m + 1, 0)) };
        case "last_month":   return { from: iso(new Date(y, m - 1, 1)),  to: iso(new Date(y, m, 0)) };
        case "this_quarter": return { from: iso(new Date(y, q * 3, 1)),  to: iso(new Date(y, q * 3 + 3, 0)) };
        case "last_quarter": return { from: iso(new Date(y, (q - 1) * 3, 1)), to: iso(new Date(y, q * 3, 0)) };
        case "this_year":    return { from: iso(new Date(y, 0, 1)),       to: iso(new Date(y, 11, 31)) };
        case "last_year":    return { from: iso(new Date(y - 1, 0, 1)),   to: iso(new Date(y - 1, 11, 31)) };
        default:             return { from: "", to: "" };
    }
}

export function DateRangeBar() {
    const router   = useRouter();
    const pathname = usePathname();
    const sp       = useSearchParams();
    const from = sp.get("from") ?? "";
    const to   = sp.get("to")   ?? "";
    const compare = sp.get("compare") === "1";

    const [showCustom, setShowCustom] = useState(false);
    const [customFrom, setCustomFrom] = useState(from);
    const [customTo,   setCustomTo]   = useState(to);

    function navigate(params: Record<string, string>) {
        const p = new URLSearchParams(sp.toString());
        Object.entries(params).forEach(([k, v]) => v ? p.set(k, v) : p.delete(k));
        router.push(`${pathname}?${p.toString()}`);
    }

    function applyPreset(key: string) {
        if (key === "custom") { setShowCustom(true); return; }
        if (key === "all_time") { navigate({ from: "", to: "" }); return; }
        const { from, to } = presetToDates(key);
        setShowCustom(false);
        navigate({ from, to });
    }

    const activeLabel = !from && !to ? "All time"
        : PRESETS.slice(0, -2).find(p => {
            const d = presetToDates(p.key);
            return d.from === from && d.to === to;
        })?.label ?? (from && to ? `${from} → ${to}` : "All time");

    return (
        <div className="flex flex-wrap items-center gap-2">
            {/* Preset pills */}
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

            {/* Custom date inputs (shown when Custom… clicked) */}
            {showCustom && (
                <div className="flex items-center gap-2 ml-1">
                    <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
                        className="text-[12px] border border-gray-200 rounded-[6px] px-2 py-1.5 outline-none focus:border-indigo-400" />
                    <span className="text-gray-400 text-[11px]">to</span>
                    <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
                        className="text-[12px] border border-gray-200 rounded-[6px] px-2 py-1.5 outline-none focus:border-indigo-400" />
                    <button
                        onClick={() => { navigate({ from: customFrom, to: customTo }); setShowCustom(false); }}
                        disabled={!customFrom || !customTo}
                        className="px-3 py-1.5 rounded-[6px] bg-[#6366F1] text-white text-[11.5px] font-[500] hover:bg-indigo-700 transition-colors disabled:opacity-40"
                    >Apply</button>
                </div>
            )}

            {/* Compare toggle */}
            <label className="flex items-center gap-1.5 ml-2 cursor-pointer select-none">
                <div
                    onClick={() => navigate({ compare: compare ? "" : "1" })}
                    className={`w-8 h-4 rounded-full transition-colors relative ${compare ? "bg-indigo-500" : "bg-gray-200"}`}
                >
                    <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform ${compare ? "translate-x-4" : "translate-x-0.5"}`} />
                </div>
                <span className="text-[11.5px] text-gray-500 font-[500]">Compare prior period</span>
            </label>
        </div>
    );
}
