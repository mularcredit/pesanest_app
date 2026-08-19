"use client";

import { useMemo } from "react";
import {
    AreaChart, Area, XAxis, YAxis,
    CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

const CARD_STYLE: React.CSSProperties = {
    border: '1px solid rgba(139,110,255,0.10)',
    background: 'linear-gradient(160deg, rgba(167,139,250,0.04) 0%, rgba(255,255,255,0.95) 40%, rgba(52,211,153,0.025) 100%)',
    backdropFilter: 'blur(14px) saturate(160%)',
    boxShadow: '0 12px 32px rgba(17,24,39,0.05)',
};

const LINE_COLOR = '#6366f1';

function CustomTooltip({ active, payload, label }: any) {
    if (!active || !payload?.length) return null;
    return (
        <div className="bg-white px-4 py-3 rounded-[8px]"
            style={{ border: '1px solid rgba(0,0,0,0.09)', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}>
            <p className="text-[10px] font-[600] text-gray-400 uppercase tracking-[0.08em] mb-1.5">{label}</p>
            <p className="text-[13px] font-[700] text-gray-900 font-mono tabular-nums">
                KES {Number(payload[0]?.value ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </p>
        </div>
    );
}

export function OverviewChart({ data }: { data: any[] }) {
    const chartData = useMemo(() => (data ?? []).map(d => ({
        month:  d.month,
        amount: d.amount || 0,
    })), [data]);

    return (
        <div className="rounded-[20px] p-5" style={CARD_STYLE}>
            <div className="flex items-start justify-between mb-5">
                <div>
                    <h2 className="text-[13.5px] font-[600] text-gray-900">Activity Trends</h2>
                    <p className="text-[11.5px] text-gray-400 mt-0.5">12-month spending overview</p>
                </div>
                <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-[3px]" style={{ background: LINE_COLOR }} />
                    <span className="text-[10.5px] font-[500] text-gray-400 uppercase tracking-[0.06em]">Monthly Spending</span>
                </div>
            </div>

            <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={chartData} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
                    <defs>
                        <linearGradient id="activityTrendFill" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={LINE_COLOR} stopOpacity={0.22} />
                            <stop offset="100%" stopColor={LINE_COLOR} stopOpacity={0} />
                        </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} stroke="rgba(0,0,0,0.04)" />
                    <XAxis
                        dataKey="month"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#9ca3af', fontSize: 10.5, fontWeight: 500 }}
                        dy={8}
                    />
                    <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#9ca3af', fontSize: 10.5, fontWeight: 500 }}
                        tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)}
                        width={46}
                    />
                    <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'rgba(99,102,241,0.25)', strokeWidth: 1 }} />
                    <Area
                        type="monotone"
                        dataKey="amount"
                        name="Spending"
                        stroke={LINE_COLOR}
                        strokeWidth={2}
                        fill="url(#activityTrendFill)"
                        dot={false}
                        activeDot={{ r: 5, fill: LINE_COLOR, stroke: '#fcfcfb', strokeWidth: 2 }}
                    />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
}
