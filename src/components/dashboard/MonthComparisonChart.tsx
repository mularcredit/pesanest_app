"use client";
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid,
    Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { PiChartBarHorizontal } from "react-icons/pi";
import { SectionHeader, CARD_STYLE, HAIRLINE } from "./SectionHeader";

export interface ComparisonItem {
    category: string;
    thisMonth: number;
    lastMonth: number;
}

interface MonthComparisonChartProps {
    data: ComparisonItem[];
    thisMonthLabel: string;
    lastMonthLabel: string;
    compact?: boolean;
}

function Tip({ active, payload, label }: any) {
    if (!active || !payload?.length) return null;
    return (
        <div className="bg-white px-4 py-3 rounded-[8px]"
            style={{ border: HAIRLINE }}>
            <p className="text-[11px] font-[600] text-gray-500 mb-2">{label}</p>
            {payload.map((p: any) => (
                <div key={p.dataKey} className="flex items-center justify-between gap-6 mb-1 last:mb-0">
                    <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-[2px]" style={{ background: p.fill }} />
                        <span className="text-[11px] text-gray-500">{p.name}</span>
                    </div>
                    <span className="text-[12px] font-[600] font-mono text-gray-900">
                        KES {Number(p.value).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </span>
                </div>
            ))}
        </div>
    );
}

export function MonthComparisonChart({ data, thisMonthLabel, lastMonthLabel, compact }: MonthComparisonChartProps) {
    const chartData = compact ? data.slice(0, 3) : data;
    return (
        <div className={compact ? "bg-white rounded-[16px] p-4 h-full" : "bg-white rounded-[16px] p-5"} style={CARD_STYLE}>
            <SectionHeader icon={PiChartBarHorizontal} color="#7C3AED" bg="rgba(124,58,237,0.1)"
                title="Month-over-Month" subtitle={compact ? undefined : "Category spending comparison"}
                right={compact ? (
                    <div className="flex items-center gap-2.5 text-[9.5px] text-gray-400">
                        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-[2px]" style={{ background: '#059669' }} />{thisMonthLabel}</span>
                        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-[2px]" style={{ background: 'rgba(156,163,175,0.45)' }} />{lastMonthLabel}</span>
                    </div>
                ) : undefined}
            />
            <ResponsiveContainer width="100%" height={compact ? 160 : 220}>
                <BarChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }} barGap={4} barCategoryGap="30%">
                    <CartesianGrid vertical={false} stroke="rgba(0,0,0,0.04)" />
                    <XAxis
                        dataKey="category"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 10.5, fill: '#9ca3af' }}
                        interval={0}
                    />
                    <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 11, fill: '#9ca3af' }}
                        tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)}
                        width={44}
                    />
                    <Tooltip content={<Tip />} cursor={{ fill: 'rgba(0,0,0,0.025)' }} />
                    {!compact && (
                        <Legend
                            verticalAlign="top"
                            align="right"
                            iconType="square"
                            iconSize={8}
                            wrapperStyle={{ fontSize: 11, color: '#6b7280', paddingBottom: 12 }}
                        />
                    )}
                    <Bar dataKey="thisMonth" name={thisMonthLabel} fill="#059669"            radius={[3, 3, 0, 0]} maxBarSize={compact ? 16 : 24} />
                    <Bar dataKey="lastMonth" name={lastMonthLabel} fill="rgba(156,163,175,0.45)" radius={[3, 3, 0, 0]} maxBarSize={compact ? 16 : 24} />
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
}
