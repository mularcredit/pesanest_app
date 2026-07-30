"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/ToastProvider";
import { CustomSelect } from "@/components/ui/CustomSelect";
import {
    PiUser, PiInvoice, PiPlus, PiTrash,
    PiSpinner, PiPaperPlaneRight, PiFloppyDisk,
    PiCalendarBlank, PiWarning
} from "react-icons/pi";

const CARD_STYLE: React.CSSProperties = { border: '1px solid rgba(0,0,0,0.09)' };
const INPUT_CLS = "w-full rounded-[6px] px-3 py-[10px] text-[13px] text-gray-900 placeholder:text-gray-300 outline-none focus:ring-1 focus:ring-[#6366F1] transition-colors bg-white";
const INPUT_STYLE: React.CSSProperties = { border: '1px solid rgba(0,0,0,0.09)' };
const LABEL_CLS = "block text-[11.5px] font-[500] text-gray-400 mb-1.5";

interface SaleItem {
    id: number | string;
    description: string;
    quantity: number;
    unitPrice: number;
}

interface Customer {
    id: string;
    name: string;
    currency: string;
}

export interface SalesFormProps {
    customers: Customer[];
    initialData?: {
        id: string;
        customerId: string;
        invoiceNumber: string;
        issueDate: string | Date;
        dueDate: string | Date;
        notes?: string | null;
        status: string;
        items: SaleItem[];
    };
}

