"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { PiCaretDown, PiCheckCircle, PiClock } from "react-icons/pi";

const CARD_STYLE: React.CSSProperties = { border: '1px solid rgba(0,0,0,0.09)' };
const ROW_BORDER: React.CSSProperties = { borderBottom: '1px solid rgba(0,0,0,0.06)' };

export interface HistoryMatch {
    matchedAt: string;
    matchedByName: string | null;
    matchType: string;
    entryNumber: string | null;
    entryDescription: string | null;
    entryDate: string | null;
}

export interface HistoryLine {
    id: string;
    date: string;
    description: string;
    amount: number;
    isMatched: boolean;
    /** Can hold more than one entry for a split match (e.g. one bank line grouped against several book entries). */
    matches: HistoryMatch[];
}

export interface HistoryStatement {
    id: string;
    periodStart: string;
    periodEnd: string;
    importedAt: string;
    importedByName: string | null;
    lines: HistoryLine[];
}

function fmt(amount: number, currency: string) {
    return `${currency} ${amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
}

export function StatementHistoryCard({ statement, currency, defaultOpen = false }: {
    statement: HistoryStatement; currency: string; defaultOpen?: boolean;
}) {
    const [open, setOpen] = useState(defaultOpen);
    const matched = statement.lines.filter(l => l.isMatched);
    const unmatched = statement.lines.filter(l => !l.isMatched);

    return (
        <div className="bg-white rounded-[8px] overflow-hidden" style={CARD_STYLE}>
            <button onClick={() => setOpen(o => !o)}
                className="w-full flex items-center justify-between px-5 py-3.5 text-left hover:bg-gray-50/60 transition-colors">
                <div>
                    <p className="text-[12.5px] font-[600] text-gray-900">
                        {new Date(statement.periodStart).toLocaleDateString()} – {new Date(statement.periodEnd).toLocaleDateString()}
                    </p>
                    <p className="text-[11px] text-gray-400 mt-0.5">
                        Imported {new Date(statement.importedAt).toLocaleDateString()}
                        {statement.importedByName ? ` by ${statement.importedByName}` : ''}
                        {' · '}{statement.lines.length} transaction{statement.lines.length !== 1 ? 's' : ''}
                    </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                    <span className="inline-flex items-center gap-1 text-[11px] font-[500] px-2 py-0.5 rounded-[4px] text-emerald-600 bg-emerald-50"
                        style={{ border: '1px solid rgba(16,185,129,0.2)' }}>
                        <PiCheckCircle className="text-[10px]" /> {matched.length} matched
                    </span>
                    {unmatched.length > 0 && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-[500] px-2 py-0.5 rounded-[4px] text-amber-600 bg-amber-50"
                            style={{ border: '1px solid rgba(245,158,11,0.2)' }}>
                            <PiClock className="text-[10px]" /> {unmatched.length} open
                        </span>
                    )}
                    <PiCaretDown className={cn('text-gray-300 text-[13px] transition-transform', open && 'rotate-180')} />
                </div>
            </button>

            {open && (
                <div className="overflow-x-auto" style={{ borderTop: '1px solid rgba(0,0,0,0.07)' }}>
                    <table className="w-full text-[12px]">
                        <thead>
                            <tr className="bg-gray-50/60" style={ROW_BORDER}>
                                <th className="px-4 py-2 text-left text-[10.5px] font-[500] uppercase tracking-wide text-gray-400">Date</th>
                                <th className="px-4 py-2 text-left text-[10.5px] font-[500] uppercase tracking-wide text-gray-400">Bank transaction</th>
                                <th className="px-4 py-2 text-right text-[10.5px] font-[500] uppercase tracking-wide text-gray-400">Amount</th>
                                <th className="px-4 py-2 text-left text-[10.5px] font-[500] uppercase tracking-wide text-gray-400">Matched to</th>
                                <th className="px-4 py-2 text-left text-[10.5px] font-[500] uppercase tracking-wide text-gray-400">Matched by</th>
                            </tr>
                        </thead>
                        <tbody>
                            {statement.lines.map((line, i) => (
                                <tr key={line.id} className="hover:bg-gray-50/40" style={i < statement.lines.length - 1 ? ROW_BORDER : {}}>
                                    <td className="px-4 py-2.5 text-gray-500 whitespace-nowrap">{new Date(line.date).toLocaleDateString()}</td>
                                    <td className="px-4 py-2.5 text-gray-800 max-w-[220px] truncate" title={line.description}>{line.description}</td>
                                    <td className="px-4 py-2.5 text-right font-mono font-[500] text-gray-900 whitespace-nowrap">{fmt(line.amount, currency)}</td>
                                    <td className="px-4 py-2.5">
                                        {line.matches.length > 0 ? (
                                            <div className="space-y-1.5">
                                                {line.matches.map((m, mi) => (
                                                    <div key={mi}>
                                                        <p className="text-gray-800 truncate max-w-[200px]" title={m.entryDescription || undefined}>
                                                            {m.entryNumber || '—'} {m.entryDescription ? `· ${m.entryDescription}` : ''}
                                                        </p>
                                                        <p className="text-[10.5px] text-gray-400">
                                                            {m.entryDate ? new Date(m.entryDate).toLocaleDateString() : ''}
                                                            {line.matches.length > 1 ? ` · split match` : ''}
                                                        </p>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <span className="text-amber-600 text-[11.5px] font-[500]">Not matched</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-2.5 text-gray-500">
                                        {line.matches[0] ? (
                                            <div>
                                                <p>{line.matches[0].matchedByName || '—'}</p>
                                                <p className="text-[10.5px] text-gray-400">{new Date(line.matches[0].matchedAt).toLocaleDateString()}</p>
                                            </div>
                                        ) : '—'}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
