"use client";

import { useMemo } from "react";
import {
    AreaChart, Area, XAxis, YAxis,
    CartesianGrid, Tooltip, ResponsiveContainer, ReferenceDot,
} from "recharts";
import { PiTrendUp } from "react-icons/pi";
import { HAIRLINE } from "./SectionHeader";

const LINE_COLOR = '#059669';

function CustomTooltip({ active, payload, label }: any) {
    if (!active || !payload?.length) return null;
    return (
        <div className="bg-white px-4 py-3 rounded-[8px]"
            style={{ border: HAIRLINE, boxShadow: '0 8px 24px rgba(15,23,42,0.1)' }}>
            <p className="text-[10px] font-[600] text-gray-400 uppercase tracking-[0.08em] mb-1.5">{label}</p>
            <p className="text-[13px] font-[700] text-gray-900 font-mono tabular-nums">
                KES {Number(payload[0]?.value ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </p>
        </div>
    );
}

/** The dashboard's centerpiece visualization — a full year of spend with a
    headline total and the peak month called out directly on the chart,
    rather than just another chart competing for attention at equal weight
    with everything else on the page. */
export function OverviewChart({ data }: { data: any[] }) {
    const chartData = useMemo(() => (data ?? []).map(d => ({
        month:  d.month,
        amount: d.amount || 0,
    })), [data]);

    const total = chartData.reduce((s, d) => s + d.amount, 0);
    const peak = chartData.reduce((best, d) => (d.amount > (best?.amount ?? -1) ? d : best), null as null | { month: string; amount: number });
    const latest = chartData[chartData.length - 1];
    const prev = chartData[chartData.length - 2];
    const momChange = prev && prev.amount > 0 ? ((latest.amount - prev.amount) / prev.amount) * 100 : null;

    return (
        <div className="bg-white rounded-[20px] p-6" style={{ border: HAIRLINE, boxShadow: '0 1px 2px rgba(15,23,42,0.03), 0 16px 36px -12px rgba(15,23,42,0.12)' }}>
            <div className="flex items-start justify-between flex-wrap gap-4 mb-1">
                <div className="flex items-center gap-2">
                    <PiTrendUp style={{ color: LINE_COLOR }} className="text-[14px]" />
                    <span className="text-[11px] font-[600] uppercase tracking-[0.09em] text-gray-400">Spend Trajectory · Last 12 months</span>
                </div>
                {momChange !== null && (
                    <span className="text-[11px] font-[600] px-2 py-0.5 rounded-[5px]"
                        style={{ color: momChange <= 0 ? '#059669' : '#dc2626', background: momChange <= 0 ? 'rgba(5,150,105,0.08)' : 'rgba(220,38,38,0.08)' }}>
                        {momChange > 0 ? '+' : ''}{momChange.toFixed(0)}% vs prior month
                    </span>
                )}
            </div>

            <div className="flex items-baseline gap-3 mb-5">
                <span className="text-[34px] font-[700] text-gray-900 tracking-tight tabular-nums leading-none">
                    KES {total.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </span>
                <span className="text-[12.5px] text-gray-400">total this year</span>
            </div>

            <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={chartData} margin={{ top: 20, right: 8, left: 0, bottom: 0 }}>
                    <defs>
                        <linearGradient id="activityTrendFill" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={LINE_COLOR} stopOpacity={0.3} />
                            <stop offset="100%" stopColor={LINE_COLOR} stopOpacity={0} />
                        </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} stroke="rgba(0,0,0,0.045)" />
                    <XAxis
                        dataKey="month"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#9ca3af', fontSize: 11, fontWeight: 500 }}
                        dy={8}
                    />
                    <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#9ca3af', fontSize: 11, fontWeight: 500 }}
                        tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)}
                        width={46}
                    />
                    <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'rgba(5,150,105,0.25)', strokeWidth: 1 }} />
                    <Area
                        type="monotone"
                        dataKey="amount"
                        name="Spending"
                        stroke={LINE_COLOR}
                        strokeWidth={2.5}
                        fill="url(#activityTrendFill)"
                        dot={false}
                        activeDot={{ r: 5, fill: LINE_COLOR, stroke: '#fcfcfb', strokeWidth: 2 }}
                    />
                    {peak && peak.amount > 0 && (
                        <ReferenceDot x={peak.month} y={peak.amount} r={0}
                            label={{
                                value: `Peak · ${peak.month}`,
                                position: 'top',
                                fill: '#059669',
                                fontSize: 10.5,
                                fontWeight: 700,
                            }}
                        />
                    )}
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
}
