"use client";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { PiGaugeFill } from "react-icons/pi";
import { SectionHeader, CARD_STYLE, HAIRLINE } from "./SectionHeader";

interface ApprovalGaugeProps {
    approved: number;
    pending: number;
    rejected: number;
}

export function ApprovalGauge({ approved, pending, rejected }: ApprovalGaugeProps) {
    const total = approved + pending + rejected;
    const rate  = total > 0 ? (approved / total) * 100 : 0;

    const slices = total > 0
        ? [
            { name: 'Approved', value: approved, color: '#059669' },
            { name: 'Pending',  value: pending,  color: '#d97706' },
            { name: 'Rejected', value: rejected, color: '#dc2626' },
          ]
        : [{ name: 'Empty', value: 1, color: 'rgba(0,0,0,0.06)' }];

    return (
        <div className="bg-white rounded-[16px] p-5" style={CARD_STYLE}>
            <SectionHeader icon={PiGaugeFill} color="#059669" bg="rgba(5,150,105,0.1)"
                title="Approval Rate" subtitle="All-time expense outcomes" />

            {/* Ring + center label */}
            <div className="relative h-[150px]">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={slices}
                            cx="50%"
                            cy="50%"
                            innerRadius={48}
                            outerRadius={68}
                            paddingAngle={total > 0 ? 2 : 0}
                            dataKey="value"
                            startAngle={90}
                            endAngle={-270}
                            strokeWidth={0}
                        >
                            {slices.map((s, i) => <Cell key={i} fill={s.color} />)}
                        </Pie>
                    </PieChart>
                </ResponsiveContainer>

                {/* Centered number */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-[30px] font-[700] text-gray-900 leading-none tabular-nums">
                        {rate.toFixed(0)}%
                    </span>
                    <span className="text-[10px] font-[500] text-gray-400 mt-1 uppercase tracking-[0.08em]">
                        approved
                    </span>
                </div>
            </div>

            {/* Three legend tiles */}
            <div className="grid grid-cols-3 gap-2 mt-3">
                {[
                    { label: 'Approved', count: approved, color: '#059669' },
                    { label: 'Pending',  count: pending,  color: '#d97706' },
                    { label: 'Rejected', count: rejected, color: '#dc2626' },
                ].map(({ label, count, color }) => (
                    <div key={label} className="rounded-[6px] py-2 px-1 text-center" style={{ border: HAIRLINE }}>
                        <div className="flex items-center justify-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: color }} />
                            <span className="text-[17px] font-[700] tabular-nums text-gray-900">{count}</span>
                        </div>
                        <div className="text-[9.5px] font-[500] text-gray-400 mt-0.5">{label}</div>
                    </div>
                ))}
            </div>
        </div>
    );
}
