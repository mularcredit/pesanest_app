"use client";

import { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import {
    PiPlus, PiX, PiArrowsLeftRight, PiBank, PiDeviceMobile, PiReceipt,
    PiMagnifyingGlass, PiTrash, PiCheckCircle, PiClockCountdown, PiWarningCircle,
    PiArrowUUpLeft, PiCoins, PiCaretDown,
} from "react-icons/pi";
import { createTransfer, updateTransferStatus, deleteTransfer } from "./actions";
import { TRANSFER_TYPES, TRANSFER_STATUSES } from "./constants";
import { useToast } from "@/components/ui/ToastProvider";

const CARD_STYLE: React.CSSProperties = { border: '1px solid rgba(0,0,0,0.09)' };
const ROW_BORDER: React.CSSProperties = { borderBottom: '1px solid rgba(0,0,0,0.06)' };
const INPUT_CLASS = "w-full rounded-[6px] px-3 py-[10px] text-[13px] text-gray-900 placeholder:text-gray-300 outline-none focus:ring-1 focus:ring-[#6366F1] transition-colors bg-white";
const INPUT_STYLE: React.CSSProperties = { border: '1px solid rgba(0,0,0,0.09)' };
const LABEL_CLASS = "block text-[11.5px] font-[500] text-gray-400 mb-1.5";

const TYPE_META: Record<string, { label: string; icon: any; cls: string; border: string }> = {
    BANK_TO_BANK:   { label: 'Bank → Bank',        icon: PiBank,          cls: 'text-indigo-600 bg-indigo-50',   border: 'rgba(99,102,241,0.2)' },
    BANK_TO_MOBILE: { label: 'Bank → Mobile',      icon: PiDeviceMobile,  cls: 'text-emerald-600 bg-emerald-50', border: 'rgba(16,185,129,0.2)' },
    TO_PAYBILL:     { label: 'Into Paybill',       icon: PiReceipt,       cls: 'text-sky-600 bg-sky-50',         border: 'rgba(14,165,233,0.2)' },
    FROM_PAYBILL:   { label: 'Out of Paybill',     icon: PiReceipt,       cls: 'text-amber-600 bg-amber-50',     border: 'rgba(245,158,11,0.2)' },
};

const STATUS_META: Record<string, { label: string; cls: string; border: string; icon: any }> = {
    COMPLETED: { label: 'Completed', cls: 'text-emerald-600 bg-emerald-50', border: 'rgba(16,185,129,0.2)', icon: PiCheckCircle },
    PENDING:   { label: 'Pending',   cls: 'text-amber-600 bg-amber-50',     border: 'rgba(245,158,11,0.2)', icon: PiClockCountdown },
    FAILED:    { label: 'Failed',    cls: 'text-rose-600 bg-rose-50',       border: 'rgba(239,68,68,0.2)',  icon: PiWarningCircle },
    REVERSED:  { label: 'Reversed',  cls: 'text-gray-500 bg-gray-100',      border: 'rgba(0,0,0,0.09)',     icon: PiArrowUUpLeft },
};

type TransferRow = {
    id: string; reference: string; type: string; status: string;
    amount: number; charges: number; currency: string; transferDate: string;
    fromLabel: string | null; toLabel: string | null; toPhone: string | null;
    paybillNumber: string | null; paybillAccount: string | null;
    narration: string | null; externalRef: string | null;
    isPosted: boolean; createdBy: string | null; createdAt: string;
};

type Stats = {
    totalVolume: number; monthVolume: number; totalCharges: number;
    count: number; pendingCount: number; failedCount: number;
    byType: Record<string, { count: number; volume: number }>;
};

const money = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const today = () => new Date().toISOString().slice(0, 10);

const BLANK = {
    type: 'BANK_TO_BANK',
    amount: '', charges: '', currency: 'KES', transferDate: today(),
    fromBankAccountId: '', toBankAccountId: '',
    toPhone: '', paybillNumber: '', paybillAccount: '',
    fromLabel: '', toLabel: '', narration: '', externalRef: '',
    status: 'COMPLETED',
};

export function TransfersManager({
    transfers, stats, bankAccounts, isAdmin,
}: {
    transfers: TransferRow[];
    stats: Stats;
    bankAccounts: { id: string; label: string; currency: string }[];
    isAdmin: boolean;
}) {
    const router = useRouter();
    const { showToast } = useToast();
    const [isOpen, setIsOpen] = useState(false);
    const [mounted, setMounted] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [form, setForm] = useState({ ...BLANK });

    const [typeFilter, setTypeFilter] = useState<string>('ALL');
    const [statusFilter, setStatusFilter] = useState<string>('ALL');
    const [query, setQuery] = useState('');
    const [busyId, setBusyId] = useState<string | null>(null);

    useEffect(() => setMounted(true), []);

    const set = (k: keyof typeof BLANK, v: string) => setForm(f => ({ ...f, [k]: v }));

    const visible = useMemo(() => {
        const q = query.trim().toLowerCase();
        return transfers.filter(t => {
            if (typeFilter !== 'ALL' && t.type !== typeFilter) return false;
            if (statusFilter !== 'ALL' && t.status !== statusFilter) return false;
            if (!q) return true;
            return [t.reference, t.narration, t.externalRef, t.toPhone, t.paybillNumber, t.fromLabel, t.toLabel]
                .some(v => v?.toLowerCase().includes(q));
        });
    }, [transfers, typeFilter, statusFilter, query]);

    const open = () => { setForm({ ...BLANK, fromBankAccountId: bankAccounts[0]?.id || '' }); setIsOpen(true); };
    const close = () => { if (!isSubmitting) setIsOpen(false); };

    const needsFromBank = form.type !== 'FROM_PAYBILL';
    const needsToBank = form.type === 'BANK_TO_BANK' || form.type === 'FROM_PAYBILL';
    const needsPhone = form.type === 'BANK_TO_MOBILE';
    const needsPaybill = form.type === 'TO_PAYBILL' || form.type === 'FROM_PAYBILL';

    const willPost =
        form.status === 'COMPLETED' && (
            (form.type === 'BANK_TO_BANK' && !!form.fromBankAccountId && !!form.toBankAccountId) ||
            (form.type === 'BANK_TO_MOBILE' && !!form.fromBankAccountId) ||
            (form.type === 'TO_PAYBILL' && !!form.fromBankAccountId) ||
            (form.type === 'FROM_PAYBILL' && !!form.toBankAccountId)
        );

    const canSubmit =
        Number(form.amount) > 0 &&
        (!needsPhone || form.toPhone.trim().length > 0) &&
        (!needsPaybill || form.paybillNumber.trim().length > 0) &&
        (form.type !== 'BANK_TO_BANK' || (!!form.fromBankAccountId && !!form.toBankAccountId));

    const submit = async () => {
        setIsSubmitting(true);
        try {
            const fd = new FormData();
            Object.entries(form).forEach(([k, v]) => fd.set(k, v));
            const result = await createTransfer(fd);
            if (result?.success) {
                showToast(
                    `Transfer ${result.reference} recorded${result.posted ? ' and posted to the ledger' : ''}`,
                    "success"
                );
                setIsOpen(false);
                router.refresh();
            } else {
                showToast(result?.error || "Could not record transfer", "error");
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    const changeStatus = async (id: string, status: string) => {
        setBusyId(id);
        try {
            const result = await updateTransferStatus(id, status);
            if (result?.success) { showToast(`Marked ${status.toLowerCase()}`, "success"); router.refresh(); }
            else showToast(result?.error || "Could not update", "error");
        } finally { setBusyId(null); }
    };

    const remove = async (id: string) => {
        setBusyId(id);
        try {
            const result = await deleteTransfer(id);
            if (result?.success) { showToast("Transfer deleted", "success"); router.refresh(); }
            else showToast(result?.error || "Could not delete", "error");
        } finally { setBusyId(null); }
    };

    const statCards = [
        { label: 'Total moved', value: `KES ${money(stats.totalVolume)}`, icon: PiArrowsLeftRight, tone: 'indigo' },
        { label: 'This month', value: `KES ${money(stats.monthVolume)}`, icon: PiCoins, tone: 'emerald' },
        { label: 'Charges paid', value: `KES ${money(stats.totalCharges)}`, icon: PiReceipt, tone: 'rose' },
        { label: 'Pending', value: String(stats.pendingCount), icon: PiClockCountdown, tone: 'amber' },
    ];
    const toneCls: Record<string, string> = {
        indigo: 'text-[#6366F1] bg-indigo-50',
        emerald: 'text-emerald-600 bg-emerald-50',
        rose: 'text-rose-500 bg-rose-50',
        amber: 'text-amber-600 bg-amber-50',
    };

    const modal = mounted && isOpen ? createPortal(
        <div className="fixed inset-0 z-[9998] flex items-center justify-center p-4"
            style={{ background: 'rgba(15,23,42,0.35)', backdropFilter: 'blur(2px)' }}
            onClick={close}>
            <div className="w-full max-w-[560px] max-h-[90vh] overflow-y-auto bg-white rounded-[10px]"
                style={{ boxShadow: '0 20px 50px rgba(0,0,0,0.18)' }}
                onClick={e => e.stopPropagation()}>
                <div className="px-5 py-4 flex items-start justify-between sticky top-0 bg-white z-10" style={ROW_BORDER}>
                    <div>
                        <h2 className="text-[14px] font-[600] text-gray-900 leading-none">Record a transfer</h2>
                        <p className="text-[12px] text-gray-400 mt-1">Log money moved between accounts, mobile numbers or the paybill</p>
                    </div>
                    <button onClick={close} className="p-1 text-gray-300 hover:text-gray-500 rounded-[5px] transition-colors">
                        <PiX className="text-[15px]" />
                    </button>
                </div>

                <div className="px-5 py-5 space-y-4">
                    <div>
                        <label className={LABEL_CLASS}>Transfer type</label>
                        <div className="grid grid-cols-2 gap-2">
                            {TRANSFER_TYPES.map(t => {
                                const meta = TYPE_META[t.value];
                                const active = form.type === t.value;
                                return (
                                    <button key={t.value} type="button" onClick={() => set('type', t.value)}
                                        className="flex items-start gap-2 p-2.5 rounded-[7px] text-left transition-all"
                                        style={{
                                            border: active ? '1px solid #6366F1' : '1px solid rgba(0,0,0,0.09)',
                                            background: active ? 'rgba(99,102,241,0.05)' : 'white',
                                        }}>
                                        <meta.icon className={cn("text-[14px] mt-[1px] shrink-0", active ? "text-[#6366F1]" : "text-gray-300")} />
                                        <div>
                                            <p className={cn("text-[12px] font-[500] leading-tight", active ? "text-[#6366F1]" : "text-gray-600")}>{t.label}</p>
                                            <p className="text-[10.5px] text-gray-400 mt-0.5 leading-tight">{t.hint}</p>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className={LABEL_CLASS}>Amount</label>
                            <input type="number" step="0.01" min="0" value={form.amount}
                                onChange={e => set('amount', e.target.value)}
                                placeholder="0.00" className={INPUT_CLASS} style={INPUT_STYLE} />
                        </div>
                        <div>
                            <label className={LABEL_CLASS}>Charges <span className="text-gray-300 font-[400]">(optional)</span></label>
                            <input type="number" step="0.01" min="0" value={form.charges}
                                onChange={e => set('charges', e.target.value)}
                                placeholder="0.00" className={INPUT_CLASS} style={INPUT_STYLE} />
                        </div>
                    </div>

                    {needsFromBank && (
                        <div>
                            <label className={LABEL_CLASS}>
                                From account {form.type === 'BANK_TO_BANK' ? '' : <span className="text-gray-300 font-[400]">(leave blank if funds came from outside)</span>}
                            </label>
                            <select value={form.fromBankAccountId} onChange={e => set('fromBankAccountId', e.target.value)}
                                className={INPUT_CLASS} style={INPUT_STYLE}>
                                <option value="">— None / external —</option>
                                {bankAccounts.map(b => <option key={b.id} value={b.id}>{b.label}</option>)}
                            </select>
                            {bankAccounts.length === 0 && (
                                <p className="text-[11px] text-amber-600 mt-1.5">
                                    No bank accounts set up yet — the transfer will be recorded without a ledger entry.
                                </p>
                            )}
                        </div>
                    )}

                    {needsToBank && (
                        <div>
                            <label className={LABEL_CLASS}>To account</label>
                            <select value={form.toBankAccountId} onChange={e => set('toBankAccountId', e.target.value)}
                                className={INPUT_CLASS} style={INPUT_STYLE}>
                                <option value="">— None / external —</option>
                                {bankAccounts.map(b => <option key={b.id} value={b.id}>{b.label}</option>)}
                            </select>
                        </div>
                    )}

                    {needsPhone && (
                        <div>
                            <label className={LABEL_CLASS}>Mobile number</label>
                            <input type="text" value={form.toPhone} onChange={e => set('toPhone', e.target.value)}
                                placeholder="e.g. 0712345678" className={INPUT_CLASS} style={INPUT_STYLE} />
                        </div>
                    )}

                    {needsPaybill && (
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className={LABEL_CLASS}>Paybill number</label>
                                <input type="text" value={form.paybillNumber} onChange={e => set('paybillNumber', e.target.value)}
                                    placeholder="e.g. 247247" className={INPUT_CLASS} style={INPUT_STYLE} />
                            </div>
                            <div>
                                <label className={LABEL_CLASS}>Account number <span className="text-gray-300 font-[400]">(optional)</span></label>
                                <input type="text" value={form.paybillAccount} onChange={e => set('paybillAccount', e.target.value)}
                                    placeholder="e.g. 12345678" className={INPUT_CLASS} style={INPUT_STYLE} />
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className={LABEL_CLASS}>Date</label>
                            <input type="date" value={form.transferDate} onChange={e => set('transferDate', e.target.value)}
                                className={INPUT_CLASS} style={INPUT_STYLE} />
                        </div>
                        <div>
                            <label className={LABEL_CLASS}>Status</label>
                            <select value={form.status} onChange={e => set('status', e.target.value)}
                                className={INPUT_CLASS} style={INPUT_STYLE}>
                                {TRANSFER_STATUSES.map(s => (
                                    <option key={s} value={s}>{STATUS_META[s]?.label || s}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className={LABEL_CLASS}>Transaction code <span className="text-gray-300 font-[400]">(optional)</span></label>
                            <input type="text" value={form.externalRef} onChange={e => set('externalRef', e.target.value)}
                                placeholder="M-Pesa / bank ref" className={INPUT_CLASS} style={INPUT_STYLE} />
                        </div>
                        <div>
                            <label className={LABEL_CLASS}>Narration <span className="text-gray-300 font-[400]">(optional)</span></label>
                            <input type="text" value={form.narration} onChange={e => set('narration', e.target.value)}
                                placeholder="What was this for?" className={INPUT_CLASS} style={INPUT_STYLE} />
                        </div>
                    </div>

                    <div className={cn("rounded-[7px] px-3 py-2.5 flex items-start gap-2",
                        willPost ? "bg-emerald-50/60" : "bg-gray-50")}
                        style={{ border: willPost ? '1px solid rgba(16,185,129,0.2)' : '1px solid rgba(0,0,0,0.07)' }}>
                        {willPost
                            ? <PiCheckCircle className="text-emerald-600 text-[13px] mt-[1px] shrink-0" />
                            : <PiWarningCircle className="text-gray-400 text-[13px] mt-[1px] shrink-0" />}
                        <p className="text-[11.5px] text-gray-600 leading-snug">
                            {willPost
                                ? "A balanced journal entry will be posted to the ledger for this movement."
                                : "This will be recorded for monitoring only — no ledger entry, because one side of the transfer isn't one of our own accounts."}
                        </p>
                    </div>
                </div>

                <div className="px-5 py-3.5 flex items-center justify-end gap-2 bg-gray-50/60 sticky bottom-0"
                    style={{ borderTop: '1px solid rgba(0,0,0,0.06)' }}>
                    <button onClick={close} disabled={isSubmitting}
                        className="px-3 py-[7px] rounded-[6px] text-[12.5px] font-[500] text-gray-500 hover:bg-gray-100 transition-colors disabled:opacity-50">
                        Cancel
                    </button>
                    <button onClick={submit} disabled={isSubmitting || !canSubmit}
                        className="px-3.5 py-[7px] rounded-[6px] text-[12.5px] font-[500] text-white bg-[#6366F1] hover:bg-[#5457E5] transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                        {isSubmitting ? 'Saving…' : 'Record transfer'}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    ) : null;

    return (
        <div className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {statCards.map(card => (
                    <div key={card.label} className="bg-white rounded-[8px] px-4 py-3.5" style={CARD_STYLE}>
                        <div className="flex items-center gap-2 mb-2">
                            <div className={cn("w-6 h-6 rounded-[5px] flex items-center justify-center", toneCls[card.tone])}>
                                <card.icon className="text-[12px]" />
                            </div>
                            <p className="text-[11.5px] text-gray-400 font-[500]">{card.label}</p>
                        </div>
                        <p className="text-[16px] font-[600] text-gray-900 font-mono tabular-nums">{card.value}</p>
                    </div>
                ))}
            </div>

            <div className="flex items-center gap-2 flex-wrap">
                <button onClick={open}
                    className="flex items-center gap-1.5 px-3 py-[7px] rounded-[6px] text-[12.5px] font-[500] text-white bg-[#6366F1] hover:bg-[#5457E5] transition-colors">
                    <PiPlus className="text-[12px]" /> New transfer
                </button>

                <div className="relative">
                    <PiMagnifyingGlass className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-300 text-[13px]" />
                    <input type="text" value={query} onChange={e => setQuery(e.target.value)}
                        placeholder="Search reference, phone, paybill…"
                        className="w-[240px] rounded-[6px] pl-8 pr-3 py-[7px] text-[12.5px] text-gray-900 placeholder:text-gray-300 outline-none focus:ring-1 focus:ring-[#6366F1] bg-white transition-colors"
                        style={INPUT_STYLE} />
                </div>

                <FilterSelect value={typeFilter} onChange={setTypeFilter}
                    options={[{ value: 'ALL', label: 'All types' }, ...TRANSFER_TYPES.map(t => ({ value: t.value, label: t.label }))]} />
                <FilterSelect value={statusFilter} onChange={setStatusFilter}
                    options={[{ value: 'ALL', label: 'All statuses' }, ...TRANSFER_STATUSES.map(s => ({ value: s, label: STATUS_META[s].label }))]} />

                <p className="text-[12px] text-gray-400 ml-auto">
                    {visible.length} of {transfers.length}
                </p>
            </div>

            <div className="bg-white rounded-[9px] overflow-hidden" style={CARD_STYLE}>
                {visible.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 gap-2.5">
                        <div className="w-11 h-11 rounded-[9px] bg-gray-50 flex items-center justify-center" style={CARD_STYLE}>
                            <PiArrowsLeftRight className="text-xl text-gray-300" />
                        </div>
                        <div className="text-center">
                            <p className="text-[13.5px] font-[600] text-gray-900">
                                {transfers.length === 0 ? 'No transfers recorded yet' : 'Nothing matches those filters'}
                            </p>
                            <p className="text-[12.5px] text-gray-400 mt-0.5">
                                {transfers.length === 0
                                    ? 'Record your first bank, mobile or paybill movement.'
                                    : 'Try clearing the search or filters.'}
                            </p>
                        </div>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="bg-gray-50/70" style={ROW_BORDER}>
                                    <Th>Date</Th><Th>Reference</Th><Th>Type</Th><Th>From → To</Th>
                                    <Th right>Amount</Th><Th right>Charges</Th><Th>Status</Th><Th>Ledger</Th><Th right>Actions</Th>
                                </tr>
                            </thead>
                            <tbody>
                                {visible.map(t => {
                                    const typeMeta = TYPE_META[t.type] || TYPE_META.BANK_TO_BANK;
                                    const statusMeta = STATUS_META[t.status] || STATUS_META.PENDING;
                                    const dest = t.toPhone
                                        || (t.paybillNumber ? `Paybill ${t.paybillNumber}${t.paybillAccount ? ` / ${t.paybillAccount}` : ''}` : null)
                                        || t.toLabel || '—';
                                    return (
                                        <tr key={t.id} className="hover:bg-gray-50/50 transition-colors" style={ROW_BORDER}>
                                            <td className="px-4 py-3 text-[12.5px] text-gray-400 whitespace-nowrap">
                                                {new Date(t.transferDate).toLocaleDateString()}
                                            </td>
                                            <td className="px-4 py-3">
                                                <p className="text-[12px] font-mono text-gray-900">{t.reference}</p>
                                                {t.externalRef && <p className="text-[11px] text-gray-400 font-mono mt-0.5">{t.externalRef}</p>}
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={cn("inline-flex items-center gap-1 px-2 py-[3px] rounded-[4px] text-[10.5px] font-[500] whitespace-nowrap", typeMeta.cls)}
                                                    style={{ border: `1px solid ${typeMeta.border}` }}>
                                                    <typeMeta.icon className="text-[10px]" /> {typeMeta.label}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 max-w-[230px]">
                                                <p className="text-[12.5px] text-gray-900 truncate" title={t.fromLabel || '—'}>{t.fromLabel || '—'}</p>
                                                <p className="text-[11.5px] text-gray-400 truncate mt-0.5" title={dest}>→ {dest}</p>
                                            </td>
                                            <td className="px-4 py-3 text-right font-mono text-[13px] text-gray-900 tabular-nums font-[500]">
                                                {money(t.amount)}
                                            </td>
                                            <td className="px-4 py-3 text-right font-mono text-[12.5px] text-gray-400 tabular-nums">
                                                {t.charges > 0 ? money(t.charges) : '—'}
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={cn("inline-flex items-center gap-1 px-2 py-[3px] rounded-[4px] text-[10.5px] font-[500]", statusMeta.cls)}
                                                    style={{ border: `1px solid ${statusMeta.border}` }}>
                                                    <statusMeta.icon className="text-[10px]" /> {statusMeta.label}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                {t.isPosted
                                                    ? <span className="text-[11.5px] text-emerald-600 font-[500]">Posted</span>
                                                    : <span className="text-[11.5px] text-gray-300">Not posted</span>}
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center justify-end gap-1">
                                                    {t.status === 'PENDING' && (
                                                        <button onClick={() => changeStatus(t.id, 'COMPLETED')} disabled={busyId === t.id}
                                                            title="Mark completed"
                                                            className="px-2 py-1 rounded-[5px] text-[11px] font-[500] text-emerald-600 hover:bg-emerald-50 transition-colors disabled:opacity-40"
                                                            style={{ border: '1px solid rgba(16,185,129,0.2)' }}>
                                                            Complete
                                                        </button>
                                                    )}
                                                    {t.status === 'COMPLETED' && (
                                                        <button onClick={() => changeStatus(t.id, 'REVERSED')} disabled={busyId === t.id}
                                                            title="Mark reversed"
                                                            className="p-1.5 text-gray-300 hover:text-amber-600 hover:bg-amber-50 rounded-[5px] transition-colors disabled:opacity-40">
                                                            <PiArrowUUpLeft className="text-[13px]" />
                                                        </button>
                                                    )}
                                                    {isAdmin && !t.isPosted && (
                                                        <button onClick={() => remove(t.id)} disabled={busyId === t.id}
                                                            title="Delete"
                                                            className="p-1.5 text-gray-300 hover:text-rose-500 hover:bg-rose-50 rounded-[5px] transition-colors disabled:opacity-40">
                                                            <PiTrash className="text-[13px]" />
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {modal}
        </div>
    );
}

function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
    return (
        <th className={cn("px-4 py-2.5 text-[11px] font-[500] text-gray-400 uppercase tracking-wide whitespace-nowrap",
            right ? "text-right" : "text-left")}>
            {children}
        </th>
    );
}

function FilterSelect({ value, onChange, options }: {
    value: string; onChange: (v: string) => void; options: { value: string; label: string }[];
}) {
    return (
        <div className="relative">
            <select value={value} onChange={e => onChange(e.target.value)}
                className="appearance-none rounded-[6px] pl-3 pr-7 py-[7px] text-[12.5px] text-gray-600 bg-white outline-none focus:ring-1 focus:ring-[#6366F1] cursor-pointer transition-colors"
                style={{ border: '1px solid rgba(0,0,0,0.09)' }}>
                {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <PiCaretDown className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-300 text-[11px] pointer-events-none" />
        </div>
    );
}
