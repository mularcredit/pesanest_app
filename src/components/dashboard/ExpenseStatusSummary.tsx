import {
    PiNotePencil,
    PiHourglass,
    PiCheckCircle,
    PiCoins,
    PiXCircle,
} from "react-icons/pi";

interface StatusGroup { count: number; amount: number; }

interface ExpenseStatusSummaryProps {
    draft:     StatusGroup;
    submitted: StatusGroup; // maps to PENDING in requisition model
    pending:   StatusGroup; // unused — kept for API compat
    approved:  StatusGroup;
    paid:      StatusGroup;
    rejected:  StatusGroup;
}

const CARD_STYLE: React.CSSProperties = { border: '1px solid rgba(0,0,0,0.09)' };

const ROWS = [
    { key: 'draft',     label: 'Draft',     Icon: PiNotePencil,  color: '#9ca3af', light: 'rgba(156,163,175,0.1)'  },
    { key: 'submitted', label: 'Pending',   Icon: PiHourglass,   color: '#f59e0b', light: 'rgba(245,158,11,0.1)'   },
    { key: 'approved',  label: 'Approved',  Icon: PiCheckCircle, color: '#6366f1', light: 'rgba(99,102,241,0.1)'   },
    { key: 'paid',      label: 'Paid',      Icon: PiCoins,       color: '#10b981', light: 'rgba(16,185,129,0.1)'   },
    { key: 'rejected',  label: 'Rejected',  Icon: PiXCircle,     color: '#ef4444', light: 'rgba(239,68,68,0.1)'    },
] as const;

export function ExpenseStatusSummary(props: ExpenseStatusSummaryProps) {
    const rows = ROWS.map(r => ({ ...r, ...props[r.key] }));
    const maxAmount = Math.max(...rows.map(r => r.amount), 1);
    const totalCount  = rows.reduce((s, r) => s + r.count,  0);
    const totalAmount = rows.reduce((s, r) => s + r.amount, 0);

    return (
        <div className="bg-white rounded-[8px] p-5" style={CARD_STYLE}>
            {/* Header */}
            <div className="flex items-start justify-between mb-5">
                <div>
                    <h2 className="text-[13.5px] font-[600] text-gray-900">Expense Status</h2>
                    <p className="text-[11.5px] text-gray-400 mt-0.5">All-time breakdown by review stage</p>
                </div>
                <span className="text-[10.5px] font-[600] text-gray-500 px-2 py-0.5 rounded-[4px] mt-0.5"
                    style={{ background: 'rgba(0,0,0,0.05)' }}>
                    {totalCount} total
                </span>
            </div>

            {/* Rows */}
            <div className="space-y-3">
                {rows.map(({ key, label, Icon, color, light, count, amount }) => {
                    const barPct = amount > 0 ? (amount / maxAmount) * 100 : 0;
                    const active = count > 0;

                    return (
                        <div key={key}>
                            <div className="flex items-center gap-3 mb-1.5">
                                {/* Icon */}
                                <div className="w-6 h-6 rounded-[5px] flex items-center justify-center shrink-0"
                                    style={{ background: active ? light : 'rgba(0,0,0,0.04)' }}>
                                    <Icon style={{ color: active ? color : '#d1d5db', fontSize: 12 }} />
                                </div>

                                {/* Label */}
                                <span className="text-[12px] font-[500] w-[64px] shrink-0"
                                    style={{ color: active ? '#374151' : '#d1d5db' }}>
                                    {label}
                                </span>

                                {/* Bar */}
                                <div className="flex-1 h-[5px] rounded-full overflow-hidden"
                                    style={{ background: 'rgba(0,0,0,0.05)' }}>
                                    <div className="h-full rounded-full transition-all duration-500"
                                        style={{ width: `${Math.max(barPct, active ? 2 : 0)}%`, background: color }} />
                                </div>

                                {/* Count */}
                                <span className="text-[12px] font-[700] tabular-nums w-[18px] text-right shrink-0"
                                    style={{ color: active ? color : '#e5e7eb' }}>
                                    {count}
                                </span>

                                {/* Amount */}
                                <span className="text-[11px] font-[500] font-mono tabular-nums w-[76px] text-right shrink-0"
                                    style={{ color: active ? '#111827' : '#e5e7eb' }}>
                                    {active
                                        ? `KES ${amount >= 1000 ? (amount / 1000).toFixed(1) + 'k' : amount}`
                                        : '—'}
                                </span>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Footer total */}
            <div className="mt-4 pt-3 flex items-center justify-between"
                style={{ borderTop: '1px solid rgba(0,0,0,0.06)' }}>
                <span className="text-[11px] text-gray-400">Total value</span>
                <span className="text-[12.5px] font-[700] text-gray-900 font-mono tabular-nums">
                    KES {totalAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </span>
            </div>
        </div>
    );
}
