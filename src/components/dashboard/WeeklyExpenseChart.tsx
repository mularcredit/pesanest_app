"use client";
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Cell,
} from "recharts";
import { PiCalendarBlank } from "react-icons/pi";
import { SectionHeader, CARD_STYLE, HAIRLINE } from "./SectionHeader";

interface WeeklyExpenseChartProps {
    data: { week: string; amount: number; isCurrentWeek: boolean }[];
}

function CustomTooltip({ active, payload, label }: any) {
    if (!active || !payload?.length) return null;
    return (
        <div
            className="px-3 py-2 rounded-[8px] bg-white"
            style={{ border: HAIRLINE }}
        >
            <p className="text-[11px] text-gray-400 mb-0.5">{label}</p>
            <p className="text-[13px] font-[600] text-gray-900 font-mono">
                KES {Number(payload[0].value).toLocaleString(undefined, { minimumFractionDigits: 0 })}
            </p>
        </div>
    );
}

export function WeeklyExpenseChart({ data }: WeeklyExpenseChartProps) {
    return (
        <div className="bg-white rounded-[16px] p-5" style={CARD_STYLE}>
            <SectionHeader icon={PiCalendarBlank} color="#059669" bg="rgba(5,150,105,0.1)"
                title="This Month by Week" subtitle="Current month expense breakdown" />
            <ResponsiveContainer width="100%" height={200}>
                <BarChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke="rgba(0,0,0,0.04)" />
                    <XAxis
                        dataKey="week"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 11, fill: '#9ca3af' }}
                    />
                    <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 11, fill: '#9ca3af' }}
                        tickFormatter={(v) => v >= 1000 ? (v / 1000).toFixed(0) + 'k' : String(v)}
                        width={44}
                    />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0,0,0,0.03)' }} />
                    <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
                        {data.map((entry, index) => (
                            <Cell
                                key={`cell-${index}`}
                                fill={entry.isCurrentWeek ? '#059669' : 'rgba(5,150,105,0.3)'}
                            />
                        ))}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
}
