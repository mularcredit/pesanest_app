import { cn } from "@/lib/utils";

const CARD_STYLE: React.CSSProperties = { border: '1px solid rgba(0,0,0,0.09)' };

const STAGES = [
    { key: 'DRAFT',            label: 'Draft',           color: '#9ca3af', bg: 'rgba(156,163,175,0.12)', border: 'rgba(156,163,175,0.25)' },
    { key: 'SUBMITTED',        label: 'Submitted',       color: '#3b82f6', bg: 'rgba(59,130,246,0.1)',   border: 'rgba(59,130,246,0.25)' },
    { key: 'PENDING_APPROVAL', label: 'Pending Review',  color: '#f59e0b', bg: 'rgba(245,158,11,0.1)',   border: 'rgba(245,158,11,0.25)' },
    { key: 'APPROVED',         label: 'Approved',        color: '#6366f1', bg: 'rgba(99,102,241,0.1)',   border: 'rgba(99,102,241,0.25)' },
    { key: 'PAID',             label: 'Paid',            color: '#10b981', bg: 'rgba(16,185,129,0.1)',   border: 'rgba(16,185,129,0.25)' },
    { key: 'REIMBURSED',       label: 'Reimbursed',      color: '#10b981', bg: 'rgba(16,185,129,0.1)',   border: 'rgba(16,185,129,0.25)' },
    { key: 'REJECTED',         label: 'Rejected',        color: '#ef4444', bg: 'rgba(239,68,68,0.1)',    border: 'rgba(239,68,68,0.25)' },
];

interface Row {
    status: string;
    count: number;
    amount: number;
}

export function ExpensePipeline({ rows }: { rows: Row[] }) {
    const maxAmount = Math.max(...rows.map(r => r.amount), 1);
    const totalCount = rows.reduce((s, r) => s + r.count, 0);
    const hasData = rows.some(r => r.count > 0);

    return (
        <div className="bg-white rounded-[8px] overflow-hidden" style={CARD_STYLE}>
            <div className="px-5 py-4 flex items-center justify-between"
                style={{ borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
                <div>
                    <h2 className="text-[13px] font-[600] text-gray-900">Expense Pipeline</h2>
                    <p className="text-[11.5px] text-gray-400 mt-0.5">
                        {hasData ? `${totalCount} total expense${totalCount !== 1 ? 's' : ''} tracked` : 'Expense lifecycle tracker'}
                    </p>
                </div>
                {hasData && (
                    <span className="text-[10.5px] font-[500] text-gray-400 px-2 py-0.5 rounded-[4px]"
                        style={{ border: '1px solid rgba(0,0,0,0.08)', background: '#FAFAFA' }}>
                        {totalCount} total
                    </span>
                )}
            </div>

            <div className="p-5 space-y-3">
                {STAGES.map((stage) => {
                    const row = rows.find(r => r.status === stage.key);
                    const count = row?.count ?? 0;
                    const amount = row?.amount ?? 0;
                    const pct = maxAmount > 0 ? (amount / maxAmount) * 100 : 0;

                    return (
                        <div key={stage.key} className="flex items-center gap-4">
                            {/* Status label */}
                            <div className="w-[110px] shrink-0 flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full shrink-0"
                                    style={{ background: stage.color }} />
                                <span className="text-[11.5px] font-[500] text-gray-600 truncate">
                                    {stage.label}
                                </span>
                            </div>

                            {/* Progress bar */}
                            <div className="flex-1 h-[6px] rounded-full overflow-hidden"
                                style={{ background: 'rgba(0,0,0,0.05)' }}>
                                <div className="h-full rounded-full transition-all duration-500"
                                    style={{
                                        width: `${Math.max(pct, count > 0 ? 2 : 0)}%`,
                                        background: stage.color,
                                        opacity: count > 0 ? 1 : 0.3,
                                    }} />
                            </div>

                            {/* Count */}
                            <div className="w-[28px] shrink-0 text-right">
                                <span className="text-[11px] font-[600] font-mono"
                                    style={{ color: count > 0 ? stage.color : '#d1d5db' }}>
                                    {count}
                                </span>
                            </div>

                            {/* Amount */}
                            <div className="w-[110px] shrink-0 text-right">
                                <span className="text-[11.5px] font-[600] font-mono tabular-nums"
                                    style={{ color: count > 0 ? '#111827' : '#d1d5db' }}>
                                    {count > 0
                                        ? `KES ${amount.toLocaleString(undefined, { minimumFractionDigits: 0 })}`
                                        : '—'
                                    }
                                </span>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