export function SalesForm({ customers, initialData }: SalesFormProps) {
    const router = useRouter();
    const { showToast } = useToast();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [mounted, setMounted] = useState(false);
    const [isDeleteOpen, setIsDeleteOpen] = useState(false);

    useEffect(() => { setMounted(true); }, []);

    const [formData, setFormData] = useState({
        customerId: initialData?.customerId || "",
        invoiceNumber: initialData?.invoiceNumber || "",
        issueDate: initialData?.issueDate
            ? new Date(initialData.issueDate).toISOString().split('T')[0]
            : new Date().toISOString().split('T')[0],
        dueDate: initialData?.dueDate
            ? new Date(initialData.dueDate).toISOString().split('T')[0]
            : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        notes: initialData?.notes || "",
        items: initialData?.items?.map(i => ({
            ...i,
            id: i.id || Date.now() + Math.random(),
            quantity: Number(i.quantity),
            unitPrice: Number(i.unitPrice)
        })) || [{ id: Date.now(), description: "", quantity: 1, unitPrice: 0 as any }]
    });

    const activeCustomer = customers.find(c => c.id === formData.customerId);
    const currency = activeCustomer?.currency || 'KES';

    const subtotal = formData.items.reduce((sum, item) =>
        sum + (Number(item.quantity) * Number(item.unitPrice)), 0);

    const handleAddItem = () => {
        setFormData(prev => ({
            ...prev,
            items: [...prev.items, { id: Date.now(), description: "", quantity: 1, unitPrice: 0 as any }]
        }));
    };

    const handleRemoveItem = (id: number | string) => {
        if (formData.items.length === 1) return;
        setFormData(prev => ({ ...prev, items: prev.items.filter(item => item.id !== id) }));
    };

    const handleItemChange = (id: number | string, field: string, value: any) => {
        setFormData(prev => ({
            ...prev,
            items: prev.items.map(item => item.id === id ? { ...item, [field]: value } : item)
        }));
    };

    const handleDelete = async () => {
        if (!initialData?.id) return;
        setIsSubmitting(true);
        try {
            const res = await fetch(`/api/accounting/sales/${initialData.id}`, { method: "DELETE" });
            if (!res.ok) { const d = await res.json(); throw new Error(d.error || "Failed to delete"); }
            showToast("Invoice deleted successfully", "success");
            setIsDeleteOpen(false);
            router.push("/dashboard/accounting/sales");
            router.refresh();
        } catch (error: any) {
            showToast(error.message, "error");
            setIsSubmitting(false);
        }
    };

    const handleSubmit = async (status: 'DRAFT' | 'SENT') => {
        if (!formData.customerId) { showToast("Please select a customer", "error"); return; }
        if (formData.items.some(i => !i.description || Number(i.unitPrice) <= 0)) {
            showToast("Please complete all line items", "error"); return;
        }
        setIsSubmitting(true);
        try {
            const url = initialData?.id ? `/api/accounting/sales/${initialData.id}` : "/api/accounting/sales";
            const res = await fetch(url, {
                method: initialData?.id ? "PATCH" : "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ...formData, status })
            });
            if (!res.ok) { const d = await res.json(); throw new Error(d.error || "Failed to save sale"); }
            showToast(
                initialData
                    ? "Invoice updated successfully"
                    : (status === 'SENT' ? "Invoice saved and posted!" : "Draft saved successfully"),
                "success"
            );
            router.push("/dashboard/accounting/sales");
            router.refresh();
        } catch (error: any) {
            showToast(error.message, "error");
        } finally {
            setIsSubmitting(false);
        }
    };

    // Delete confirmation modal
    const deleteModal = (mounted && isDeleteOpen) ? createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/30" onClick={() => !isSubmitting && setIsDeleteOpen(false)} />
            <div className="relative bg-white w-full max-w-sm rounded-[12px] overflow-hidden"
                style={{ border: '1px solid rgba(0,0,0,0.09)', boxShadow: '0 8px 40px rgba(0,0,0,0.12)' }}>
                <div className="px-6 py-5">
                    <div className="w-10 h-10 rounded-[8px] bg-rose-50 flex items-center justify-center mb-4"
                        style={{ border: '1px solid rgba(239,68,68,0.2)' }}>
                        <PiWarning className="text-rose-500 text-[18px]" />
                    </div>
                    <h3 className="text-[14px] font-[600] text-gray-900 mb-1">Delete Invoice?</h3>
                    <p className="text-[12.5px] text-gray-500 leading-relaxed">
                        Permanently delete invoice <strong className="text-gray-700">{formData.invoiceNumber || 'this invoice'}</strong>?
                        This will remove all associated ledger entries and cannot be undone.
                    </p>
                </div>
                <div className="px-6 py-4 flex gap-3" style={{ borderTop: '1px solid rgba(0,0,0,0.07)' }}>
                    <button onClick={() => setIsDeleteOpen(false)} disabled={isSubmitting}
                        className="flex-1 px-4 py-2 rounded-[6px] text-[12.5px] font-[500] text-gray-600 bg-white hover:bg-gray-50 transition-colors"
                        style={CARD_STYLE}>
                        Cancel
                    </button>
                    <button onClick={handleDelete} disabled={isSubmitting}
                        className="flex-1 px-4 py-2 rounded-[6px] text-[12.5px] font-[500] text-white bg-rose-500 hover:bg-rose-600 transition-colors disabled:opacity-60">
                        {isSubmitting ? 'Deleting...' : 'Delete Invoice'}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    ) : null;

    return (
        <>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Main Form */}
                <div className="lg:col-span-2 space-y-5">
                    {/* Invoice Details card */}
                    <div className="bg-white rounded-[8px] overflow-hidden" style={CARD_STYLE}>
                        <div className="px-6 py-4" style={{ borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
                            <h2 className="text-[13px] font-[600] text-gray-900">Invoice Details</h2>
                            <p className="text-[11.5px] text-gray-400 mt-0.5">Customer and billing information</p>
                        </div>

                        <div className="p-6 space-y-5">
                            {/* Customer */}
                            <div>
                                <label className={LABEL_CLS}>Customer <span className="text-rose-400">*</span></label>
                                <CustomSelect
                                    value={formData.customerId}
                                    onChange={val => setFormData(p => ({ ...p, customerId: val }))}
                                    options={customers.map(c => ({ value: c.id, label: `${c.name} (${c.currency})` }))}
                                    placeholder="Select a customer…"
                                    className={INPUT_CLS}
                                    style={INPUT_STYLE}
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {/* Invoice # */}
                                <div>
                                    <label className={LABEL_CLS}>Invoice Number</label>
                                    <div>
                                        <input
                                            type="text"
                                            placeholder="Auto-generated"
                                            value={formData.invoiceNumber}
                                            onChange={e => setFormData(p => ({ ...p, invoiceNumber: e.target.value }))}
                                            className={INPUT_CLS + " pl-3 font-mono"}
                                            style={INPUT_STYLE}
                                        />
                                    </div>
                                </div>

                                {/* Issue Date */}
                                <div>
                                    <label className={LABEL_CLS}>Issue Date</label>
                                    <div>
                                        <input
                                            type="date"
                                            value={formData.issueDate}
                                            onChange={e => setFormData(p => ({ ...p, issueDate: e.target.value }))}
                                            className={INPUT_CLS + " pl-3"}
                                            style={INPUT_STYLE}
                                        />
                                    </div>
                                </div>

                                {/* Due Date */}
                                <div>
                                    <label className={LABEL_CLS}>Due Date</label>
                                    <div>
                                        <input
                                            type="date"
                                            value={formData.dueDate}
                                            onChange={e => setFormData(p => ({ ...p, dueDate: e.target.value }))}
                                            className={INPUT_CLS + " pl-3"}
                                            style={INPUT_STYLE}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Line Items card */}
                    <div className="bg-white rounded-[8px] overflow-hidden" style={CARD_STYLE}>
                        <div className="px-6 py-4 flex items-center justify-between"
                            style={{ borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
                            <div>
                                <h2 className="text-[13px] font-[600] text-gray-900">Line Items</h2>
                                <p className="text-[11.5px] text-gray-400 mt-0.5">{formData.items.length} item{formData.items.length !== 1 ? 's' : ''}</p>
                            </div>
                            <button onClick={handleAddItem}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] text-[12px] font-[500] text-[#6366F1] bg-indigo-50 hover:bg-indigo-100 transition-colors">
                                <PiPlus className="text-[13px]" /> Add Item
                            </button>
                        </div>

                        <div className="p-6 space-y-3">
                            {/* Column labels */}
                            <div className="hidden md:grid grid-cols-12 gap-3 px-1">
                                <span className="col-span-6 text-[10.5px] font-[500] text-gray-400 uppercase tracking-[0.06em]">Description</span>
                                <span className="col-span-2 text-[10.5px] font-[500] text-gray-400 uppercase tracking-[0.06em] text-center">Qty</span>
                                <span className="col-span-3 text-[10.5px] font-[500] text-gray-400 uppercase tracking-[0.06em] text-right">Unit Price</span>
                            </div>

                            {formData.items.map((item, idx) => (
                                <div key={item.id}
                                    className="flex flex-col md:grid md:grid-cols-12 gap-3 items-start md:items-center p-3 rounded-[8px]"
                                    style={idx % 2 === 0 ? { background: '#FAFAFA', border: '1px solid rgba(0,0,0,0.06)' } : CARD_STYLE}>
                                    {/* Description */}
                                    <div className="col-span-6 w-full">
                                        <input
                                            type="text"
                                            placeholder="Item description…"
                                            value={item.description}
                                            onChange={e => handleItemChange(item.id, 'description', e.target.value)}
                                            className={INPUT_CLS}
                                            style={INPUT_STYLE}
                                        />
                                    </div>
                                    {/* Qty */}
                                    <div className="col-span-2 w-full">
                                        <input
                                            type="number"
                                            min="1"
                                            placeholder="1"
                                            value={item.quantity || ""}
                                            onChange={e => handleItemChange(item.id, 'quantity', e.target.value ? parseInt(e.target.value) : "")}
                                            className={INPUT_CLS + " text-center"}
                                            style={INPUT_STYLE}
                                        />
                                    </div>
                                    {/* Unit Price */}
                                    <div className="col-span-3 w-full">
                                        <input
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            placeholder="0.00"
                                            value={item.unitPrice || ""}
                                            onChange={e => handleItemChange(item.id, 'unitPrice', e.target.value ? parseFloat(e.target.value) : "")}
                                            className={INPUT_CLS + " text-right font-mono"}
                                            style={INPUT_STYLE}
                                        />
                                    </div>
                                    {/* Remove */}
                                    <div className="col-span-1 flex justify-end">
                                        <button
                                            onClick={() => handleRemoveItem(item.id)}
                                            disabled={formData.items.length === 1}
                                            className="p-1.5 rounded-[6px] text-gray-300 hover:text-rose-500 hover:bg-rose-50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                            style={{ border: '1px solid rgba(0,0,0,0.07)' }}>
                                            <PiTrash className="text-[13px]" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Notes card */}
                    <div className="bg-white rounded-[8px] overflow-hidden" style={CARD_STYLE}>
                        <div className="px-6 py-4" style={{ borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
                            <h2 className="text-[13px] font-[600] text-gray-900">Notes / Terms</h2>
                        </div>
                        <div className="p-6">
                            <textarea
                                rows={4}
                                placeholder="Payment terms, delivery notes, special instructions…"
                                value={formData.notes}
                                onChange={e => setFormData(p => ({ ...p, notes: e.target.value }))}
                                className="w-full rounded-[6px] px-3 py-3 text-[13px] text-gray-900 placeholder:text-gray-300 outline-none focus:ring-1 focus:ring-[#6366F1] transition-colors bg-white resize-none"
                                style={INPUT_STYLE}
                            />
                        </div>
                    </div>
                </div>

                {/* Sidebar Summary */}
                <div className="lg:col-span-1">
                    <div className="bg-white rounded-[8px] p-5 sticky top-6" style={CARD_STYLE}>
                        <p className="text-[10.5px] font-[500] text-gray-400 uppercase tracking-[0.07em] mb-4 pb-3"
                            style={{ borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
                            Summary
                        </p>

                        {/* Totals */}
                        <div className="space-y-2.5 mb-5">
                            <div className="flex justify-between text-[12.5px]">
                                <span className="text-gray-400">Subtotal</span>
                                <span className="font-mono font-[600] text-gray-700 tabular-nums">
                                    {currency} {subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                </span>
                            </div>
                            <div className="flex justify-between text-[12.5px]">
                                <span className="text-gray-400">Tax (0%)</span>
                                <span className="font-mono font-[600] text-gray-400 tabular-nums">{currency} 0.00</span>
                            </div>
                            <div className="flex justify-between text-[14px] font-[600] pt-3"
                                style={{ borderTop: '1px solid rgba(0,0,0,0.07)' }}>
                                <span className="text-gray-900">Total</span>
                                <span className="font-mono text-[#6366F1] tabular-nums">
                                    {currency} {subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                </span>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="space-y-2.5">
                            <button
                                onClick={() => handleSubmit('SENT')}
                                disabled={isSubmitting}
                                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-[6px] text-[12.5px] font-[500] text-white bg-[#6366F1] hover:bg-indigo-600 transition-colors disabled:opacity-60">
                                {isSubmitting
                                    ? <PiSpinner className="animate-spin text-[14px]" />
                                    : (initialData ? <PiFloppyDisk className="text-[14px]" /> : <PiPaperPlaneRight className="text-[14px]" />)
                                }
                                {initialData ? "Update Invoice" : "Save & Post to Ledger"}
                            </button>

                            <button
                                onClick={() => handleSubmit('DRAFT')}
                                disabled={isSubmitting}
                                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-[6px] text-[12.5px] font-[500] text-gray-600 bg-white hover:bg-gray-50 transition-colors disabled:opacity-60"
                                style={CARD_STYLE}>
                                <PiFloppyDisk className="text-[14px]" /> Save as Draft
                            </button>

                            {initialData && (
                                <button
                                    onClick={() => setIsDeleteOpen(true)}
                                    disabled={isSubmitting}
                                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-[6px] text-[12.5px] font-[500] text-rose-500 bg-white hover:bg-rose-50 transition-colors disabled:opacity-60"
                                    style={{ border: '1px solid rgba(239,68,68,0.15)' }}>
                                    <PiTrash className="text-[14px]" /> Delete Invoice
                                </button>
                            )}
                        </div>

                        {/* Customer info pill */}
                        {activeCustomer && (
                            <div className="mt-5 pt-4" style={{ borderTop: '1px solid rgba(0,0,0,0.07)' }}>
                                <p className="text-[10.5px] font-[500] text-gray-400 uppercase tracking-[0.06em] mb-2">Billing To</p>
                                <div className="flex items-center gap-2">
                                    <div className="w-7 h-7 rounded-[6px] bg-indigo-50 flex items-center justify-center shrink-0">
                                        <PiUser className="text-[#6366F1] text-[12px]" />
                                    </div>
                                    <div>
                                        <p className="text-[12.5px] font-[500] text-gray-900">{activeCustomer.name}</p>
                                        <p className="text-[11px] text-gray-400">{activeCustomer.currency}</p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {deleteModal}
        </>
    );
}
