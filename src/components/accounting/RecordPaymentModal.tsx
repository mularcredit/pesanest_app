"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/ToastProvider";
import {
    PiCurrencyDollar,
    PiReceipt,
    PiSpinner,
    PiCheckCircle,
    PiBank,
    PiMoney,
    PiDeviceMobile,
    PiCreditCard,
    PiWallet
} from "react-icons/pi";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { FormModal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select"; // Assuming this exists or I should use standard select
import { DatePicker } from "@/components/ui/DatePicker";
import { format, parseISO } from "date-fns";

interface Sale {
    id: string;
    invoiceNumber: string;
    totalAmount: number;
    issueDate: Date;
    status: string;
}

interface RecordPaymentModalProps {
    isOpen: boolean;
    onClose: () => void;
    customerId: string;
    customerName: string;
    currency: string;
    sales?: Sale[];
}

const PAYMENT_METHODS = [
    { value: "CASH", label: "Cash", icon: PiMoney },
    { value: "BANK_TRANSFER", label: "Bank Transfer", icon: PiBank },
    { value: "CHEQUE", label: "Cheque", icon: PiReceipt },
    { value: "MOBILE_MONEY", label: "Mobile Money", icon: PiDeviceMobile },
    { value: "CARD", label: "Card Payment", icon: PiCreditCard },
];

export function RecordPaymentModal({
    isOpen,
    onClose,
    customerId,
    customerName,
    currency,
    sales = []
}: RecordPaymentModalProps) {
    const router = useRouter();
    const { showToast } = useToast();
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Initial State
    const [formData, setFormData] = useState({
        amount: "",
        paymentDate: new Date().toISOString().split('T')[0],
        method: "BANK_TRANSFER",
        reference: "",
        saleId: "",
        notes: ""
    });

    // Reset form when modal opens/closes
    useEffect(() => {
        if (isOpen) {
            setFormData(prev => ({
                ...prev,
                paymentDate: new Date().toISOString().split('T')[0]
            }));
        }
    }, [isOpen]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.amount || parseFloat(formData.amount) <= 0) {
            showToast("Please enter a valid payment amount", "error");
            return;
        }

        setIsSubmitting(true);

        try {
            const res = await fetch("/api/accounting/payments", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    customerId,
                    amount: parseFloat(formData.amount),
                    paymentDate: new Date(formData.paymentDate),
                    method: formData.method,
                    reference: formData.reference || undefined,
                    saleId: formData.saleId || undefined,
                    notes: formData.notes || undefined
                })
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || "Failed to record payment");
            }

            showToast("Payment recorded successfully!", "success");
            router.refresh();
            onClose();

            // Reset
            setFormData({
                amount: "",
                paymentDate: new Date().toISOString().split('T')[0],
                method: "BANK_TRANSFER",
                reference: "",
                saleId: "",
                notes: ""
            });

        } catch (error: any) {
            showToast(error.message, "error");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <FormModal
            isOpen={isOpen}
            onClose={onClose}
            title="Record Payment"
            subtitle={`Receive payment from ${customerName}`}
            icon={<img src="/pos-terminal.png" alt="Payment" className="w-10 h-10 object-contain" />}
            maxWidth="3xl"
            hideIconBackground
        >
            <form onSubmit={handleSubmit} className="flex flex-col h-full">
                <div className="p-8 space-y-8 flex-1 overflow-y-auto">

                    <div className="space-y-2">
                        <label className="block text-[11px] font-semibold text-gray-500 pl-1 mb-1.5">Amount received</label>
                        <Input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="0.00"
                            value={formData.amount}
                            onChange={e => setFormData({ ...formData, amount: e.target.value })}
                            required
                            className="bg-white border-gray-200 rounded-[5px] h-11 shadow-none focus-visible:ring-1 focus-visible:ring-[#6366F1]/10 focus-visible:border-gray-300"
                            autoFocus
                        />
                    </div>

                    {/* Sales Allocation (if sales exist) */}
                    {sales.length > 0 && (
                        <div className="space-y-2">
                            <label className="block text-[11px] font-semibold text-gray-500 pl-1 mb-1.5">Allocate to invoice (optional)</label>
                            <Select
                                value={formData.saleId}
                                onChange={val => setFormData({ ...formData, saleId: val })}
                                options={[
                                    { value: "", label: "Unallocated (Credit to Account)" },
                                    ...sales.map(sale => ({
                                        value: sale.id,
                                        label: `Inv #${sale.invoiceNumber} — ${currency} ${sale.totalAmount.toLocaleString()} (${new Date(sale.issueDate).toLocaleDateString()})`
                                    }))
                                ]}
                                className="w-full"
                            />
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Method Selection */}
                        <div className="space-y-3 col-span-2">
                            <label className="block text-[11px] font-semibold text-gray-500 pl-1 mb-1.5">Payment method</label>
                            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                                {PAYMENT_METHODS.map((method) => {
                                    const Icon = method.icon;
                                    const isSelected = formData.method === method.value;
                                    return (
                                        <button
                                            key={method.value}
                                            type="button"
                                            onClick={() => setFormData({ ...formData, method: method.value })}
                                            className={cn(
                                                "flex flex-col items-center justify-center p-3 rounded-[5px] border transition-all duration-300 gap-2 h-20",
                                                isSelected
                                                    ? "border-[#6366F1] bg-indigo-50/50 text-[#6366F1] shadow-sm"
                                                    : "border-gray-200 bg-white hover:border-indigo-200 text-gray-400 hover:text-indigo-600"
                                            )}
                                        >
                                            {method.value === "CASH" ? (
                                                <img src="/money.png" alt="Cash" className="w-8 h-8 object-contain" />
                                            ) : (
                                                <Icon className="text-xl" />
                                            )}
                                            <span className="text-[10px] font-semibold">{method.label}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="block text-[11px] font-semibold text-gray-500 pl-1 mb-1.5">Payment date</label>
                            <div className="w-full">
                                <DatePicker
                                    value={formData.paymentDate ? parseISO(formData.paymentDate) : undefined}
                                    onChange={(d) => setFormData({ ...formData, paymentDate: format(d, 'yyyy-MM-dd') })}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="block text-[11px] font-semibold text-gray-500 pl-1 mb-1.5">
                                Reference / transaction ID <span className="text-gray-400 font-normal">(optional)</span>
                            </label>
                            <Input
                                placeholder="e.g. TXN-88392, Check #123"
                                value={formData.reference}
                                onChange={e => setFormData({ ...formData, reference: e.target.value })}
                                className="bg-white border-gray-200 rounded-[5px] h-11 shadow-none"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="block text-[11px] font-semibold text-gray-500 pl-1 mb-1.5">Internal notes</label>
                        <textarea
                            className="w-full px-4 py-3 bg-white border border-gray-200 rounded-[5px] text-sm font-medium text-gray-900 placeholder:text-gray-300 focus:outline-none focus:ring-1 focus:ring-[#6366F1] transition-all resize-none h-24 shadow-none"
                            placeholder="Add any additional details about this payment..."
                            value={formData.notes}
                            onChange={e => setFormData({ ...formData, notes: e.target.value })}
                        />
                    </div>
                </div>

                {/* Header-like Footer */}
                <div className="h-[80px] px-8 bg-white border-t border-gray-100 flex items-center justify-end gap-3 shrink-0">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isSubmitting}
                        className="px-6 py-2.5 rounded-[5px] text-xs font-semibold text-gray-500 hover:bg-gray-50 transition-all border border-gray-200"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="px-8 py-2.5 rounded-[5px] bg-[#6366F1] text-white text-xs font-semibold hover:bg-[#6366F1]/90 transition-all shadow-lg shadow-[#6366F1]/20 min-w-[160px] flex items-center justify-center gap-2"
                    >
                        {isSubmitting ? (
                            <>
                                <PiSpinner className="animate-spin text-lg" />
                                <span>Recording...</span>
                            </>
                        ) : "Record Payment"}
                    </button>
                </div>
            </form>
        </FormModal>
    );
}
