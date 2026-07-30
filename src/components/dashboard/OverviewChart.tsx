"use client";

import { useMemo } from "react";
import {
    BarChart, Bar, XAxis, YAxis,
    CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";

const CARD_STYLE: React.CSSProperties = { border: '1px solid rgba(0,0,0,0.09)' };

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

    const maxVal = Math.max(...chartData.map(d => d.amount), 1);

    return (
        <div className="bg-white rounded-[8px] p-5" style={CARD_STYLE}>
            <div className="flex items-start justify-between mb-5">
                <div>
                    <h2 className="text-[13.5px] font-[600] text-gray-900">Activity Trends</h2>
                    <p className="text-[11.5px] text-gray-400 mt-0.5">12-month spending overview</p>
                </div>
                <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-[3px]" style={{ background: '#6366f1' }} />
                    <span className="text-[10.5px] font-[500] text-gray-400 uppercase tracking-[0.06em]">Monthly Spending</span>
                </div>
            </div>

            <ResponsiveContainer width="100%" height={260}>
                <BarChart data={chartData} margin={{ top: 8, right: 4, left: -10, bottom: 0 }}>
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
                        width={38}
                    />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0,0,0,0.025)' }} />
                    <Bar dataKey="amount" name="Spending" maxBarSize={36} radius={[4, 4, 0, 0]}>
                        {chartData.map((entry, i) => {
                            const intensity = maxVal > 0 ? entry.amount / maxVal : 0;
                            const opacity   = 0.2 + intensity * 0.8;
                            return <Cell key={i} fill={`rgba(99,102,241,${opacity})`} />;
                        })}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
}
