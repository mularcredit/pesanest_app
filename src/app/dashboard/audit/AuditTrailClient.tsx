'use client';

import { Fragment, useState } from 'react';
import { Select } from '@/components/ui/Select';
import { useToast } from '@/components/ui/ToastProvider';
import { cn } from '@/lib/utils';
import {
    PiArrowsCounterClockwise, PiCaretLeft, PiCaretRight,
    PiShieldCheck, PiWarning, PiMagnifyingGlass, PiX,
    PiCaretDown, PiCaretUp, PiClock,
} from 'react-icons/pi';

// ── Badge color map ──────────────────────────────────────────────────────────
type BadgeStyle = { text: string; bg: string; border: string };

const ACTION_STYLE: Record<string, BadgeStyle> = {
    JOURNAL_POST:     { text: 'text-[#6366F1]',  bg: 'bg-indigo-50',  border: 'rgba(99,102,241,0.25)' },
    JOURNAL_REVERSE:  { text: 'text-amber-600',   bg: 'bg-amber-50',   border: 'rgba(245,158,11,0.2)' },
    PAYMENT_REVERSED: { text: 'text-rose-600',    bg: 'bg-rose-50',    border: 'rgba(239,68,68,0.2)' },
    ACCOUNT_ARCHIVE:  { text: 'text-gray-500',    bg: 'bg-gray-100',   border: 'rgba(0,0,0,0.09)' },
    ACCOUNT_EDIT:     { text: 'text-violet-600',  bg: 'bg-violet-50',  border: 'rgba(124,58,237,0.2)' },
    '2FA_ENABLED':    { text: 'text-emerald-600', bg: 'bg-emerald-50', border: 'rgba(16,185,129,0.2)' },
    '2FA_DISABLED':   { text: 'text-amber-600',   bg: 'bg-amber-50',   border: 'rgba(245,158,11,0.2)' },
    YEAR_END_CLOSE:   { text: 'text-[#6366F1]',   bg: 'bg-indigo-50',  border: 'rgba(99,102,241,0.25)' },
    PERIOD_CLOSE:     { text: 'text-slate-600',   bg: 'bg-slate-100',  border: 'rgba(100,116,139,0.2)' },
    LOGIN:            { text: 'text-emerald-600', bg: 'bg-emerald-50', border: 'rgba(16,185,129,0.2)' },
    LOGOUT:           { text: 'text-gray-500',    bg: 'bg-gray-100',   border: 'rgba(0,0,0,0.09)' },
    CREATE:           { text: 'text-[#6366F1]',   bg: 'bg-indigo-50',  border: 'rgba(99,102,241,0.25)' },
    UPDATE:           { text: 'text-amber-600',   bg: 'bg-amber-50',   border: 'rgba(245,158,11,0.2)' },
    DELETE:           { text: 'text-rose-600',    bg: 'bg-rose-50',    border: 'rgba(239,68,68,0.2)' },
    APPROVE:          { text: 'text-emerald-600', bg: 'bg-emerald-50', border: 'rgba(16,185,129,0.2)' },
    REJECT:           { text: 'text-rose-600',    bg: 'bg-rose-50',    border: 'rgba(239,68,68,0.2)' },
    EXPORT:           { text: 'text-slate-600',   bg: 'bg-slate-100',  border: 'rgba(100,116,139,0.2)' },
};

const DEFAULT_STYLE: BadgeStyle = { text: 'text-gray-500', bg: 'bg-gray-100', border: 'rgba(0,0,0,0.09)' };

function getStyle(action: string): BadgeStyle {
    if (ACTION_STYLE[action]) return ACTION_STYLE[action];
    // fuzzy match
    const upper = action.toUpperCase();
    for (const [key, val] of Object.entries(ACTION_STYLE)) {
        if (upper.includes(key) || key.includes(upper)) return val;
    }
    return DEFAULT_STYLE;
}

function fmtDate(d: string | Date) {
    return new Date(d).toLocaleString('en-KE', { dateStyle: 'medium', timeStyle: 'short' });
}

function ActorCell({ email }: { email?: string | null }) {
    const label = email || 'System';
    const initials = label === 'System' ? 'SY' :
        label.split('@')[0].split(/[._-]/).map((w: string) => w[0]?.toUpperCase()).slice(0, 2).join('');
    return (
        <div className="flex items-center gap-2">
            <div className="w-[26px] h-[26px] rounded-full bg-indigo-50 flex items-center justify-center text-[9px] font-[600] text-[#6366F1] shrink-0">
                {initials}
            </div>
            <span className="text-[12px] font-[500] text-gray-700 truncate max-w-[150px]">{label}</span>
        </div>
    );
}

