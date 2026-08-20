
export interface FunnelStage {
    name:  string;
    count: number;
    amount: number;
    color: string;
    bg:    string;
}

function fmtAmt(n: number) {
    if (n === 0) return null;
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}k`;
    return n.toFixed(0);
}

export function ExpenseFunnel({ stages }: { stages: FunnelStage[] }) {
    if (stages.every(s => s.count === 0)) return null;

    const total    = stages.reduce((s, r) => s + r.count, 0);
    const maxCount = Math.max(...stages.map(s => s.count), 1);

    return (
        <div className="card-premium p-5">

            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h2 className="text-[13.5px] font-[600] text-gray-900">Expense Pipeline</h2>
                    <p className="text-[11.5px] text-gray-400 mt-0.5">Expense lifecycle status</p>
                </div>
                <span className="text-[10.5px] font-[600] text-gray-500 px-2.5 py-1 rounded-[5px]"
                    style={{ background: 'rgba(0,0,0,0.04)' }}>
                    {total} total
                </span>
            </div>

            {/* Pipeline nodes */}
            <div className="flex items-start gap-0 mb-5 overflow-x-auto pb-1">
                {stages.map((stage, i) => {
                    const active = stage.count > 0;
                    const cvr    = i > 0 && stages[i - 1].count > 0
                        ? Math.round((stage.count / stages[i - 1].count) * 100)
                        : null;

                    return (
                        <div key={stage.name} className="flex items-center flex-1 min-w-0">

                            {/* Connector + conversion */}
                            {i > 0 && (
                                <div className="flex flex-col items-center shrink-0 px-1">
                                    <div className="h-px w-6 mt-[-4px]"
                                        style={{ background: active ? stage.color + '55' : 'rgba(0,0,0,0.08)' }} />
                                    {cvr !== null && (
                                        <span className="text-[8.5px] font-[600] tabular-nums mt-0.5"
                                            style={{ color: active ? stage.color : '#d1d5db' }}>
                                            {cvr}%
                                        </span>
                                    )}
                                </div>
                            )}

                            {/* Stage node */}
                            <div className="flex flex-col items-center flex-1 min-w-0">
                                {/* Circle */}
                                <div className="w-10 h-10 rounded-full flex items-center justify-center mb-2 transition-all"
                                    style={{
                                        background: active ? stage.bg : 'rgba(0,0,0,0.03)',
                                        border: `2px solid ${active ? stage.color + '60' : 'rgba(0,0,0,0.08)'}`,
                                    }}>
                                    <span className="text-[14px] font-[700] tabular-nums"
                                        style={{ color: active ? stage.color : '#d1d5db' }}>
                                        {stage.count}
                                    </span>
                                </div>

                                {/* Label */}
                                <span className="text-[10.5px] font-[500] text-center leading-tight truncate w-full px-1"
                                    style={{ color: active ? '#374151' : '#d1d5db' }}>
                                    {stage.name}
                                </span>

                                {/* Amount */}
                                {fmtAmt(stage.amount) && (
                                    <span className="text-[9.5px] font-mono font-[600] mt-0.5 tabular-nums"
                                        style={{ color: stage.color }}>
                                        KES {fmtAmt(stage.amount)}
                                    </span>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Proportion bars */}
            <div className="space-y-2">
                {stages.filter(s => s.count > 0).map(stage => {
                    const pct = (stage.count / maxCount) * 100;
                    return (
                        <div key={stage.name} className="flex items-center gap-3">
                            <span className="text-[10.5px] font-[500] w-[58px] shrink-0"
                                style={{ color: '#9ca3af' }}>
                                {stage.name}
                            </span>
                            <div className="flex-1 h-[5px] rounded-full overflow-hidden"
                                style={{ background: 'rgba(0,0,0,0.05)' }}>
                                <div className="h-full rounded-full"
                                    style={{ width: `${pct}%`, background: stage.color }} />
                            </div>
                            <span className="text-[10.5px] font-[600] tabular-nums w-[18px] text-right shrink-0"
                                style={{ color: stage.color }}>
                                {stage.count}
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
