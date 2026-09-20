"use client";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";

const HAIRLINE = '1px solid rgba(0,0,0,0.07)';

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
        <div className="bg-white rounded-[10px] p-5" style={{ border: HAIRLINE }}>
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
