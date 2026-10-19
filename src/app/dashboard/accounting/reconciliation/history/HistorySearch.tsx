"use client";

import { useMemo, useState } from "react";
import { PiMagnifyingGlass } from "react-icons/pi";
import { StatementHistoryCard, type HistoryStatement } from "./StatementHistoryCard";

const CARD_STYLE: React.CSSProperties = { border: '1px solid rgba(0,0,0,0.09)' };

/**
 * A transaction that's already reconciled vanishes from the "books" column
 * on the main reconciliation screen by design — there's nothing left to do
 * with it. Without a way to check "was this already matched, and to what?"
 * that reads as a bug report ("it's in the General Ledger but not in
 * reconciliation"), not as the finished state it actually is. This search
 * runs client-side over data already fetched for the page, so it covers
 * every statement at once instead of expanding cards one at a time.
 */
export function HistorySearch({ statements, currency, accountId }: {
    statements: HistoryStatement[]; currency: string; accountId: string;
}) {
    const [query, setQuery] = useState("");
    const q = query.trim().toLowerCase();

    const filtered = useMemo(() => {
        if (!q) return statements;
        return statements
            .map(s => ({
                ...s,
                lines: s.lines.filter(l =>
                    l.description.toLowerCase().includes(q) ||
                    l.matches.some(m =>
                        (m.entryDescription || '').toLowerCase().includes(q) ||
                        (m.entryNumber || '').toLowerCase().includes(q)
                    )
                ),
            }))
            .filter(s => s.lines.length > 0);
    }, [statements, q]);

    return (
        <div className="space-y-3">
            <div className="relative">
                <PiMagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300 text-[14px]" />
                <input
                    type="text"
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    placeholder="Search a transaction you can't find in reconciliation — by description or entry number"
                    className="w-full rounded-[6px] pl-9 pr-3 py-2.5 text-[13px] outline-none focus:ring-1 focus:ring-[#6366F1] bg-white"
                    style={CARD_STYLE}
                />
            </div>

            {q && (
                <p className="text-[11.5px] text-gray-400">
                    {filtered.reduce((n, s) => n + s.lines.length, 0)} matching transaction
                    {filtered.reduce((n, s) => n + s.lines.length, 0) !== 1 ? 's' : ''} found across {filtered.length} statement{filtered.length !== 1 ? 's' : ''}
                </p>
            )}

            {q && filtered.length === 0 && (
                <div className="bg-white rounded-[8px] py-12 flex flex-col items-center text-center gap-1.5" style={CARD_STYLE}>
                    <p className="text-[13px] font-[500] text-gray-900">No match in any statement imported for this account</p>
                    <p className="text-[12px] text-gray-400 max-w-sm">
                        If it's in the General Ledger but not here and not in the unmatched books list either,
                        it may have been posted against a different account — check there next.
                    </p>
                </div>
            )}

            {filtered.length === 0 && !q && (
                <div className="bg-white rounded-[8px] py-16 flex flex-col items-center text-center gap-2" style={CARD_STYLE}>
                    <p className="text-[13px] font-[500] text-gray-900">No statements imported yet for this account</p>
                </div>
            )}

            {filtered.map((s, i) => (
                <StatementHistoryCard key={s.id} statement={s} currency={currency} accountId={accountId} defaultOpen={q ? true : i === 0} />
            ))}
        </div>
    );
}
