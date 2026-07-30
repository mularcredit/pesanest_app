interface CategoryBreakdownProps {
    data: { category: string; amount: number; count: number }[];
    totalAmount: number;
}

const CARD_STYLE: React.CSSProperties = { border: '1px solid rgba(0,0,0,0.09)' };

const BAR_COLORS = [
    '#6366f1',
    '#10b981',
    '#f59e0b',
    '#3b82f6',
    '#8b5cf6',
    '#ec4899',
    '#14b8a6',
    '#f97316',
];

export function CategoryBreakdown({ data, totalAmount }: CategoryBreakdownProps) {
    const maxAmount = data.length > 0 ? Math.max(...data.map((d) => d.amount)) : 1;
    const hasData = data.length > 0;

    return (
        <div className="bg-white rounded-[8px] p-5" style={CARD_STYLE}>
            {/* Header */}
            <div className="mb-5">
                <h2 className="text-[13.5px] font-[600] text-gray-900">Spending by Category</h2>
                <p className="text-[11.5px] text-gray-400 mt-0.5">Top spending categories this year</p>
            </div>

            {hasData ? (
                <div className="space-y-3">
                    {data.map((item, index) => {
                        const color = BAR_COLORS[index % BAR_COLORS.length];
                        const barWidth = maxAmount > 0 ? (item.amount / maxAmount) * 100 : 0;
                        const pct = totalAmount > 0 ? ((item.amount / totalAmount) * 100).toFixed(1) : '0.0';

                        return (
                            <div key={item.category} className="grid items-center gap-3"
                                style={{ gridTemplateColumns: '140px 1fr 160px' }}>
                                {/* Left: dot + name */}
                                <div className="flex items-center gap-2 min-w-0">
                                    <span
                                        className="flex-shrink-0 w-2 h-2 rounded-full"
                                        style={{ backgroundColor: color }}
                                    />
                                    <span className="text-[12px] font-[500] text-gray-700 truncate">
                                        {item.category}
                                    </span>
                                </div>

                                {/* Middle: bar */}
                                <div className="h-[5px] rounded-full bg-gray-100 overflow-hidden">
                                    <div
                                        className="h-full rounded-full"
                                        style={{ width: `${barWidth}%`, backgroundColor: color }}
                                    />
                                </div>

                                {/* Right: pct + amount + count */}
                                <div className="flex items-center justify-end gap-2">
                                    <span className="text-[11px] font-[500] text-gray-400 w-[36px] text-right">
                                        {pct}%
                                    </span>
                                    <span className="text-[11.5px] font-[600] text-gray-800 font-mono w-[80px] text-right">
                                        KES {item.amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                    </span>
                                    <span
                                        className="text-[10px] font-[500] text-gray-500 px-1.5 py-0.5 rounded-[4px] w-[28px] text-center"
                                        style={{ background: 'rgba(0,0,0,0.05)' }}
                                    >
                                        {item.count}
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                <div>
                    <p className="text-[12px] text-gray-400 mb-4">No expense data yet</p>
                    <div className="space-y-3">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="grid items-center gap-3"
                                style={{ gridTemplateColumns: '140px 1fr 160px' }}>
                                <div className="flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-gray-200" />
                                    <span className="text-[12px] text-gray-300">—</span>
                                </div>
                                <div className="h-[5px] rounded-full bg-gray-100" />
                                <div className="flex items-center justify-end gap-2">
                                    <span className="text-[11px] text-gray-300 w-[36px] text-right">—</span>
                                    <span className="text-[11.5px] text-gray-300 font-mono w-[80px] text-right">—</span>
                                    <span
                                        className="text-[10px] text-gray-300 px-1.5 py-0.5 rounded-[4px] w-[28px] text-center"
                                        style={{ background: 'rgba(0,0,0,0.04)' }}
                                    >
                                        —
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
