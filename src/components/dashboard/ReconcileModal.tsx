"use client";

import { useState, useCallback } from "react";
import { createPortal } from "react-dom";
import {
    PiX, PiCheckCircle, PiWarningCircle, PiClock, PiEye,
    PiShieldCheck, PiUploadSimple, PiReceipt,
} from "react-icons/pi";

export interface ReceiptVerificationSummary {
    id: string;
    status: string;
    supplierName: string | null;
    supplierPin: string | null;
    fiscalInvoiceNo: string | null;
    invoiceDate: string | null;
    amountVerified: number | null;
    vatAmountVerified: number | null;
    verificationRef: string | null;
    failureReason: string | null;
}

export interface ExpenseInBatch {
    id: string;
    title: string;
    amount: number;
    currency: string;
    category: string;
    merchant: string | null;
    receiptUrl: string | null;
    etrNumber: string | null;
    user: { name: string | null };
    receiptVerification?: ReceiptVerificationSummary | null;
}

export interface RequisitionInBatch {
    id: string;
    title: string;
    amount: number;
    currency: string;
    category: string;
    receiptUrl: string | null;
    etrNumber: string | null;
    etrVerified: boolean;
    user: { name: string | null };
}

export interface BatchForReconcile {
    id: string;
    amount: number;
    currency: string;
    expenses?: ExpenseInBatch[];
    requisitions?: RequisitionInBatch[];
}

interface ExpenseVerificationState {
    uploading: boolean;
    verifying: boolean;
    receiptFile: File | null;
    receiptUrl?: string;
    fiscalInvoiceNo: string;
    supplierPin: string;
    supplierName: string;
    invoiceDate: string;
    totalAmount: string;
    vatAmount: string;
    status?: string;
    failureReason?: string;
    referenceId?: string;
}

interface Props {
    batch: BatchForReconcile;
    isSystemAdmin: boolean;
    onClose: () => void;
    onComplete: () => void;
}

const HAIRLINE = '1px solid rgba(0,0,0,0.07)';

