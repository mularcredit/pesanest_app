import { PiWallet } from "react-icons/pi";
import { CARD_STYLE, HAIRLINE } from "./SectionHeader";

interface BudgetRow {
    category: string;
    allocated: number;
    spent: number;
}

function pct(spent: number, allocated: number) {
    if (allocated <= 0) return 0;
    return Math.min((spent / allocated) * 100, 100);
}

function barColor(p: number) {
    if (p >= 90) return '#dc2626';
    if (p >= 70) return '#d97706';
    return '#059669';
}

function barBg(p: number) {
    if (p >= 90) return 'rgba(220,38,38,0.08)';
    if (p >= 70) return 'rgba(217,119,6,0.08)';
    return 'rgba(5,150,105,0.08)';
}

export function BudgetUtilization({ budgets }: { budgets: BudgetRow[] }) {
    if (!budgets.length) return null;

    return (
        <div className="bg-white rounded-[16px] overflow-hidden" style={CARD_STYLE}>
            <div className="px-5 py-4 flex items-center gap-3" style={{ borderBottom: HAIRLINE }}>
                <div className="w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0" style={{ background: 'rgba(5,150,105,0.1)' }}>
                    <PiWallet style={{ color: '#059669' }} className="text-[16px]" />
                </div>
                <div>
                    <h2 className="text-[13px] font-[600] text-gray-900">Budget Utilization</h2>
                    <p className="text-[11.5px] text-gray-400 mt-0.5">This month · Allocated vs spent</p>
                </div>
            </div>
            <div className="p-5 space-y-4">
                {budgets.map((b, i) => {
                    const p = pct(b.spent, b.allocated);
                    const color = barColor(p);
                    const remaining = Math.max(b.allocated - b.spent, 0);

                    return (
                        <div key={i}>
                            <div className="flex items-center justify-between mb-1.5">
                                <span className="text-[12px] font-[500] text-gray-700 truncate max-w-[160px]">
                                    {b.category}
                                </span>
                                <div className="flex items-center gap-2 shrink-0">
                                    <span className="text-[10.5px] font-[600] font-mono"
                                        style={{ color }}>
                                        {p.toFixed(0)}%
                                    </span>
                                    <span className="text-[10px] text-gray-400 font-mono">
                                        KES {remaining.toLocaleString(undefined, { maximumFractionDigits: 0 })} left
                                    </span>
                                </div>
                            </div>
                            <div className="h-[6px] w-full rounded-full overflow-hidden"
                                style={{ background: 'rgba(0,0,0,0.05)' }}>
                                <div className="h-full rounded-full transition-all duration-500"
                                    style={{ width: `${p}%`, background: color }} />
                            </div>
                            <div className="flex justify-between mt-1">
                                <span className="text-[10px] text-gray-400 font-mono">
                                    KES {b.spent.toLocaleString(undefined, { maximumFractionDigits: 0 })} spent
                                </span>
                                <span className="text-[10px] text-gray-400 font-mono">
                                    KES {b.allocated.toLocaleString(undefined, { maximumFractionDigits: 0 })} budget
                                </span>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
