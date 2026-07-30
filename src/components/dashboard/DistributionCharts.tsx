"use client";

import { useMemo } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { cn } from "@/lib/utils";

const CARD_STYLE: React.CSSProperties = { border: '1px solid rgba(0,0,0,0.09)' };

interface DistributionChartsProps {
    expensesData: [string, number][];
    requisitionsData: [string, number][];
    title1?: string;
    title2?: string;
    className?: string;
}

const COLORS_CATEGORY = [
    '#6366f1', '#10b981', '#f59e0b', '#3b82f6',
    '#8b5cf6', '#ec4899', '#14b8a6', '#f97316',
];

const COLORS_STATUS = [
    '#10b981', '#6366f1', '#f59e0b', '#9ca3af', '#ef4444', '#3b82f6',
];

const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-white p-3 rounded-[8px] min-w-[180px]"
                style={{ border: '1px solid rgba(0,0,0,0.09)', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}>
                <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-[2px] inline-block"
                            style={{ backgroundColor: payload[0].payload.fill }} />
                        <span className="text-[11px] font-[500] text-gray-600 capitalize">
                            {String(payload[0].name).replace(/_/g, ' ').toLowerCase()}
                        </span>
                    </div>
                    <span className="text-[12px] font-[600] text-gray-900 font-mono">
                        KES {Number(payload[0].value).toLocaleString(undefined, { minimumFractionDigits: 0 })}
                    </span>
                </div>
            </div>
        );
    }
    return null;
};

export function DistributionCharts({
    expensesData,
    requisitionsData,
    title1 = "By Category",
    title2 = "By Status",
    className,
}: DistributionChartsProps) {
    const formattedExpenses = useMemo(
        () => expensesData.map(([name, value]) => ({ name, value })),
        [expensesData]
    );
    const formattedRequisitions = useMemo(
        () => requisitionsData.map(([name, value]) => ({ name, value })),
        [requisitionsData]
    );

    if (!expensesData.length && !requisitionsData.length) return null;

    const renderPieCard = (title: string, data: any[], colors: string[]) => (
        <div className="bg-white rounded-[8px] p-5 flex flex-col" style={CARD_STYLE}>
            <p className="text-[10.5px] font-[500] uppercase tracking-[0.08em] text-gray-400 mb-4">{title}</p>
            <div className="h-[260px] w-full">
                {data.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={data}
                                cx="50%"
                                cy="46%"
                                innerRadius={68}
                                outerRadius={88}
                                paddingAngle={3}
                                dataKey="value"
                            >
                                {data.map((_, index) => (
                                    <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                                ))}
                            </Pie>
                            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
                            <Legend
                                verticalAlign="bottom"
                                height={40}
                                iconType="square"
                                iconSize={8}
                                formatter={(value) => (
                                    <span className="text-[9.5px] font-[500] text-gray-500 tracking-[0.04em] capitalize ml-1">
                                        {String(value).replace(/_/g, ' ').toLowerCase()}
                                    </span>
                                )}
                            />
                        </PieChart>
                    </ResponsiveContainer>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center gap-2">
                        <div className="w-[140px] h-[140px] rounded-full"
                            style={{ border: '1.5px dashed rgba(0,0,0,0.1)' }} />
                        <p className="text-[11px] font-[500] text-gray-300 uppercase tracking-[0.1em]">No data</p>
                    </div>
                )}
            </div>
        </div>
    );

    return (
        <div className={cn("grid grid-cols-1 md:grid-cols-2 gap-4", className)}>
            {renderPieCard(title1, formattedExpenses, COLORS_CATEGORY)}
            {renderPieCard(title2, formattedRequisitions, COLORS_STATUS)}
        </div>
    );
}