function fmt(amount: number, currency: string) {
    const sym = currency === 'USD' ? '$' : currency === 'KES' ? 'KSh' : currency;
    return `${sym} ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function StatusBadge({ status }: { status?: string }) {
    if (!status) {
        return (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[4px] text-[10px] font-[600] uppercase tracking-[0.07em]"
                style={{ background: '#f1f5f9', color: '#64748b' }}>
                <PiEye className="text-[11px]" /> Not Verified
            </span>
        );
    }
    if (status === 'VERIFIED') {
        return (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[4px] text-[10px] font-[600] uppercase tracking-[0.07em]"
                style={{ background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0' }}>
                <PiCheckCircle className="text-[11px]" /> Verified
            </span>
        );
    }
    if (status === 'FAILED') {
        return (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[4px] text-[10px] font-[600] uppercase tracking-[0.07em]"
                style={{ background: '#fff1f2', color: '#e11d48', border: '1px solid #fecdd3' }}>
                <PiWarningCircle className="text-[11px]" /> Failed
            </span>
        );
    }
    if (status === 'NEEDS_REVIEW') {
        return (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[4px] text-[10px] font-[600] uppercase tracking-[0.07em]"
                style={{ background: '#fffbeb', color: '#d97706', border: '1px solid #fde68a' }}>
                <PiEye className="text-[11px]" /> Needs Review
            </span>
        );
    }
    return null;
}

function initState(exp: ExpenseInBatch): ExpenseVerificationState {
    const existing = exp.receiptVerification;
    return {
        uploading: false,
        verifying: false,
        receiptFile: null,
        receiptUrl: existing?.fiscalInvoiceNo ? (exp.receiptUrl ?? undefined) : undefined,
        fiscalInvoiceNo: existing?.fiscalInvoiceNo ?? exp.etrNumber ?? '',
        supplierPin: existing?.supplierPin ?? '',
        supplierName: existing?.supplierName ?? exp.merchant ?? '',
        invoiceDate: existing?.invoiceDate ?? '',
        totalAmount: existing?.amountVerified?.toString() ?? exp.amount.toString(),
        vatAmount: existing?.vatAmountVerified?.toString() ?? '',
        status: existing?.status,
        failureReason: existing?.failureReason ?? undefined,
        referenceId: existing?.verificationRef ?? undefined,
    };
}

export function ReconcileModal({ batch, isSystemAdmin, onClose, onComplete }: Props) {
    const expenses = batch.expenses ?? [];
    const requisitions = batch.requisitions ?? [];

    const [states, setStates] = useState<Record<string, ExpenseVerificationState>>(() => {
        const init: Record<string, ExpenseVerificationState> = {};
        expenses.forEach(e => { init[e.id] = initState(e); });
        requisitions.forEach(r => {
            init[r.id] = {
                uploading: false, verifying: false, receiptFile: null,
                receiptUrl: r.receiptUrl ?? undefined,
                fiscalInvoiceNo: r.etrNumber ?? '',
                supplierPin: '', supplierName: '', invoiceDate: '',
                totalAmount: String(r.amount), vatAmount: '',
                status: r.etrVerified ? 'VERIFIED' : undefined,
            };
        });
        return init;
    });
    const [completing, setCompleting] = useState(false);

    const update = useCallback((id: string, patch: Partial<ExpenseVerificationState>) => {
        setStates(prev => ({ ...prev, [id]: { ...prev[id], ...patch } }));
    }, []);

    async function handleVerify(expense: ExpenseInBatch) {
        const ev = states[expense.id];
        if (!ev.fiscalInvoiceNo.trim()) return;

        let receiptUrl = ev.receiptUrl;
        if (ev.receiptFile) {
            update(expense.id, { uploading: true });
            try {
                const fd = new FormData();
                fd.append('file', ev.receiptFile);
                const up = await fetch('/api/upload', { method: 'POST', body: fd });
                const upData = await up.json();
                if (up.ok) { receiptUrl = upData.url; update(expense.id, { receiptUrl, uploading: false }); }
                else update(expense.id, { uploading: false });
            } catch { update(expense.id, { uploading: false }); }
        }

        update(expense.id, { verifying: true, status: undefined, failureReason: undefined });
        try {
            const res = await fetch('/api/payments/verify-receipt', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    expenseId: expense.id, receiptUrl,
                    fiscalInvoiceNo: ev.fiscalInvoiceNo.trim(),
                    supplierPin: ev.supplierPin.trim() || undefined,
                    supplierName: ev.supplierName.trim() || undefined,
                    invoiceDate: ev.invoiceDate || undefined,
                    totalAmount: ev.totalAmount ? parseFloat(ev.totalAmount) : undefined,
                    vatAmount: ev.vatAmount ? parseFloat(ev.vatAmount) : undefined,
                }),
            });
            const data = await res.json();
            update(expense.id, {
                verifying: false,
                status: res.ok ? data.status : 'FAILED',
                failureReason: data.failureReason || data.error || undefined,
                referenceId: data.referenceId || undefined,
            });
        } catch (err: any) {
            update(expense.id, { verifying: false, status: 'FAILED', failureReason: err.message });
        }
    }

    async function handleVerifyRequisition(req: RequisitionInBatch) {
        const ev = states[req.id];
        if (!ev.fiscalInvoiceNo.trim()) return;
        update(req.id, { verifying: true, status: undefined, failureReason: undefined });
        try {
            const res = await fetch('/api/payments/verify-receipt', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    requisitionId: req.id,
                    fiscalInvoiceNo: ev.fiscalInvoiceNo.trim(),
                    supplierPin: ev.supplierPin.trim() || undefined,
                    supplierName: ev.supplierName.trim() || undefined,
                    totalAmount: ev.totalAmount ? parseFloat(ev.totalAmount) : undefined,
                }),
            });
            const data = await res.json();
            update(req.id, {
                verifying: false,
                status: res.ok ? data.status : 'FAILED',
                failureReason: data.error || data.failureReason || undefined,
                referenceId: data.referenceId || undefined,
            });
        } catch (err: any) {
            update(req.id, { verifying: false, status: 'FAILED', failureReason: err.message });
        }
    }

    async function handleComplete(force = false) {
        setCompleting(true);
        try {
            const res = await fetch('/api/payments/action', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ paymentId: batch.id, action: 'CLOSE' }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            onComplete();
        } catch (err: any) {
            alert(err.message || 'Failed to close payment');
            setCompleting(false);
        }
    }

    const allItems = [...expenses.map(e => e.id), ...requisitions.map(r => r.id)];
    const verifiedCount = allItems.filter(id => states[id]?.status === 'VERIFIED').length;
    const allVerified = allItems.length === 0 || verifiedCount === allItems.length;
    const hasUnresolved = allItems.some(id => {
        const s = states[id]?.status;
        return !s || s === 'FAILED' || s === 'NEEDS_REVIEW';
    });

    return createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40" onClick={() => !completing && onClose()} />
            <div
                className="relative bg-white rounded-[12px] w-full flex flex-col z-[10000]"
                style={{ maxWidth: 720, maxHeight: '92vh', border: '1px solid rgba(0,0,0,0.09)', boxShadow: '0 24px 64px rgba(0,0,0,0.18)' }}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 shrink-0" style={{ borderBottom: HAIRLINE }}>
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-[7px] bg-indigo-50 flex items-center justify-center shrink-0">
                            <PiShieldCheck className="text-[#6366F1] text-[16px]" />
                        </div>
                        <div>
                            <h3 className="text-[14px] font-[600] text-gray-900">eTIMS Receipt Verification</h3>
                            <p className="text-[11.5px] text-gray-400 mt-0.5">
                                Verify all supplier receipts before closing this payment batch
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        {allItems.length > 0 && (
                            <span className="text-[11px] font-[500] text-gray-500">
                                <span className="font-[700] text-emerald-600">{verifiedCount}</span>
                                <span className="text-gray-300 mx-1">/</span>
                                {allItems.length} verified
                            </span>
                        )}
                        <button onClick={() => !completing && onClose()}
                            className="p-1.5 rounded-[5px] hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors">
                            <PiX className="text-[15px]" />
                        </button>
                    </div>
                </div>

                {/* Progress bar */}
                {allItems.length > 0 && (
                    <div className="h-1 bg-gray-100 shrink-0">
                        <div
                            className="h-1 bg-emerald-500 transition-all duration-500"
                            style={{ width: `${(verifiedCount / allItems.length) * 100}%` }}
                        />
                    </div>
                )}

                {/* Body */}
                <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5 min-h-0">
                    {allItems.length === 0 ? (
                        <div className="py-10 text-center">
                            <PiReceipt className="text-[32px] text-gray-300 mx-auto mb-3" />
                            <p className="text-[13px] font-[500] text-gray-500">No items requiring eTIMS verification.</p>
                            <p className="text-[11.5px] text-gray-400 mt-1 mb-6">This batch contains only direct invoices — no receipts to verify.</p>
                            <button
                                onClick={() => handleComplete(false)}
                                disabled={completing}
                                className="inline-flex items-center gap-2 px-5 py-2.5 text-[13px] font-[600] text-white rounded-[8px] transition-colors disabled:opacity-40"
                                style={{ backgroundColor: completing ? '#4f46e5' : '#6366F1' }}
                            >
                                {completing && <PiClock className="animate-spin text-[12px]" />}
                                {completing ? 'Closing…' : 'Close Batch'}
                            </button>
                        </div>
                    ) : (
                    <>
                        {expenses.map((expense, i) => {
                            const ev = states[expense.id];
                            const isVerifying = ev.uploading || ev.verifying;
                            const canVerify = ev.fiscalInvoiceNo.trim().length > 0 && !isVerifying;

                            return (
                                <div key={expense.id} className="rounded-[10px] overflow-hidden"
                                    style={{ border: ev.status === 'VERIFIED' ? '1px solid #bbf7d0' : ev.status === 'FAILED' ? '1px solid #fecdd3' : '1px solid rgba(0,0,0,0.09)' }}>

                                    {/* Expense header */}
                                    <div className="flex items-start justify-between px-4 py-3"
                                        style={{ borderBottom: HAIRLINE, background: ev.status === 'VERIFIED' ? '#f0fdf4' : ev.status === 'FAILED' ? '#fff1f2' : '#fafafa' }}>
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] font-[600] text-gray-400 uppercase tracking-widest">#{i + 1}</span>
                                                <p className="text-[13px] font-[600] text-gray-900 truncate">{expense.title}</p>
                                            </div>
                                            <p className="text-[11px] text-gray-400 mt-0.5">
                                                {expense.merchant && <span>{expense.merchant} · </span>}
                                                {expense.user.name} · {fmt(expense.amount, expense.currency)}
                                            </p>
                                        </div>
                                        <div className="shrink-0 ml-3 mt-0.5">
                                            <StatusBadge status={ev.status} />
                                        </div>
                                    </div>

                                    {/* Verification fields */}
                                    <div className="px-4 py-4 space-y-3">
                                        {/* Failure reason */}
                                        {ev.failureReason && (
                                            <div className="flex items-start gap-2 px-3 py-2 rounded-[6px]"
                                                style={{ background: '#fff1f2', border: '1px solid #fecdd3' }}>
                                                <PiWarningCircle className="text-rose-500 text-[13px] mt-0.5 shrink-0" />
                                                <p className="text-[11px] text-rose-700">{ev.failureReason}</p>
                                            </div>
                                        )}

                                        {/* Ref ID */}
                                        {ev.referenceId && ev.status === 'VERIFIED' && (
                                            <div className="flex items-center gap-2 px-3 py-2 rounded-[6px]"
                                                style={{ background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                                                <PiCheckCircle className="text-emerald-600 text-[13px] shrink-0" />
                                                <p className="text-[11px] text-emerald-700 font-mono">Ref: {ev.referenceId}</p>
                                            </div>
                                        )}

                                        {/* Fields grid */}
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="col-span-2 sm:col-span-1">
                                                <label className="block text-[10.5px] font-[600] text-gray-500 uppercase tracking-[0.07em] mb-1">
                                                    CU / Fiscal Invoice No. <span className="text-rose-400">*</span>
                                                </label>
                                                <input
                                                    type="text"
                                                    value={ev.fiscalInvoiceNo}
                                                    onChange={e => update(expense.id, { fiscalInvoiceNo: e.target.value, status: undefined })}
                                                    placeholder="e.g. CU12345678"
                                                    disabled={isVerifying}
                                                    className="w-full px-3 py-2 text-[12.5px] text-gray-800 rounded-[6px] outline-none focus:ring-2 focus:ring-indigo-200 transition-all disabled:opacity-50"
                                                    style={{ border: '1px solid rgba(0,0,0,0.12)' }}
                                                />
                                            </div>

                                            <div className="col-span-2 sm:col-span-1">
                                                <label className="block text-[10.5px] font-[600] text-gray-500 uppercase tracking-[0.07em] mb-1">
                                                    Supplier KRA PIN
                                                </label>
                                                <input
                                                    type="text"
                                                    value={ev.supplierPin}
                                                    onChange={e => update(expense.id, { supplierPin: e.target.value.toUpperCase(), status: undefined })}
                                                    placeholder="e.g. A001234567X"
                                                    disabled={isVerifying}
                                                    className="w-full px-3 py-2 text-[12.5px] text-gray-800 rounded-[6px] outline-none focus:ring-2 focus:ring-indigo-200 transition-all disabled:opacity-50"
                                                    style={{ border: '1px solid rgba(0,0,0,0.12)' }}
                                                />
                                            </div>

                                            <div className="col-span-2 sm:col-span-1">
                                                <label className="block text-[10.5px] font-[600] text-gray-500 uppercase tracking-[0.07em] mb-1">
                                                    Supplier Name
                                                </label>
                                                <input
                                                    type="text"
                                                    value={ev.supplierName}
                                                    onChange={e => update(expense.id, { supplierName: e.target.value })}
                                                    placeholder="Supplier Ltd"
                                                    disabled={isVerifying}
                                                    className="w-full px-3 py-2 text-[12.5px] text-gray-800 rounded-[6px] outline-none focus:ring-2 focus:ring-indigo-200 transition-all disabled:opacity-50"
                                                    style={{ border: '1px solid rgba(0,0,0,0.12)' }}
                                                />
                                            </div>

                                            <div className="col-span-2 sm:col-span-1">
                                                <label className="block text-[10.5px] font-[600] text-gray-500 uppercase tracking-[0.07em] mb-1">
                                                    Invoice Date
                                                </label>
                                                <input
                                                    type="date"
                                                    value={ev.invoiceDate}
                                                    onChange={e => update(expense.id, { invoiceDate: e.target.value })}
                                                    disabled={isVerifying}
                                                    className="w-full px-3 py-2 text-[12.5px] text-gray-800 rounded-[6px] outline-none focus:ring-2 focus:ring-indigo-200 transition-all disabled:opacity-50"
                                                    style={{ border: '1px solid rgba(0,0,0,0.12)' }}
                                                />
                                            </div>

                                            <div>
                                                <label className="block text-[10.5px] font-[600] text-gray-500 uppercase tracking-[0.07em] mb-1">
                                                    Total Amount ({expense.currency})
                                                </label>
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    min="0"
                                                    value={ev.totalAmount}
                                                    onChange={e => update(expense.id, { totalAmount: e.target.value })}
                                                    disabled={isVerifying}
                                                    className="w-full px-3 py-2 text-[12.5px] text-gray-800 rounded-[6px] outline-none focus:ring-2 focus:ring-indigo-200 transition-all disabled:opacity-50 font-mono"
                                                    style={{ border: '1px solid rgba(0,0,0,0.12)' }}
                                                />
                                            </div>

                                            <div>
                                                <label className="block text-[10.5px] font-[600] text-gray-500 uppercase tracking-[0.07em] mb-1">
                                                    VAT Amount ({expense.currency})
                                                </label>
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    min="0"
                                                    value={ev.vatAmount}
                                                    onChange={e => update(expense.id, { vatAmount: e.target.value })}
                                                    disabled={isVerifying}
                                                    className="w-full px-3 py-2 text-[12.5px] text-gray-800 rounded-[6px] outline-none focus:ring-2 focus:ring-indigo-200 transition-all disabled:opacity-50 font-mono"
                                                    style={{ border: '1px solid rgba(0,0,0,0.12)' }}
                                                />
                                            </div>
                                        </div>

                                        {/* Receipt upload + verify */}
                                        <div className="flex items-center gap-3 pt-1">
                                            <label className="flex items-center gap-2 px-3 py-2 rounded-[6px] text-[11.5px] font-[500] text-gray-600 cursor-pointer hover:bg-gray-50 transition-colors"
                                                style={{ border: '1px solid rgba(0,0,0,0.09)' }}>
                                                <PiUploadSimple className="text-[13px] text-gray-400" />
                                                {ev.receiptFile ? ev.receiptFile.name.slice(0, 28) + (ev.receiptFile.name.length > 28 ? '…' : '') : 'Upload Receipt (optional)'}
                                                <input
                                                    type="file"
                                                    accept="image/jpeg,image/png,application/pdf"
                                                    className="hidden"
                                                    onChange={e => update(expense.id, { receiptFile: e.target.files?.[0] ?? null })}
                                                    disabled={isVerifying}
                                                />
                                            </label>

                                            {ev.receiptUrl && !ev.receiptFile && (
                                                <a href={ev.receiptUrl} target="_blank" rel="noreferrer"
                                                    className="text-[11px] text-indigo-500 hover:underline">
                                                    View existing
                                                </a>
                                            )}

                                            <button
                                                onClick={() => handleVerify(expense)}
                                                disabled={!canVerify}
                                                className="ml-auto px-4 py-2 text-[12px] font-[600] text-white bg-[#6366F1] rounded-[6px] hover:bg-indigo-700 transition-colors disabled:opacity-40 flex items-center gap-2 shrink-0"
                                            >
                                                {ev.uploading && <PiClock className="animate-spin text-[12px]" />}
                                                {ev.verifying && <PiClock className="animate-spin text-[12px]" />}
                                                {ev.uploading ? 'Uploading…' : ev.verifying ? 'Verifying…' : 'Verify Receipt'}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}

                    {/* Requisitions */}
                    {requisitions.map((req, i) => {
                        const ev = states[req.id];
                        if (!ev) return null;
                        const isVerifying = ev.verifying;
                        const canVerify = ev.fiscalInvoiceNo.trim().length > 0 && !isVerifying;
                        return (
                            <div key={req.id} className="rounded-[10px] overflow-hidden"
                                style={{ border: ev.status === 'VERIFIED' ? '1px solid #bbf7d0' : ev.status === 'FAILED' ? '1px solid #fecdd3' : '1px solid rgba(0,0,0,0.09)' }}>
                                <div className="flex items-start justify-between px-4 py-3"
                                    style={{ borderBottom: HAIRLINE, background: ev.status === 'VERIFIED' ? '#f0fdf4' : ev.status === 'FAILED' ? '#fff1f2' : '#fafafa' }}>
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] font-[600] text-indigo-400 uppercase tracking-widest">REQ #{i + 1}</span>
                                            <p className="text-[13px] font-[600] text-gray-900 truncate">{req.title}</p>
                                        </div>
                                        <p className="text-[11px] text-gray-400 mt-0.5">
                                            {req.user.name} · {fmt(req.amount, req.currency)} · {req.category}
                                        </p>
                                    </div>
                                    <div className="shrink-0 ml-3 mt-0.5">
                                        <StatusBadge status={ev.status} />
                                    </div>
                                </div>
                                <div className="px-4 py-4 space-y-3">
                                    {ev.failureReason && (
                                        <div className="flex items-start gap-2 px-3 py-2 rounded-[6px]"
                                            style={{ background: '#fff1f2', border: '1px solid #fecdd3' }}>
                                            <PiWarningCircle className="text-rose-500 text-[13px] mt-0.5 shrink-0" />
                                            <p className="text-[11px] text-rose-700">{ev.failureReason}</p>
                                        </div>
                                    )}
                                    {ev.referenceId && ev.status === 'VERIFIED' && (
                                        <div className="flex items-center gap-2 px-3 py-2 rounded-[6px]"
                                            style={{ background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                                            <PiCheckCircle className="text-emerald-600 text-[13px] shrink-0" />
                                            <p className="text-[11px] text-emerald-700 font-mono">Ref: {ev.referenceId}</p>
                                        </div>
                                    )}
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="col-span-2 sm:col-span-1">
                                            <label className="block text-[10.5px] font-[600] text-gray-500 uppercase tracking-[0.07em] mb-1">
                                                CU / Fiscal Invoice No. <span className="text-rose-400">*</span>
                                            </label>
                                            <input type="text" value={ev.fiscalInvoiceNo}
                                                onChange={e => update(req.id, { fiscalInvoiceNo: e.target.value, status: undefined })}
                                                placeholder="e.g. CU12345678"
                                                disabled={isVerifying}
                                                className="w-full px-3 py-2 text-[12.5px] text-gray-800 rounded-[6px] outline-none focus:ring-2 focus:ring-indigo-200 transition-all disabled:opacity-50"
                                                style={{ border: '1px solid rgba(0,0,0,0.12)' }} />
                                        </div>
                                        <div className="col-span-2 sm:col-span-1">
                                            <label className="block text-[10.5px] font-[600] text-gray-500 uppercase tracking-[0.07em] mb-1">Supplier KRA PIN</label>
                                            <input type="text" value={ev.supplierPin}
                                                onChange={e => update(req.id, { supplierPin: e.target.value })}
                                                placeholder="e.g. P051234567X"
                                                disabled={isVerifying}
                                                className="w-full px-3 py-2 text-[12.5px] text-gray-800 rounded-[6px] outline-none focus:ring-2 focus:ring-indigo-200 transition-all disabled:opacity-50"
                                                style={{ border: '1px solid rgba(0,0,0,0.12)' }} />
                                        </div>
                                        <div className="col-span-2">
                                            <label className="block text-[10.5px] font-[600] text-gray-500 uppercase tracking-[0.07em] mb-1">Supplier Name</label>
                                            <input type="text" value={ev.supplierName}
                                                onChange={e => update(req.id, { supplierName: e.target.value })}
                                                placeholder="Vendor name"
                                                disabled={isVerifying}
                                                className="w-full px-3 py-2 text-[12.5px] text-gray-800 rounded-[6px] outline-none focus:ring-2 focus:ring-indigo-200 transition-all disabled:opacity-50"
                                                style={{ border: '1px solid rgba(0,0,0,0.12)' }} />
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-end pt-1">
                                        <button onClick={() => handleVerifyRequisition(req)}
                                            disabled={!canVerify}
                                            className="px-4 py-2 text-[12px] font-[600] text-white rounded-[6px] hover:opacity-90 transition-colors disabled:opacity-40 flex items-center gap-2 shrink-0"
                                            style={{ backgroundColor: '#6366F1' }}>
                                            {ev.verifying && <PiClock className="animate-spin text-[12px]" />}
                                            {ev.verifying ? 'Verifying…' : 'Verify Receipt'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                    </>
                    )}
                </div>

                {/* Footer */}
                <div className="shrink-0 px-6 py-4 flex items-center justify-between gap-4" style={{ borderTop: HAIRLINE }}>
                    <div className="min-w-0">
                        {!allVerified && allItems.length > 0 && (
                            <p className="text-[11.5px] text-amber-600 flex items-start gap-1.5">
                                <PiWarningCircle className="text-[13px] mt-0.5 shrink-0" />
                                <span>
                                    {hasUnresolved
                                        ? `${allItems.length - verifiedCount} receipt(s) still need verification.${isSystemAdmin ? ' You can override below.' : ''}`
                                        : 'All receipts verified.'}
                                </span>
                            </p>
                        )}
                        {allVerified && allItems.length > 0 && (
                            <p className="text-[11.5px] text-emerald-600 flex items-center gap-1.5">
                                <PiCheckCircle className="text-[13px]" />
                                All receipts verified — ready to close.
                            </p>
                        )}
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                        <button onClick={() => !completing && onClose()}
                            disabled={completing}
                            className="px-4 py-2 text-[13px] font-[500] text-gray-500 rounded-[6px] hover:bg-gray-50 transition-colors"
                            style={{ border: '1px solid rgba(0,0,0,0.09)' }}>
                            Cancel
                        </button>

                        {/* Admin override when not all verified */}
                        {!allVerified && isSystemAdmin && allItems.length > 0 && (
                            <button
                                onClick={() => handleComplete(true)}
                                disabled={completing}
                                className="px-4 py-2 text-[12.5px] font-[600] text-amber-700 rounded-[6px] hover:bg-amber-50 transition-colors flex items-center gap-2 disabled:opacity-50"
                                style={{ border: '1px solid #fde68a' }}>
                                {completing && <PiClock className="animate-spin text-[12px]" />}
                                Override & Close
                            </button>
                        )}

                        {expenses.length > 0 && (
                            <button
                                onClick={() => handleComplete(false)}
                                disabled={(!allVerified && !isSystemAdmin) || completing}
                                className="px-5 py-2 text-[13px] font-[600] text-white rounded-[6px] transition-colors disabled:opacity-40 flex items-center gap-2"
                                style={{ backgroundColor: '#6366F1' }}
                            >
                                {completing && <PiClock className="animate-spin text-[12px]" />}
                                Complete Reconciliation
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
}
