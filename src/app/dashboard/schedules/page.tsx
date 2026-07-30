'use client';

import { useState, useEffect } from 'react';
import {
    PiCalendarBlank, PiPlus, PiCheckCircle, PiXCircle,
    PiArrowClockwise, PiTrash, PiToggleLeft, PiToggleRight,
    PiPlayCircle, PiClock, PiWarningCircle, PiX,
    PiCaretRight, PiFileText, PiCheck,
} from 'react-icons/pi';
import { useToast } from '@/components/ui/ToastProvider';

const HAIRLINE = '1px solid rgba(0,0,0,0.07)';

const FREQ_META: Record<string, { label: string; color: string; bg: string }> = {
    DAILY:     { label: 'Daily',     color: '#0284c7', bg: 'rgba(2,132,199,0.08)'  },
    WEEKLY:    { label: 'Weekly',    color: '#7c3aed', bg: 'rgba(124,58,237,0.08)' },
    MONTHLY:   { label: 'Monthly',   color: '#059669', bg: 'rgba(5,150,105,0.08)'  },
    QUARTERLY: { label: 'Quarterly', color: '#d97706', bg: 'rgba(217,119,6,0.08)'  },
    YEARLY:    { label: 'Yearly',    color: '#dc2626', bg: 'rgba(220,38,38,0.08)'  },
};

interface RequisitionItem {
    id: string;
    title: string;
    totalPrice: number;
    category: string;
    quantity: number;
    requisition: { id: string; currency: string; type: string };
}

interface Schedule {
    id: string;
    name: string;
    frequency: string;
    startDate: string;
    endDate?: string;
    nextRun: string;
    isActive: boolean;
    createdBy: { id: string; name: string; email: string };
    requisitionItem: RequisitionItem;
    executions: Array<{
        id: string;
        scheduledFor: string;
        executedAt?: string;
        status: string;
        entityId?: string;
    }>;
}

function fmt(n: number) {
    return new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);
}

function nextRunLabel(dateString: string): { label: string; color: string } {
    const date = new Date(dateString);
    const diffDays = Math.ceil((date.getTime() - Date.now()) / 86400000);
    if (diffDays < 0)  return { label: `${Math.abs(diffDays)}d overdue`,  color: '#e11d48' };
    if (diffDays === 0) return { label: 'Today',                            color: '#d97706' };
    if (diffDays === 1) return { label: 'Tomorrow',                         color: '#0284c7' };
    if (diffDays < 7)   return { label: `In ${diffDays}d`,                  color: '#6366F1' };
    return { label: date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }), color: '#6b7280' };
}

