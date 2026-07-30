import { cn } from "@/lib/utils";
import { PiListDashes, PiArrowsLeftRight } from "react-icons/pi";

const CARD_STYLE: React.CSSProperties = { border: '1px solid rgba(0,0,0,0.09)' };

const STATUS_META: Record<string, { cls: string; border: string }> = {
    APPROVED:         { cls: 'text-emerald-600 bg-emerald-50', border: 'rgba(16,185,129,0.2)' },
    PAID:             { cls: 'text-emerald-600 bg-emerald-50', border: 'rgba(16,185,129,0.2)' },
    REIMBURSED:       { cls: 'text-emerald-600 bg-emerald-50', border: 'rgba(16,185,129,0.2)' },
    PENDING:          { cls: 'text-amber-600 bg-amber-50',     border: 'rgba(245,158,11,0.2)' },
    PENDING_APPROVAL: { cls: 'text-amber-600 bg-amber-50',     border: 'rgba(245,158,11,0.2)' },
    SUBMITTED:        { cls: 'text-blue-600 bg-blue-50',       border: 'rgba(59,130,246,0.2)' },
    REJECTED:         { cls: 'text-rose-600 bg-rose-50',       border: 'rgba(239,68,68,0.2)' },
    DRAFT:            { cls: 'text-gray-500 bg-gray-50',       border: 'rgba(0,0,0,0.09)' },
};

export function TransactionTable({ expenses }: { expenses: any[] }) {
    if (!expenses || expenses.length === 0) {
        return (
            <div className="bg-white rounded-[8px] p-16 flex flex-col items-center justify-center" style={CARD_STYLE}>
                <div className="w-12 h-12 rounded-[7px] bg-gray-50 flex items-center justify-center mb-3"
                    style={{ border: '1px solid rgba(0,0,0,0.07)' }}>
                    <PiListDashes className="text-2xl text-gray-300" />
                </div>
                <p className="text-[13px] font-[500] text-gray-500">No recent transactions</p>
                <p className="text-[12px] text-gray-400 mt-0.5">Expense activity will appear here</p>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-[8px] overflow-hidden" style={CARD_STYLE}>
            <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
                <div>
                    <h2 className="text-[13px] font-[600] text-gray-900">Recent Activity</h2>
                    <p className="text-[11.5px] text-gray-400 mt-0.5">Latest processed transactions</p>
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-left">
                    <thead style={{ borderBottom: '1px solid rgba(0,0,0,0.07)', background: '#FAFAFA' }}>
                        <tr>
                            <th className="py-3 px-5 text-[10.5px] font-[500] text-gray-400 uppercase tracking-[0.06em]">Transaction</th>
                            <th className="py-3 px-5 text-[10.5px] font-[500] text-gray-400 uppercase tracking-[0.06em]">Category</th>
                            <th className="py-3 px-5 text-[10.5px] font-[500] text-gray-400 uppercase tracking-[0.06em]">Date</th>
                            <th className="py-3 px-5 text-[10.5px] font-[500] text-gray-400 uppercase tracking-[0.06em]">Status</th>
                            <th className="py-3 px-5 text-[10.5px] font-[500] text-gray-400 uppercase tracking-[0.06em] text-right">Amount</th>
                        </tr>
                    </thead>
                    <tbody>
                        {expenses.map((expense: any, i: number) => {
                            const meta = STATUS_META[expense.status] || STATUS_META['DRAFT'];
                            return (
                                <tr key={expense.id || i}
                                    className="hover:bg-gray-50/60 transition-colors"
                                    style={i < expenses.length - 1 ? { borderBottom: '1px solid rgba(0,0,0,0.06)' } : {}}>
                                    <td className="py-3.5 px-5">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-[7px] bg-indigo-50 flex items-center justify-center shrink-0">
                                                <PiArrowsLeftRight className="text-[#6366F1] text-[13px]" />
                                            </div>
                                            <div>
                                                <div className="text-[12.5px] font-[500] text-gray-900">{expense.title}</div>
                                                <div className="text-[11px] text-gray-400 mt-0.5">{expense.merchant || '—'}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="py-3.5 px-5">
                                        <span className="text-[10.5px] font-[500] text-gray-500 bg-gray-50 px-2 py-0.5 rounded-[4px]"
                                            style={{ border: '1px solid rgba(0,0,0,0.07)' }}>
                                            {expense.category}
                                        </span>
                                    </td>
                                    <td className="py-3.5 px-5 text-[12px] text-gray-500 font-mono">
                                        {new Date(expense.expenseDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                                    </td>
                                    <td className="py-3.5 px-5">
                                        <span className={cn('text-[10px] font-[500] px-2 py-0.5 rounded-[4px] uppercase tracking-wider', meta.cls)}
                                            style={{ border: `1px solid ${meta.border}` }}>
                                            {expense.status.replace('_', ' ')}
                                        </span>
                                    </td>
                                    <td className="py-3.5 px-5 text-right font-mono font-[600] text-[13px] text-gray-900">
                                        KES {Number(expense.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