function ActionBadge({ action }: { action: string }) {
    const s = getStyle(action);
    return (
        <span className={cn('text-[10px] font-[600] px-2 py-0.5 rounded-[4px] whitespace-nowrap', s.text, s.bg)}
            style={{ border: `1px solid ${s.border}` }}>
            {action.replace(/_/g, ' ')}
        </span>
    );
}

function JsonBlock({ label, data, accent }: { label: string; data: any; accent: 'amber' | 'indigo' }) {
    const colors = accent === 'amber'
        ? { icon: 'text-amber-400', bg: 'bg-amber-50/50', border: 'rgba(245,158,11,0.15)', label: 'text-amber-700' }
        : { icon: 'text-[#6366F1]', bg: 'bg-indigo-50/50', border: 'rgba(99,102,241,0.15)', label: 'text-[#6366F1]' };
    const Icon = accent === 'amber' ? PiWarning : PiShieldCheck;
    return (
        <div>
            <div className={cn('flex items-center gap-1.5 mb-2 text-[11px] font-[600] uppercase tracking-[0.07em]', colors.label)}>
                <Icon className={cn('text-[13px]', colors.icon)} />
                {label}
            </div>
            <div className="rounded-[7px] overflow-hidden" style={{ border: `1px solid ${colors.border}` }}>
                <pre className={cn('p-3 text-[11px] text-gray-700 overflow-x-auto leading-relaxed', colors.bg)}>
                    {JSON.stringify(data, null, 2)}
                </pre>
            </div>
        </div>
    );
}

// ── Main component ────────────────────────────────────────────────────────────

