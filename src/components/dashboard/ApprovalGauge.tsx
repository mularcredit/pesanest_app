"use client";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";

const CARD_STYLE: React.CSSProperties = { border: '1px solid rgba(0,0,0,0.09)' };

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
            { name: 'Approved', value: approved, color: '#10b981' },
            { name: 'Pending',  value: pending,  color: '#f59e0b' },
            { name: 'Rejected', value: rejected, color: '#ef4444' },
          ]
        : [{ name: 'Empty', value: 1, color: 'rgba(0,0,0,0.06)' }];

    return (
        <div className="bg-white rounded-[8px] p-5" style={CARD_STYLE}>
            <div className="mb-1">
                <h2 className="text-[13.5px] font-[600] text-gray-900">Approval Rate</h2>
                <p className="text-[11.5px] text-gray-400 mt-0.5">All-time expense outcomes</p>
            </div>

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
                    { label: 'Approved', count: approved, color: '#10b981', bg: 'rgba(16,185,129,0.08)' },
                    { label: 'Pending',  count: pending,  color: '#f59e0b', bg: 'rgba(245,158,11,0.08)' },
                    { label: 'Rejected', count: rejected, color: '#ef4444', bg: 'rgba(239,68,68,0.08)'  },
                ].map(({ label, count, color, bg }) => (
                    <div key={label} className="rounded-[6px] py-2 px-1 text-center" style={{ background: bg }}>
                        <div className="text-[17px] font-[700] tabular-nums" style={{ color }}>{count}</div>
                        <div className="text-[9.5px] font-[500] text-gray-400 mt-0.5">{label}</div>
                    </div>
                ))}
            </div>
        </div>
    );
}
