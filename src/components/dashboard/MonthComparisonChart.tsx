"use client";
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid,
    Tooltip, Legend, ResponsiveContainer,
} from "recharts";

export interface ComparisonItem {
    category: string;
    thisMonth: number;
    lastMonth: number;
}

interface MonthComparisonChartProps {
    data: ComparisonItem[];
    thisMonthLabel: string;
    lastMonthLabel: string;
}

const CARD_STYLE: React.CSSProperties = { border: '1px solid rgba(0,0,0,0.09)' };

function Tip({ active, payload, label }: any) {
    if (!active || !payload?.length) return null;
    return (
        <div className="bg-white px-4 py-3 rounded-[8px]"
            style={{ border: '1px solid rgba(0,0,0,0.09)', boxShadow: '0 4px 16px rgba(0,0,0,0.08)' }}>
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

export function MonthComparisonChart({ data, thisMonthLabel, lastMonthLabel }: MonthComparisonChartProps) {
    return (
        <div className="bg-white rounded-[8px] p-5" style={CARD_STYLE}>
            <div className="mb-5">
                <h2 className="text-[13.5px] font-[600] text-gray-900">Month-over-Month</h2>
                <p className="text-[11.5px] text-gray-400 mt-0.5">Category spending comparison</p>
            </div>
            <ResponsiveContainer width="100%" height={220}>
                <BarChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }} barGap={4} barCategoryGap="30%">
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
                        width={36}
                    />
                    <Tooltip content={<Tip />} cursor={{ fill: 'rgba(0,0,0,0.025)' }} />
                    <Legend
                        verticalAlign="top"
                        align="right"
                        iconType="square"
                        iconSize={8}
                        wrapperStyle={{ fontSize: 11, color: '#6b7280', paddingBottom: 12 }}
                    />
                    <Bar dataKey="thisMonth" name={thisMonthLabel} fill="#6366f1"            radius={[3, 3, 0, 0]} maxBarSize={24} />
                    <Bar dataKey="lastMonth" name={lastMonthLabel} fill="rgba(156,163,175,0.45)" radius={[3, 3, 0, 0]} maxBarSize={24} />
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
}
