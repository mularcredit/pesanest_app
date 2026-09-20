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

interface WeeklyExpenseChartProps {
    data: { week: string; amount: number; isCurrentWeek: boolean }[];
}

const HAIRLINE = '1px solid rgba(0,0,0,0.07)';

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
        <div className="bg-white rounded-[10px] p-5" style={{ border: HAIRLINE }}>
            <div className="mb-4">
                <h2 className="text-[13.5px] font-[600] text-gray-900">This Month by Week</h2>
                <p className="text-[11.5px] text-gray-400 mt-0.5">Current month expense breakdown</p>
            </div>
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
