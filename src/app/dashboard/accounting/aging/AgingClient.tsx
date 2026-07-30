'use client';

import { useState, useEffect, Fragment } from 'react';
import { cn } from '@/lib/utils';
import {
    PiArrowCounterClockwise, PiWarning, PiCheckCircle,
    PiCaretDown, PiCaretUp, PiReceiptX,
} from 'react-icons/pi';

// ── Constants ────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
    `KES ${new Intl.NumberFormat('en-US', { minimumFractionDigits: 2 }).format(n)}`;

function fmtDate(d: string | Date) {
    return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

type BucketKey = 'current' | '1_30' | '31_60' | '61_90' | '91_plus';

interface BucketMeta {
    label: string;
    sublabel: string;
    barColor: string;
    amtColor: string;
    badgeBg: string;
    badgeText: string;
    badgeBorder: string;
}

const BUCKETS: Record<BucketKey, BucketMeta> = {
    current:  { label: 'Current',       sublabel: 'Not yet due',      barColor: 'bg-gray-300',   amtColor: 'text-gray-900',   badgeBg: 'bg-gray-100',   badgeText: 'text-gray-500',   badgeBorder: 'rgba(0,0,0,0.09)' },
    '1_30':   { label: '1–30 days',     sublabel: 'Slightly overdue', barColor: 'bg-amber-300',  amtColor: 'text-amber-600',  badgeBg: 'bg-amber-50',   badgeText: 'text-amber-600',  badgeBorder: 'rgba(245,158,11,0.2)' },
    '31_60':  { label: '31–60 days',    sublabel: 'Needs attention',  barColor: 'bg-orange-400', amtColor: 'text-orange-600', badgeBg: 'bg-orange-50',  badgeText: 'text-orange-600', badgeBorder: 'rgba(249,115,22,0.2)' },
    '61_90':  { label: '61–90 days',    sublabel: 'High risk',        barColor: 'bg-rose-400',   amtColor: 'text-rose-600',   badgeBg: 'bg-rose-50',    badgeText: 'text-rose-600',   badgeBorder: 'rgba(239,68,68,0.2)' },
    '91_plus':{ label: '91+ days',      sublabel: 'Critical',         barColor: 'bg-rose-700',   amtColor: 'text-rose-700',   badgeBg: 'bg-rose-100',   badgeText: 'text-rose-700',   badgeBorder: 'rgba(185,28,28,0.25)' },
};

const CARD_STYLE: React.CSSProperties = { border: '1px solid rgba(0,0,0,0.09)' };
const ROW_BORDER: React.CSSProperties = { borderBottom: '1px solid rgba(0,0,0,0.06)' };

// ── Component ────────────────────────────────────────────────────────────────

export function AgingClient() {
    const [type, setType] = useState<'AR' | 'AP'>('AR');
    const [asOf, setAsOf] = useState(new Date().toISOString().slice(0, 10));
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [expanded, setExpanded] = useState<BucketKey | null>(null);

    const load = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/accounting/aging?type=${type}&asOf=${asOf}`);
            setData(await res.json());
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, [type, asOf]);

    const buckets = data?.buckets ?? {};
    const totalAging = data?.agingTotal ?? 0;
    const glBalance = data?.glBalance ?? 0;
    const variance = data?.variance ?? 0;
    const isTiedOut = Math.abs(variance) < 0.01;

    const bucketPct = (key: BucketKey) =>
        totalAging > 0 ? ((buckets[key]?.total ?? 0) / totalAging) * 100 : 0;

    const expandedItems: any[] = expanded ? (buckets[expanded]?.items ?? []) : [];

    return (
        <div className="space-y-4">

            {/* ── CONTROLS ── */}
            <div className="bg-white rounded-[8px] p-4 flex flex-wrap items-end gap-4" style={CARD_STYLE}>
                {/* AR / AP toggle */}
                <div>
                    <p className="text-[11px] font-[500] uppercase tracking-[0.07em] text-gray-400 mb-1.5">
                        Report Type
                    </p>
                    <div className="flex rounded-[6px] overflow-hidden" style={{ border: '1px solid rgba(0,0,0,0.09)' }}>
                        {(['AR', 'AP'] as const).map(t => (
                            <button key={t} onClick={() => setType(t)}
                                className={cn(
                                    'px-5 py-2 text-[12.5px] font-[500] transition-colors',
                                    type === t ? 'bg-[#6366F1] text-white' : 'bg-white text-gray-500 hover:bg-gray-50'
                                )}
                                style={t === 'AP' ? { borderLeft: '1px solid rgba(0,0,0,0.09)' } : {}}>
                                {t === 'AR' ? 'Receivables (AR)' : 'Payables (AP)'}
                            </button>
                        ))}
                    </div>
                </div>

                {/* As-of date */}
                <div>
                    <p className="text-[11px] font-[500] uppercase tracking-[0.07em] text-gray-400 mb-1.5">
                        As of Date
                    </p>
                    <input type="date" value={asOf}
                        onChange={e => setAsOf(e.target.value)}
                        className="rounded-[6px] px-3 py-[9px] text-[12.5px] text-gray-900 outline-none focus:ring-1 focus:ring-[#6366F1] bg-white"
                        style={{ border: '1px solid rgba(0,0,0,0.09)' }} />
                </div>

                {/* Refresh */}
                <button onClick={load} disabled={loading}
                    className="flex items-center gap-1.5 px-4 py-[9px] text-[12px] font-[500] text-gray-600 rounded-[6px] hover:bg-gray-50 transition-colors disabled:opacity-40"
                    style={{ border: '1px solid rgba(0,0,0,0.09)' }}>
                    <PiArrowCounterClockwise className={cn('text-[14px]', loading && 'animate-spin')} />
                    Refresh
                </button>
            </div>

            {/* ── BUCKET CARDS + DISTRIBUTION BAR ── */}
            {data && (
                <div className="space-y-3">
                    {/* Stacked distribution bar */}
                    {totalAging > 0 && (
                        <div className="bg-white rounded-[8px] px-5 py-3.5" style={CARD_STYLE}>
                            <div className="flex items-center justify-between mb-2">
                                <p className="text-[10.5px] font-[500] uppercase tracking-[0.08em] text-gray-400">
                                    Aging Distribution — {fmt(totalAging)} total
                                </p>
                                <p className="text-[10.5px] text-gray-400">
                                    {type === 'AR' ? 'Accounts Receivable' : 'Accounts Payable'}
                                </p>
                            </div>
                            <div className="flex h-[6px] rounded-full overflow-hidden gap-px">
                                {(Object.keys(BUCKETS) as BucketKey[]).map(key => {
                                    const pct = bucketPct(key);
                                    if (pct === 0) return null;
                                    return (
                                        <div key={key} className={cn('h-full transition-all', BUCKETS[key].barColor)}
                                            style={{ width: `${pct}%` }}
                                            title={`${BUCKETS[key].label}: ${pct.toFixed(1)}%`} />
                                    );
                                })}
                            </div>
                            {/* Legend */}
                            <div className="flex items-center gap-4 mt-2.5 flex-wrap">
                                {(Object.entries(BUCKETS) as [BucketKey, BucketMeta][]).map(([key, meta]) => {
                                    const pct = bucketPct(key);
                                    if (pct === 0) return null;
                                    return (
                                        <div key={key} className="flex items-center gap-1.5">
                                            <div className={cn('w-2 h-2 rounded-full shrink-0', meta.barColor)} />
                                            <span className="text-[10.5px] text-gray-500">
                                                {meta.label} <span className="text-gray-400">{pct.toFixed(1)}%</span>
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* 5 bucket cards */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                        {(Object.entries(BUCKETS) as [BucketKey, BucketMeta][]).map(([key, meta]) => {
                            const b = buckets[key] ?? { total: 0, count: 0 };
                            const pct = bucketPct(key);
                            const isActive = expanded === key;
                            const hasItems = (b.items?.length ?? 0) > 0;

                            return (
                                <button key={key}
                                    onClick={() => setExpanded(isActive ? null : key)}
                                    disabled={!hasItems}
                                    className={cn(
                                        'bg-white rounded-[8px] p-4 text-left transition-all flex flex-col gap-2',
                                        hasItems ? 'cursor-pointer hover:shadow-sm' : 'cursor-default opacity-60',
                                        isActive && 'ring-1 ring-[#6366F1] ring-offset-0'
                                    )}
                                    style={CARD_STYLE}>

                                    {/* Bucket label + status chip */}
                                    <div className="flex items-center justify-between gap-1">
                                        <p className="text-[10.5px] font-[600] uppercase tracking-[0.07em] text-gray-400">
                                            {meta.label}
                                        </p>
                                        {isActive
                                            ? <PiCaretUp className="text-[#6366F1] text-[11px] shrink-0" />
                                            : hasItems
                                            ? <PiCaretDown className="text-gray-300 text-[11px] shrink-0" />
                                            : null
                                        }
                                    </div>

                                    {/* Amount */}
                                    <div>
                                        <p className={cn('text-[16px] font-[700] tabular-nums leading-tight', meta.amtColor)}>
                                            {fmt(b.total)}
                                        </p>
                                        <p className="text-[11px] text-gray-400 mt-0.5">
                                            {b.count} invoice{b.count !== 1 ? 's' : ''}
                                        </p>
                                    </div>

                                    {/* Mini weight bar */}
                                    <div className="h-[3px] rounded-full bg-gray-100 overflow-hidden mt-auto">
                                        <div className={cn('h-full rounded-full transition-all duration-500', meta.barColor)}
                                            style={{ width: `${Math.min(pct, 100)}%` }} />
                                    </div>

                                    {/* Sublabel */}
                                    <p className="text-[10px] text-gray-400 leading-none">{meta.sublabel}</p>
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Loading skeleton */}
            {loading && !data && (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                    {Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className="bg-white rounded-[8px] p-4 h-[116px] animate-pulse" style={CARD_STYLE}>
                            <div className="h-2 bg-gray-100 rounded w-2/3 mb-3" />
                            <div className="h-4 bg-gray-100 rounded w-full mb-1" />
                            <div className="h-2 bg-gray-100 rounded w-1/3" />
                        </div>
                    ))}
                </div>
            )}

            {/* ── GL TIE-OUT ── */}
            {data && (
                <div className="bg-white rounded-[8px] px-5 py-4 flex flex-wrap items-center gap-x-8 gap-y-3" style={CARD_STYLE}>
                    <div>
                        <p className="text-[10.5px] font-[500] uppercase tracking-[0.08em] text-gray-400 mb-0.5">Aging Total</p>
                        <p className="text-[14px] font-[600] text-gray-900 tabular-nums font-mono">{fmt(totalAging)}</p>
                    </div>
                    <div className="h-8 w-px bg-gray-100" />
                    <div>
                        <p className="text-[10.5px] font-[500] uppercase tracking-[0.08em] text-gray-400 mb-0.5">GL Control Balance</p>
                        <p className="text-[14px] font-[600] text-gray-900 tabular-nums font-mono">{fmt(glBalance)}</p>
                    </div>
                    <div className="h-8 w-px bg-gray-100" />
                    <div className="flex items-center gap-2">
                        <div className={cn(
                            'w-7 h-7 rounded-[6px] flex items-center justify-center',
                            isTiedOut ? 'bg-emerald-50' : 'bg-rose-50'
                        )}>
                            {isTiedOut
                                ? <PiCheckCircle className="text-emerald-500 text-[15px]" />
                                : <PiWarning className="text-rose-500 text-[15px]" />
                            }
                        </div>
                        <div>
                            <p className="text-[10.5px] font-[500] uppercase tracking-[0.08em] text-gray-400 mb-0.5">Variance</p>
                            <p className={cn('text-[14px] font-[600] tabular-nums font-mono',
                                isTiedOut ? 'text-emerald-600' : 'text-rose-600')}>
                                {fmt(Math.abs(variance))}
                                <span className="ml-1.5 text-[11px] font-[400]">
                                    {isTiedOut ? '— tied out ✓' : '— out of balance'}
                                </span>
                            </p>
                        </div>
                    </div>
                    {!isTiedOut && (
                        <p className="text-[11.5px] text-rose-500 ml-auto">
                            Review posted transactions — the aging and GL are not reconciled.
                        </p>
                    )}
                </div>
            )}

            {/* ── EXPANDED DETAIL TABLE ── */}
            {expanded && expandedItems.length > 0 && (
                <div className="bg-white rounded-[8px] overflow-hidden" style={CARD_STYLE}>
                    {/* Detail header */}
                    <div className="flex items-center justify-between px-5 py-3.5"
                        style={{ borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
                        <div className="flex items-center gap-2.5">
                            <span className={cn(
                                'text-[10.5px] font-[600] px-2.5 py-1 rounded-[4px]',
                                BUCKETS[expanded].badgeText, BUCKETS[expanded].badgeBg
                            )} style={{ border: `1px solid ${BUCKETS[expanded].badgeBorder}` }}>
                                {BUCKETS[expanded].label}
                            </span>
                            <p className="text-[13px] font-[600] text-gray-900">
                                {expandedItems.length} invoice{expandedItems.length !== 1 ? 's' : ''}
                            </p>
                            <p className="text-[12.5px] text-gray-400">
                                · {fmt(buckets[expanded]?.total ?? 0)}
                            </p>
                        </div>
                        <button onClick={() => setExpanded(null)}
                            className="text-[12px] text-gray-400 hover:text-gray-600 transition-colors">
                            Close ↑
                        </button>
                    </div>

                    {/* Table */}
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[500px]">
                            <thead>
                                <tr className="bg-gray-50/60" style={{ borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
                                    {['Invoice #', type === 'AR' ? 'Customer' : 'Vendor', 'Due Date', 'Days Overdue', 'Amount'].map((h, i) => (
                                        <th key={i} className={cn(
                                            'px-5 py-2.5 text-[10.5px] font-[500] uppercase tracking-[0.08em] text-gray-400',
                                            i === 4 ? 'text-right' : 'text-left'
                                        )}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {expandedItems.map((item: any, i: number) => {
                                    const daysOverdue = item.dueDate
                                        ? Math.max(0, Math.floor((Date.now() - new Date(item.dueDate).getTime()) / 86400000))
                                        : 0;
                                    return (
                                        <tr key={item.id} className="hover:bg-gray-50/60 transition-colors"
                                            style={i < expandedItems.length - 1 ? ROW_BORDER : {}}>
                                            <td className="px-5 py-3 text-[12px] font-mono text-gray-500">
                                                {item.invoiceNumber}
                                            </td>
                                            <td className="px-5 py-3 text-[12.5px] font-[500] text-gray-900">
                                                {item.party}
                                            </td>
                                            <td className="px-5 py-3 text-[12px] text-gray-400">
                                                {item.dueDate ? fmtDate(item.dueDate) : '—'}
                                            </td>
                                            <td className="px-5 py-3">
                                                {daysOverdue > 0 ? (
                                                    <span className={cn(
                                                        'text-[11px] font-[500] px-2 py-0.5 rounded-[4px]',
                                                        BUCKETS[expanded].badgeText, BUCKETS[expanded].badgeBg
                                                    )} style={{ border: `1px solid ${BUCKETS[expanded].badgeBorder}` }}>
                                                        {daysOverdue}d
                                                    </span>
                                                ) : (
                                                    <span className="text-[11px] text-gray-300">Current</span>
                                                )}
                                            </td>
                                            <td className="px-5 py-3 text-right">
                                                <span className="text-[13px] font-[600] text-gray-900 tabular-nums font-mono">
                                                    {fmt(item.amount)}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                            {/* Total row */}
                            <tfoot>
                                <tr style={{ borderTop: '1px solid rgba(0,0,0,0.08)' }}>
                                    <td colSpan={4} className="px-5 py-3 text-[11px] font-[600] uppercase tracking-[0.07em] text-gray-400">
                                        Total
                                    </td>
                                    <td className="px-5 py-3 text-right text-[13px] font-[700] text-gray-900 tabular-nums font-mono">
                                        {fmt(buckets[expanded]?.total ?? 0)}
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>
            )}

            {/* Empty bucket detail */}
            {expanded && expandedItems.length === 0 && (
                <div className="bg-white rounded-[8px] py-12 flex flex-col items-center" style={CARD_STYLE}>
                    <div className="w-10 h-10 rounded-[8px] bg-gray-50 flex items-center justify-center mb-3"
                        style={{ border: '1px solid rgba(0,0,0,0.07)' }}>
                        <PiReceiptX className="text-gray-300 text-xl" />
                    </div>
                    <p className="text-[13px] font-[500] text-gray-700">No invoices in this bucket</p>
                    <p className="text-[12px] text-gray-400 mt-0.5">All {BUCKETS[expanded].label.toLowerCase()} invoices are cleared.</p>
                </div>
            )}
        </div>
    );
}