export function AuditTrailClient({
    initialLogs, initialTotal, entities, actions,
}: {
    initialLogs: any[];
    initialTotal: number;
    entities: string[];
    actions: string[];
}) {
    const { showToast } = useToast();
    const [logs, setLogs] = useState(initialLogs);
    const [total, setTotal] = useState(initialTotal);
    const [page, setPage] = useState(1);
    const [pages, setPages] = useState(Math.ceil(initialTotal / 50));
    const [loading, setLoading] = useState(false);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [filters, setFilters] = useState({ entity: '', action: '', from: '', to: '' });

    const entityOptions = [{ value: '', label: 'All entities' }, ...entities.map(e => ({ value: e, label: e }))];
    const actionOptions = [{ value: '', label: 'All actions' }, ...actions.map(a => ({ value: a, label: a }))];

    const fetchPage = async (p: number, overrideFilters?: typeof filters) => {
        setLoading(true);
        try {
            const f = overrideFilters ?? filters;
            const params = new URLSearchParams({ page: String(p), limit: '50' });
            if (f.entity) params.set('entity', f.entity);
            if (f.action) params.set('action', f.action);
            if (f.from)   params.set('from', f.from);
            if (f.to)     params.set('to', f.to);
            const res = await fetch(`/api/audit?${params}`);
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            setLogs(data.logs);
            setTotal(data.total);
            setPages(data.pages);
            setPage(p);
        } catch (err: any) {
            showToast(err.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    const clearFilters = () => {
        const empty = { entity: '', action: '', from: '', to: '' };
        setFilters(empty);
        fetchPage(1, empty);
    };

    const hasFilters = filters.entity || filters.action || filters.from || filters.to;

    const CARD_STYLE: React.CSSProperties = { border: '1px solid rgba(0,0,0,0.09)' };
    const INPUT_CLASS = "w-full rounded-[6px] px-3 py-[9px] text-[12.5px] text-gray-900 placeholder:text-gray-300 outline-none focus:ring-1 focus:ring-[#6366F1] bg-white";
    const INPUT_STYLE: React.CSSProperties = { border: '1px solid rgba(0,0,0,0.09)' };
    const LABEL = "block text-[11px] font-[500] uppercase tracking-[0.07em] text-gray-400 mb-1.5";

    return (
        <div className="space-y-4">

            {/* ── FILTER BAR ── */}
            <div className="bg-white rounded-[8px] p-4" style={CARD_STYLE}>
                <div className="flex flex-wrap items-end gap-3">
                    <div className="flex-1 min-w-[160px]">
                        <label className={LABEL}>Entity</label>
                        <Select
                            value={filters.entity}
                            onChange={v => setFilters(f => ({ ...f, entity: v }))}
                            options={entityOptions}
                        />
                    </div>
                    <div className="flex-1 min-w-[180px]">
                        <label className={LABEL}>Action</label>
                        <Select
                            value={filters.action}
                            onChange={v => setFilters(f => ({ ...f, action: v }))}
                            options={actionOptions}
                        />
                    </div>
                    <div className="min-w-[140px]">
                        <label className={LABEL}>From</label>
                        <input type="date" value={filters.from}
                            onChange={e => setFilters(f => ({ ...f, from: e.target.value }))}
                            className={INPUT_CLASS} style={INPUT_STYLE} />
                    </div>
                    <div className="min-w-[140px]">
                        <label className={LABEL}>To</label>
                        <input type="date" value={filters.to}
                            onChange={e => setFilters(f => ({ ...f, to: e.target.value }))}
                            className={INPUT_CLASS} style={INPUT_STYLE} />
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        {hasFilters && (
                            <button onClick={clearFilters}
                                className="flex items-center gap-1.5 px-3 py-[9px] text-[12px] font-[500] text-gray-500 rounded-[6px] hover:bg-gray-50 transition-colors"
                                style={{ border: '1px solid rgba(0,0,0,0.09)' }}>
                                <PiX className="text-[13px]" /> Clear
                            </button>
                        )}
                        <button onClick={() => fetchPage(1)} disabled={loading}
                            className="flex items-center gap-1.5 px-4 py-[9px] text-[12px] font-[600] text-white bg-[#6366F1] rounded-[6px] hover:bg-indigo-600 transition-colors disabled:opacity-40">
                            <PiArrowsCounterClockwise className={cn('text-[13px]', loading && 'animate-spin')} />
                            Apply
                        </button>
                    </div>
                </div>
            </div>

            {/* ── TABLE ── */}
            <div className="bg-white rounded-[8px] overflow-hidden" style={CARD_STYLE}>

                {/* Table toolbar */}
                <div className="flex items-center justify-between px-5 py-3.5"
                    style={{ borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
                    <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-[6px] bg-indigo-50 flex items-center justify-center">
                            <PiShieldCheck className="text-[#6366F1] text-[13px]" />
                        </div>
                        <div>
                            <span className="text-[13px] font-[600] text-gray-900">
                                {total.toLocaleString()} event{total !== 1 ? 's' : ''}
                            </span>
                            {hasFilters && (
                                <span className="ml-2 text-[10.5px] font-[500] text-[#6366F1] bg-indigo-50 px-2 py-0.5 rounded-[4px]"
                                    style={{ border: '1px solid rgba(99,102,241,0.2)' }}>
                                    filtered
                                </span>
                            )}
                        </div>
                    </div>
                    {/* Pagination controls */}
                    <div className="flex items-center gap-2">
                        <span className="text-[12px] text-gray-400">
                            Page {page} of {pages || 1}
                        </span>
                        <div className="flex items-center rounded-[6px] overflow-hidden"
                            style={{ border: '1px solid rgba(0,0,0,0.09)' }}>
                            <button onClick={() => fetchPage(page - 1)} disabled={page <= 1 || loading}
                                className="px-2.5 py-1.5 bg-white text-gray-500 hover:bg-gray-50 disabled:opacity-30 transition-colors">
                                <PiCaretLeft className="text-[13px]" />
                            </button>
                            <button onClick={() => fetchPage(page + 1)} disabled={page >= pages || loading}
                                className="px-2.5 py-1.5 bg-white text-gray-500 hover:bg-gray-50 disabled:opacity-30 transition-colors"
                                style={{ borderLeft: '1px solid rgba(0,0,0,0.09)' }}>
                                <PiCaretRight className="text-[13px]" />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[720px]">
                        <thead>
                            <tr className="bg-gray-50/60" style={{ borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
                                {['Timestamp', 'Actor', 'Action', 'Entity', 'Preview', ''].map((h, i) => (
                                    <th key={i} className="px-5 py-2.5 text-left text-[10.5px] font-[500] uppercase tracking-[0.08em] text-gray-400 whitespace-nowrap">
                                        {h}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {logs.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="px-5 py-20 text-center">
                                        <div className="flex flex-col items-center">
                                            <div className="w-10 h-10 rounded-[8px] bg-gray-50 flex items-center justify-center mb-3"
                                                style={{ border: '1px solid rgba(0,0,0,0.07)' }}>
                                                <PiMagnifyingGlass className="text-gray-300 text-xl" />
                                            </div>
                                            <p className="text-[13px] font-[500] text-gray-700">No events found</p>
                                            <p className="text-[12px] text-gray-400 mt-0.5">Try adjusting your filters.</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                            {logs.map((log: any, i: number) => {
                                const isExpanded = expandedId === log.id;
                                const hasDetail = log.before || log.after;
                                const preview = log.after
                                    ? JSON.stringify(log.after).slice(0, 55)
                                    : log.before
                                    ? JSON.stringify(log.before).slice(0, 55)
                                    : null;
                                const ROW_BORDER: React.CSSProperties = { borderBottom: '1px solid rgba(0,0,0,0.06)' };

                                return (
                                    <Fragment key={log.id}>
                                        <tr
                                            onClick={() => hasDetail && setExpandedId(isExpanded ? null : log.id)}
                                            className={cn(
                                                'transition-colors',
                                                hasDetail ? 'cursor-pointer hover:bg-gray-50/60' : '',
                                                isExpanded ? 'bg-gray-50/40' : ''
                                            )}
                                            style={!isExpanded ? ROW_BORDER : {}}>
                                            {/* Timestamp */}
                                            <td className="px-5 py-3.5 whitespace-nowrap">
                                                <div className="flex items-center gap-1.5">
                                                    <PiClock className="text-gray-300 text-[12px] shrink-0" />
                                                    <span className="text-[12px] text-gray-500 font-mono">
                                                        {fmtDate(log.createdAt)}
                                                    </span>
                                                </div>
                                            </td>
                                            {/* Actor */}
                                            <td className="px-5 py-3.5">
                                                <ActorCell email={log.actorEmail} />
                                            </td>
                                            {/* Action badge */}
                                            <td className="px-5 py-3.5">
                                                <ActionBadge action={log.action} />
                                            </td>
                                            {/* Entity */}
                                            <td className="px-5 py-3.5">
                                                <p className="text-[12.5px] font-[500] text-gray-900">{log.entity}</p>
                                                {log.entityId && (
                                                    <p className="text-[10.5px] text-gray-400 font-mono mt-0.5">
                                                        {log.entityId.slice(0, 12)}…
                                                    </p>
                                                )}
                                            </td>
                                            {/* Preview */}
                                            <td className="px-5 py-3.5 max-w-[220px]">
                                                {preview && (
                                                    <p className="text-[11.5px] text-gray-400 font-mono truncate">
                                                        {preview}{preview.length >= 55 ? '…' : ''}
                                                    </p>
                                                )}
                                            </td>
                                            {/* Expand toggle */}
                                            <td className="px-5 py-3.5">
                                                {hasDetail && (
                                                    <button className="p-1 rounded-[4px] text-gray-300 hover:text-[#6366F1] hover:bg-indigo-50 transition-colors">
                                                        {isExpanded
                                                            ? <PiCaretUp className="text-[13px]" />
                                                            : <PiCaretDown className="text-[13px]" />
                                                        }
                                                    </button>
                                                )}
                                            </td>
                                        </tr>

                                        {/* Expanded detail row */}
                                        {isExpanded && (
                                            <tr style={ROW_BORDER}>
                                                <td colSpan={6} className="px-5 py-4 bg-gray-50/40">
                                                    <div className={cn(
                                                        'grid gap-4',
                                                        log.before && log.after ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1 max-w-xl'
                                                    )}>
                                                        {log.before && (
                                                            <JsonBlock label="Before" data={log.before} accent="amber" />
                                                        )}
                                                        {log.after && (
                                                            <JsonBlock label="After" data={log.after} accent="indigo" />
                                                        )}
                                                    </div>
                                                    {/* Extra meta */}
                                                    <div className="flex items-center gap-4 mt-3 pt-3"
                                                        style={{ borderTop: '1px solid rgba(0,0,0,0.06)' }}>
                                                        {log.ipAddress && (
                                                            <p className="text-[11px] text-gray-400 font-mono">
                                                                IP: {log.ipAddress}
                                                            </p>
                                                        )}
                                                        {log.userAgent && (
                                                            <p className="text-[11px] text-gray-400 truncate max-w-[300px]">
                                                                {log.userAgent}
                                                            </p>
                                                        )}
                                                        <p className="text-[11px] text-gray-400 font-mono ml-auto">
                                                            ID: {log.id}
                                                        </p>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </Fragment>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {/* Table footer pagination */}
                {pages > 1 && (
                    <div className="flex items-center justify-between px-5 py-3.5"
                        style={{ borderTop: '1px solid rgba(0,0,0,0.07)' }}>
                        <p className="text-[12px] text-gray-400">
                            Showing {((page - 1) * 50) + 1}–{Math.min(page * 50, total)} of {total.toLocaleString()}
                        </p>
                        <div className="flex items-center gap-2">
                            <button onClick={() => fetchPage(page - 1)} disabled={page <= 1 || loading}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-[500] text-gray-600 rounded-[6px] hover:bg-gray-50 disabled:opacity-30 transition-colors"
                                style={{ border: '1px solid rgba(0,0,0,0.09)' }}>
                                <PiCaretLeft className="text-[12px]" /> Previous
                            </button>
                            <button onClick={() => fetchPage(page + 1)} disabled={page >= pages || loading}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-[500] text-gray-600 rounded-[6px] hover:bg-gray-50 disabled:opacity-30 transition-colors"
                                style={{ border: '1px solid rgba(0,0,0,0.09)' }}>
                                Next <PiCaretRight className="text-[12px]" />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
