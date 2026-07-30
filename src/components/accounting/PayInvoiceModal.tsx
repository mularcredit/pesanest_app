"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { PiX, PiCurrencyDollar, PiBank, PiCheckCircle, PiWarningCircle } from "react-icons/pi";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/ToastProvider";
import { DatePicker } from "@/components/ui/DatePicker";
import { format, parseISO } from "date-fns";
import { CustomSelect } from "@/components/ui/CustomSelect";

interface PayInvoiceModalProps {
    invoice: {
        id: string;
        invoiceNumber: string;
        amount: number;
        currency: string;
        vendor: {
            name: string;
            bankName?: string | null;
            bankAccount?: string | null;
        };
    };
    onClose: () => void;
}

const INPUT_CLASS = "w-full rounded-[6px] px-3 py-[10px] text-[13px] text-gray-900 placeholder:text-gray-300 outline-none focus:ring-1 focus:ring-[#6366F1] transition-colors bg-white";
const INPUT_STYLE: React.CSSProperties = { border: '1px solid rgba(0,0,0,0.09)' };
const LABEL_CLASS = "block text-[11.5px] font-[500] text-gray-400 mb-1.5";

function fmtAmt(amount: number, currency: string) {
    return `${currency} ${amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
}

export function PayInvoiceModal({ invoice, onClose }: PayInvoiceModalProps) {
    const router = useRouter();
    const { showToast } = useToast();
    const [loading, setLoading]   = useState(false);
    const [mounted, setMounted]   = useState(false);
    const [formData, setFormData] = useState({
        amount: invoice.amount,
        paymentDate: new Date().toISOString().split('T')[0],
        method: 'BANK_TRANSFER',
        reference: '',
        notes: ''
    });

    useEffect(() => { setMounted(true); }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const response = await fetch(`/api/invoices/${invoice.id}/pay`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });
            if (!response.ok) throw new Error('Payment failed');
            showToast('Payment recorded successfully', 'success');
            router.refresh();
            onClose();
        } catch {
            showToast('Failed to record payment', 'error');
        } finally { setLoading(false); }
    };

    if (!mounted) return null;

    return createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
            {/* Overlay */}
            <div className="fixed inset-0 bg-black/30" onClick={onClose} />

            {/* Modal */}
            <div className="relative bg-white w-full max-w-lg rounded-[12px] flex flex-col max-h-[90vh] overflow-hidden"
                style={{ border: '1px solid rgba(0,0,0,0.09)', boxShadow: '0 8px 40px rgba(0,0,0,0.12)' }}>

                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 shrink-0"
                    style={{ borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-[7px] bg-emerald-50 flex items-center justify-center shrink-0">
                            <PiCurrencyDollar className="text-emerald-600 text-[15px]" />
                        </div>
                        <div>
                            <h3 className="text-[14px] font-[600] text-gray-900 leading-none">Record Payment</h3>
                            <p className="text-[12px] text-gray-400 mt-0.5">Invoice {invoice.invoiceNumber}</p>
                        </div>
                    </div>
                    <button onClick={onClose}
                        className="p-1.5 rounded-[6px] text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors">
                        <PiX className="text-[16px]" />
                    </button>
                </div>

                {/* Vendor info strip */}
                <div className="px-6 py-3 shrink-0" style={{ borderBottom: '1px solid rgba(0,0,0,0.07)', background: 'rgba(0,0,0,0.02)' }}>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <p className="text-[10.5px] font-[500] uppercase tracking-[0.07em] text-gray-400 mb-0.5">Payee</p>
                            <p className="text-[13px] font-[600] text-gray-900">{invoice.vendor.name}</p>
                        </div>
                        <div>
                            <p className="text-[10.5px] font-[500] uppercase tracking-[0.07em] text-gray-400 mb-0.5">Invoice amount</p>
                            <p className="text-[14px] font-[700] text-gray-900 tabular-nums">{fmtAmt(invoice.amount, invoice.currency)}</p>
                        </div>
                        {invoice.vendor.bankAccount && (
                            <>
                                <div>
                                    <p className="text-[10.5px] font-[500] uppercase tracking-[0.07em] text-gray-400 mb-0.5">Bank</p>
                                    <p className="text-[12.5px] text-gray-700">{invoice.vendor.bankName || '—'}</p>
                                </div>
                                <div>
                                    <p className="text-[10.5px] font-[500] uppercase tracking-[0.07em] text-gray-400 mb-0.5">Account</p>
                                    <p className="text-[12.5px] font-mono text-gray-700">{invoice.vendor.bankAccount}</p>
                                </div>
                            </>
                        )}
                    </div>
                </div>

                {/* Scrollable form */}
                <div className="overflow-y-auto flex-1">
                    <form id="pay-invoice-form" onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className={LABEL_CLASS}>Payment amount</label>
                                <div>
                                    <input type="number" step="0.01" required
                                        value={formData.amount}
                                        onChange={e => setFormData({ ...formData, amount: parseFloat(e.target.value) })}
                                        className={cn(INPUT_CLASS, 'pl-3 font-mono tabular-nums')}
                                        style={INPUT_STYLE} />
                                </div>
                            </div>
                            <div>
                                <label className={LABEL_CLASS}>Payment date</label>
                                <DatePicker
                                    value={formData.paymentDate ? parseISO(formData.paymentDate) : undefined}
                                    onChange={d => setFormData({ ...formData, paymentDate: format(d, 'yyyy-MM-dd') })}
                                    placeholder="Payment date"
                                />
                            </div>
                        </div>

                        <div>
                            <label className={LABEL_CLASS}>Payment method</label>
                            <CustomSelect
                                value={formData.method}
                                onChange={val => setFormData({ ...formData, method: val })}
                                options={[
                                    { value: "BANK_TRANSFER", label: "Bank Transfer" },
                                    { value: "CHECK", label: "Cheque" },
                                    { value: "CASH", label: "Cash" },
                                    { value: "MOBILE_MONEY", label: "Mobile Money" },
                                    { value: "WIRE", label: "Wire Transfer" },
                                ]}
                                className={INPUT_CLASS}
                                style={INPUT_STYLE}
                            />
                        </div>

                        <div>
                            <label className={LABEL_CLASS}>Reference / Transaction ID</label>
                            <input type="text" value={formData.reference}
                                onChange={e => setFormData({ ...formData, reference: e.target.value })}
                                placeholder="e.g. TXN-123456"
                                className={INPUT_CLASS} style={INPUT_STYLE} />
                        </div>

                        <div>
                            <label className={LABEL_CLASS}>Notes <span className="text-gray-300">(optional)</span></label>
                            <textarea rows={3} value={formData.notes}
                                onChange={e => setFormData({ ...formData, notes: e.target.value })}
                                placeholder="Add any additional payment details…"
                                className={cn(INPUT_CLASS, 'resize-none')} style={INPUT_STYLE} />
                        </div>

                        {formData.amount < invoice.amount && (
                            <div className="flex items-start gap-3 px-4 py-3 rounded-[6px] bg-amber-50"
                                style={{ border: '1px solid rgba(245,158,11,0.25)' }}>
                                <PiWarningCircle className="text-amber-500 text-[16px] shrink-0 mt-0.5" />
                                <div>
                                    <p className="text-[12.5px] font-[600] text-amber-800">Partial payment</p>
                                    <p className="text-[12px] text-amber-700 mt-0.5">
                                        Remaining balance: {fmtAmt(invoice.amount - formData.amount, invoice.currency)}
                                    </p>
                                </div>
                            </div>
                        )}

                        <div className="h-1" />
                    </form>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-2.5 px-6 py-4 shrink-0"
                    style={{ borderTop: '1px solid rgba(0,0,0,0.07)' }}>
                    <button type="button" onClick={onClose} disabled={loading}
                        className="px-4 py-2 rounded-[6px] text-[12.5px] font-[500] text-gray-500 hover:bg-gray-50 transition-colors disabled:opacity-50"
                        style={{ border: '1px solid rgba(0,0,0,0.09)' }}>
                        Cancel
                    </button>
                    <button type="submit" form="pay-invoice-form" disabled={loading}
                        className="flex items-center gap-2 px-5 py-2 rounded-[6px] text-[12.5px] font-[500] text-white bg-emerald-600 hover:bg-emerald-700 transition-colors disabled:opacity-50">
                        <PiCheckCircle className="text-[14px]" />
                        {loading ? 'Processing…' : 'Record Payment'}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}