/* ── Create Schedule Modal ─────────────────────────────────────────────── */
function CreateModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
    const { showToast } = useToast();
    const [step, setStep] = useState<'item' | 'details'>('item');
    const [items, setItems] = useState<RequisitionItem[]>([]);
    const [loadingItems, setLoadingItems] = useState(true);
    const [search, setSearch] = useState('');
    const [selected, setSelected] = useState<RequisitionItem | null>(null);
    const [name, setName] = useState('');
    const [frequency, setFrequency] = useState('MONTHLY');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetch('/api/schedules/items')
            .then(r => r.json())
            .then(d => setItems(d.items || []))
            .catch(() => {})
            .finally(() => setLoadingItems(false));
    }, []);

    const visible = items.filter(it =>
        it.title.toLowerCase().includes(search.toLowerCase()) ||
        (it.category || '').toLowerCase().includes(search.toLowerCase())
    );

    const pickItem = (item: RequisitionItem) => {
        setSelected(item);
        setName(`Recurring ${item.title}`);
        setStep('details');
    };

    const submit = async () => {
        if (!selected || !name.trim() || !startDate) return;
        setSaving(true);
        try {
            const res = await fetch('/api/schedules', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    requisitionItemId: selected.id,
                    name: name.trim(),
                    frequency,
                    startDate,
                    endDate: endDate || undefined,
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            showToast('Schedule created', 'success');
            onCreated();
            onClose();
        } catch (err: any) {
            showToast(err.message || 'Failed to create schedule', 'error');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" onClick={onClose} />
            <div className="relative bg-white rounded-[10px] shadow-xl w-full max-w-[500px] overflow-hidden" style={{ border: HAIRLINE }}>

                {/* Modal header */}
                <div className="flex items-center gap-3 px-5 py-4" style={{ borderBottom: HAIRLINE }}>
                    <div className="w-[28px] h-[28px] rounded-[6px] bg-[#6366F1] flex items-center justify-center shrink-0">
                        <PiCalendarBlank className="text-white text-[13px]" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-[600] text-gray-900">New Recurring Schedule</p>
                        <p className="text-[10.5px] text-gray-400">
                            {step === 'item' ? 'Step 1 — Pick an expense item to repeat' : 'Step 2 — Configure the schedule'}
                        </p>
                    </div>
                    <button onClick={onClose}
                        className="w-[26px] h-[26px] flex items-center justify-center rounded-[5px] text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                        style={{ border: HAIRLINE }}>
                        <PiX className="text-[12px]" />
                    </button>
                </div>

                {step === 'item' ? (
                    <div>
                        <div className="px-5 pt-4 pb-2">
                            <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-[7px]" style={{ border: HAIRLINE }}>
                                <input
                                    className="flex-1 bg-transparent text-[12.5px] text-gray-900 placeholder:text-gray-400 outline-none"
                                    placeholder="Search items by name or category..."
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                    autoFocus
                                />
                            </div>
                        </div>
                        <div className="overflow-y-auto max-h-[340px] px-5 pb-5">
                            {loadingItems ? (
                                <div className="flex items-center justify-center py-12">
                                    <PiArrowClockwise className="animate-spin text-gray-300 text-[22px]" />
                                </div>
                            ) : visible.length === 0 ? (
                                <div className="py-12 text-center">
                                    <p className="text-[12px] text-gray-400">
                                        {items.length === 0
                                            ? 'No schedulable items found. All items already have schedules, or no expenses exist.'
                                            : 'No items match your search.'}
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-1.5 mt-1">
                                    {visible.map(item => (
                                        <button key={item.id} onClick={() => pickItem(item)}
                                            className="w-full text-left flex items-center gap-3 px-3.5 py-3 rounded-[7px] hover:bg-indigo-50 transition-colors group"
                                            style={{ border: HAIRLINE }}>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-[12.5px] font-[500] text-gray-900 truncate group-hover:text-[#6366F1] transition-colors">
                                                    {item.title}
                                                </p>
                                                <p className="text-[10.5px] text-gray-400 mt-0.5">
                                                    {item.category?.replace(/_/g, ' ')} · {item.requisition.currency} {fmt(item.totalPrice)} · qty {item.quantity}
                                                </p>
                                            </div>
                                            <PiCaretRight className="text-gray-300 text-[13px] group-hover:text-[#6366F1] transition-colors shrink-0" />
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="px-5 py-4 space-y-4">
                        {/* Selected item pill */}
                        {selected && (
                            <div className="flex items-center gap-3 px-3.5 py-3 rounded-[7px]"
                                style={{ background: 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.15)' }}>
                                <div className="flex-1 min-w-0">
                                    <p className="text-[10px] font-[600] uppercase tracking-[0.08em] text-[#6366F1] mb-0.5">Selected Item</p>
                                    <p className="text-[12.5px] font-[500] text-gray-900 truncate">{selected.title}</p>
                                    <p className="text-[10.5px] text-gray-500 mt-0.5">
                                        {selected.requisition.currency} {fmt(selected.totalPrice)} · {selected.category?.replace(/_/g, ' ')}
                                    </p>
                                </div>
                                <button onClick={() => setStep('item')}
                                    className="text-[10.5px] font-[500] text-[#6366F1] hover:underline shrink-0">
                                    Change
                                </button>
                            </div>
                        )}

                        {/* Name */}
                        <div>
                            <label className="block text-[10.5px] font-[600] uppercase tracking-[0.08em] text-gray-400 mb-1.5">
                                Schedule Name
                            </label>
                            <input
                                className="w-full px-3 py-2.5 rounded-[7px] text-[12.5px] text-gray-900 outline-none focus:ring-2 focus:ring-[#6366F1]/20 transition-all bg-white"
                                style={{ border: HAIRLINE }}
                                value={name}
                                onChange={e => setName(e.target.value)}
                                placeholder="e.g. Monthly Rent Payment"
                                autoFocus
                            />
                        </div>

                        {/* Frequency */}
                        <div>
                            <label className="block text-[10.5px] font-[600] uppercase tracking-[0.08em] text-gray-400 mb-1.5">
                                Frequency
                            </label>
                            <div className="grid grid-cols-5 gap-1.5">
                                {Object.entries(FREQ_META).map(([k, v]) => (
                                    <button key={k} onClick={() => setFrequency(k)}
                                        className="py-2 rounded-[6px] text-[10.5px] font-[600] transition-all"
                                        style={frequency === k
                                            ? { background: v.color, color: 'white', border: `1px solid ${v.color}` }
                                            : { background: 'white', color: '#6b7280', border: HAIRLINE }}>
                                        {v.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Dates */}
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-[10.5px] font-[600] uppercase tracking-[0.08em] text-gray-400 mb-1.5">
                                    Start Date <span className="text-rose-400 normal-case font-[400]">required</span>
                                </label>
                                <input type="date"
                                    className="w-full px-3 py-2.5 rounded-[7px] text-[12.5px] text-gray-900 outline-none focus:ring-2 focus:ring-[#6366F1]/20 bg-white"
                                    style={{ border: HAIRLINE }}
                                    value={startDate}
                                    onChange={e => setStartDate(e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="block text-[10.5px] font-[600] uppercase tracking-[0.08em] text-gray-400 mb-1.5">
                                    End Date <span className="text-gray-300 normal-case font-[400]">optional</span>
                                </label>
                                <input type="date"
                                    className="w-full px-3 py-2.5 rounded-[7px] text-[12.5px] text-gray-900 outline-none focus:ring-2 focus:ring-[#6366F1]/20 bg-white"
                                    style={{ border: HAIRLINE }}
                                    value={endDate}
                                    onChange={e => setEndDate(e.target.value)}
                                />
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 pt-1">
                            <button onClick={() => setStep('item')}
                                className="flex-1 py-2.5 rounded-[7px] text-[12px] font-[500] text-gray-600 hover:bg-gray-50 transition-colors"
                                style={{ border: HAIRLINE }}>
                                Back
                            </button>
                            <button onClick={submit}
                                disabled={saving || !name.trim() || !startDate}
                                className="flex-1 py-2.5 rounded-[7px] text-[12px] font-[600] text-white transition-all disabled:opacity-40"
                                style={{ background: '#6366F1' }}>
                                {saving ? 'Creating...' : 'Create Schedule'}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

/* ── Page ──────────────────────────────────────────────────────────────── */
export default function SchedulesPage() {
    const { showToast } = useToast();
    const [schedules, setSchedules] = useState<Schedule[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'all' | 'active' | 'inactive'>('all');
    const [createOpen, setCreateOpen] = useState(false);
    const [runningId, setRunningId] = useState<string | null>(null);
    const [togglingId, setTogglingId] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    const fetchSchedules = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/schedules');
            if (res.ok) {
                const data = await res.json();
                setSchedules(data.schedules || []);
            }
        } catch {
            showToast('Failed to load schedules', 'error');
        } finally {
            setLoading(false);
        }
    };

    const processOverdue = async (silent = true) => {
        try {
            const res = await fetch('/api/schedules/process', { method: 'POST' });
            if (res.ok) {
                const data = await res.json();
                if (data.processed > 0) {
                    showToast(`${data.processed} overdue schedule(s) processed — requisitions created`, 'success');
                    fetchSchedules();
                } else if (!silent) {
                    showToast('No overdue schedules to process', 'info');
                }
            }
        } catch { /* silent */ }
    };

    useEffect(() => {
        fetchSchedules();
        processOverdue(true);
    }, []);

    const handleRunNow = async (id: string, name: string) => {
        setRunningId(id);
        try {
            const res = await fetch(`/api/schedules/${id}/execute`, { method: 'POST' });
            const data = await res.json();
            if (res.ok) {
                showToast(`"${name}" executed — requisition created`, 'success');
                fetchSchedules();
            } else {
                showToast(data.error || 'Failed to execute schedule', 'error');
            }
        } catch {
            showToast('Failed to run schedule', 'error');
        } finally {
            setRunningId(null);
        }
    };

    const handleToggle = async (id: string) => {
        setTogglingId(id);
        try {
            const res = await fetch(`/api/schedules/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'toggle' }),
            });
            if (res.ok) {
                showToast('Schedule updated', 'success');
                fetchSchedules();
            }
        } catch {
            showToast('Failed to update schedule', 'error');
        } finally {
            setTogglingId(null);
        }
    };

    const handleDelete = async (id: string, name: string) => {
        if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
        setDeletingId(id);
        try {
            const res = await fetch(`/api/schedules/${id}`, { method: 'DELETE' });
            const data = await res.json();
            if (res.ok) {
                showToast('Schedule deleted', 'success');
                fetchSchedules();
            } else {
                showToast(data.error || 'Failed to delete', 'error');
            }
        } catch {
            showToast('Failed to delete schedule', 'error');
        } finally {
            setDeletingId(null);
        }
    };

    const total    = schedules.length;
    const active   = schedules.filter(s => s.isActive).length;
    const inactive = schedules.filter(s => !s.isActive).length;
    const overdue  = schedules.filter(s => s.isActive && new Date(s.nextRun) < new Date()).length;

    const visible = schedules.filter(s =>
        filter === 'all'      ? true :
        filter === 'active'   ? s.isActive :
                                !s.isActive
    );

    return (
        <div className="pb-20 space-y-5">
            {createOpen && (
                <CreateModal onClose={() => setCreateOpen(false)} onCreated={fetchSchedules} />
            )}

            {/* ── Header ── */}
            <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <div className="w-[30px] h-[30px] rounded-[7px] bg-[#6366F1] flex items-center justify-center shrink-0">
                            <PiCalendarBlank className="text-white text-[15px]" />
                        </div>
                        <h1 className="text-[19px] font-[600] text-gray-900 tracking-tight">Recurring Schedules</h1>
                    </div>
                    <p className="text-[12px] text-gray-400 pl-[38px]">
                        {total} schedule{total !== 1 ? 's' : ''} · {active} active · auto-creates requisitions on run
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    {overdue > 0 && (
                        <button onClick={() => processOverdue(false)}
                            className="flex items-center gap-1.5 px-3.5 py-2 rounded-[6px] text-[12px] font-[500] transition-colors"
                            style={{ border: '1px solid rgba(217,119,6,0.25)', background: 'rgba(217,119,6,0.06)', color: '#b45309' }}>
                            <PiWarningCircle className="text-[13px]" />
                            Run {overdue} Overdue
                        </button>
                    )}
                    <button onClick={() => setCreateOpen(true)}
                        className="flex items-center gap-1.5 px-3.5 py-2 rounded-[6px] text-[12px] font-[600] text-white hover:opacity-90 transition-opacity"
                        style={{ background: '#6366F1' }}>
                        <PiPlus className="text-[13px]" /> New Schedule
                    </button>
                </div>
            </div>

            {/* ── KPI strip ── */}
            <div className="grid grid-cols-4 gap-3">
                {[
                    { label: 'Total',    value: total,    color: '#6366F1', icon: PiCalendarBlank },
                    { label: 'Active',   value: active,   color: '#059669', icon: PiCheckCircle   },
                    { label: 'Inactive', value: inactive, color: '#6b7280', icon: PiXCircle       },
                    { label: 'Overdue',  value: overdue,  color: overdue > 0 ? '#e11d48' : '#6b7280', icon: PiClock },
                ].map(k => {
                    const Icon = k.icon;
                    return (
                        <div key={k.label} className="bg-white rounded-[8px] px-4 py-3.5" style={{ border: HAIRLINE }}>
                            <div className="flex items-center gap-1.5 mb-2">
                                <Icon className="text-[12px] shrink-0" style={{ color: k.color }} />
                                <p className="text-[10px] font-[600] uppercase tracking-[0.09em] text-gray-400">{k.label}</p>
                            </div>
                            <p className="text-[22px] font-[700] tabular-nums leading-none" style={{ color: k.color }}>{k.value}</p>
                        </div>
                    );
                })}
            </div>

            {/* ── Filter tabs ── */}
            <div className="flex items-center gap-1.5">
                {([['all', 'All'], ['active', 'Active'], ['inactive', 'Inactive']] as const).map(([val, label]) => {
                    const isSel = filter === val;
                    const count = val === 'all' ? total : val === 'active' ? active : inactive;
                    return (
                        <button key={val} onClick={() => setFilter(val)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] text-[12px] font-[500] transition-all"
                            style={isSel
                                ? { background: '#6366F1', color: 'white', border: '1px solid #6366F1' }
                                : { background: 'white', color: '#6b7280', border: HAIRLINE }}>
                            {label}
                            <span className="text-[10px] tabular-nums" style={{ opacity: 0.6 }}>({count})</span>
                        </button>
                    );
                })}
            </div>

            {/* ── Schedule list ── */}
            {loading ? (
                <div className="bg-white rounded-[8px] flex items-center justify-center py-16" style={{ border: HAIRLINE }}>
                    <PiArrowClockwise className="animate-spin text-gray-300 text-[24px]" />
                </div>
            ) : visible.length === 0 ? (
                <div className="bg-white rounded-[8px] flex flex-col items-center justify-center py-16" style={{ border: HAIRLINE }}>
                    <PiCalendarBlank className="text-gray-200 text-[48px] mb-3" />
                    <p className="text-[13px] font-[500] text-gray-400 mb-1">No schedules found</p>
                    <p className="text-[11.5px] text-gray-300 mb-5">
                        {filter !== 'all'
                            ? `No ${filter} schedules — switch to "All" to see everything`
                            : 'Create a schedule to automate recurring expenses'}
                    </p>
                    {filter === 'all' && (
                        <button onClick={() => setCreateOpen(true)}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-[6px] text-[12px] font-[600] text-white"
                            style={{ background: '#6366F1' }}>
                            <PiPlus className="text-[13px]" /> New Schedule
                        </button>
                    )}
                </div>
            ) : (
                <div className="bg-white rounded-[8px] overflow-hidden" style={{ border: HAIRLINE }}>
                    {visible.map((schedule, i) => {
                        const item    = schedule.requisitionItem;
                        const freq    = FREQ_META[schedule.frequency] ?? { label: schedule.frequency, color: '#6b7280', bg: 'rgba(107,114,128,0.08)' };
                        const nr      = nextRunLabel(schedule.nextRun);
                        const isOdue  = schedule.isActive && new Date(schedule.nextRun) < new Date();
                        const running = runningId === schedule.id;
                        const toggling = togglingId === schedule.id;
                        const deleting = deletingId === schedule.id;

                        return (
                            <div key={schedule.id}
                                className="px-5 py-4 hover:bg-gray-50/40 transition-colors"
                                style={i > 0 ? { borderTop: HAIRLINE } : {}}>

                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1 min-w-0">
                                        {/* Name + badges */}
                                        <div className="flex items-center gap-2 flex-wrap mb-1.5">
                                            <p className="text-[13px] font-[600] text-gray-900">{schedule.name}</p>
                                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-[600]"
                                                style={{ background: freq.bg, color: freq.color }}>
                                                {freq.label}
                                            </span>
                                            {schedule.isActive ? (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-[600]"
                                                    style={{ background: 'rgba(5,150,105,0.08)', color: '#059669' }}>
                                                    <span className="w-[5px] h-[5px] rounded-full shrink-0" style={{ background: '#059669' }} />
                                                    Active
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-[600]"
                                                    style={{ background: 'rgba(107,114,128,0.08)', color: '#9ca3af' }}>
                                                    <span className="w-[5px] h-[5px] rounded-full bg-gray-300 shrink-0" />
                                                    Inactive
                                                </span>
                                            )}
                                            {isOdue && (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-[600]"
                                                    style={{ background: 'rgba(225,29,72,0.08)', color: '#e11d48' }}>
                                                    <PiWarningCircle className="text-[9px]" /> Overdue
                                                </span>
                                            )}
                                        </div>

                                        {/* Item + amount + next run */}
                                        <div className="flex items-center gap-3 flex-wrap">
                                            <span className="text-[11.5px] text-gray-500 truncate max-w-[220px]">
                                                {item?.title ?? '—'}
                                            </span>
                                            {item && (
                                                <span className="text-[11.5px] font-[500] text-gray-700 tabular-nums">
                                                    {item.requisition?.currency} {fmt(item.totalPrice)}
                                                </span>
                                            )}
                                            {item?.category && (
                                                <span className="text-[11px] text-gray-400">
                                                    {item.category.replace(/_/g, ' ')}
                                                </span>
                                            )}
                                            <span className="text-[11.5px] font-[500]" style={{ color: nr.color }}>
                                                Next: {nr.label}
                                            </span>
                                        </div>

                                        {/* Execution history chips */}
                                        {schedule.executions.length > 0 && (
                                            <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                                                <span className="text-[9.5px] font-[600] uppercase tracking-[0.07em] text-gray-300 mr-0.5">Runs</span>
                                                {schedule.executions.slice(0, 5).map(ex => (
                                                    <span key={ex.id}
                                                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[4px] text-[10px] font-[500]"
                                                        title={`${ex.status} — ${new Date(ex.scheduledFor).toLocaleDateString()}`}
                                                        style={ex.status === 'EXECUTED'
                                                            ? { background: 'rgba(5,150,105,0.08)', color: '#059669', border: '1px solid rgba(5,150,105,0.12)' }
                                                            : { background: 'rgba(225,29,72,0.08)', color: '#e11d48', border: '1px solid rgba(225,29,72,0.12)' }}>
                                                        {ex.status === 'EXECUTED'
                                                            ? <PiCheck className="text-[8px]" />
                                                            : <PiXCircle className="text-[8px]" />}
                                                        {new Date(ex.scheduledFor).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                                                    </span>
                                                ))}
                                                {schedule.executions.some(e => e.status === 'EXECUTED') && (
                                                    <span className="text-[10px] text-gray-300 flex items-center gap-1 ml-0.5">
                                                        <PiFileText className="text-[9px]" /> → Expenses
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {/* Action buttons */}
                                    <div className="flex items-center gap-1.5 shrink-0 pt-0.5">
                                        {schedule.isActive && (
                                            <button onClick={() => handleRunNow(schedule.id, schedule.name)}
                                                disabled={running}
                                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] text-[11px] font-[600] text-white transition-all disabled:opacity-40"
                                                style={{ background: '#6366F1' }}
                                                title="Run now — creates a new expense immediately">
                                                {running
                                                    ? <PiArrowClockwise className="animate-spin text-[12px]" />
                                                    : <PiPlayCircle className="text-[12px]" />}
                                                {running ? 'Running…' : 'Run Now'}
                                            </button>
                                        )}
                                        <button onClick={() => handleToggle(schedule.id)}
                                            disabled={toggling}
                                            className="w-[30px] h-[30px] flex items-center justify-center rounded-[6px] hover:bg-gray-100 transition-colors disabled:opacity-40"
                                            style={{ border: HAIRLINE }}
                                            title={schedule.isActive ? 'Deactivate' : 'Activate'}>
                                            {toggling
                                                ? <PiArrowClockwise className="animate-spin text-[14px] text-gray-400" />
                                                : schedule.isActive
                                                    ? <PiToggleRight className="text-[17px] text-emerald-500" />
                                                    : <PiToggleLeft className="text-[17px] text-gray-400" />}
                                        </button>
                                        <button onClick={() => handleDelete(schedule.id, schedule.name)}
                                            disabled={deleting}
                                            className="w-[30px] h-[30px] flex items-center justify-center rounded-[6px] text-gray-400 hover:text-rose-500 hover:bg-rose-50 transition-colors disabled:opacity-40"
                                            style={{ border: HAIRLINE }}
                                            title="Delete schedule">
                                            {deleting
                                                ? <PiArrowClockwise className="animate-spin text-[14px]" />
                                                : <PiTrash className="text-[14px]" />}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
