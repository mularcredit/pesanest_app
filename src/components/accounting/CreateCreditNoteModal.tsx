"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/ToastProvider";
import {
    PiReceipt,
    PiSpinner,
    PiWarningCircle,
    PiArrowRight,
    PiCheckCircle
} from "react-icons/pi";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { FormModal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { DatePicker } from "@/components/ui/DatePicker";
import { format } from "date-fns";

interface Sale {
    id: string;
    invoiceNumber: string;
    totalAmount: number;
    issueDate: Date;
    status: string;
}

interface CreateCreditNoteModalProps {
    isOpen: boolean;
    onClose: () => void;
    customerId: string;
    customerName: string;
    currency: string;
    sales?: Sale[];
}

export function CreateCreditNoteModal({
    isOpen,
    onClose,
    customerId,
    customerName,
    currency,
    sales = []
}: CreateCreditNoteModalProps) {
    const router = useRouter();
    const { showToast } = useToast();

    // State
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [step, setStep] = useState<'form' | 'confirm' | 'success'>('form');
    const [createdId, setCreatedId] = useState<string | null>(null);
    const [createdCNNumber, setCreatedCNNumber] = useState<string | null>(null);

    // Initial State
    const [formData, setFormData] = useState({
        amount: "",
        invoiceRef: "",
        reason: "",
        saleId: "",
        cnNumber: "",
        date: new Date().toISOString().split('T')[0]
    });

    // Reset form when modal opens
    useEffect(() => {
        if (isOpen) {
            setStep('form');
            setFormData({
                amount: "",
                invoiceRef: "",
                reason: "",
                saleId: "",
                cnNumber: "",
                date: new Date().toISOString().split('T')[0]
            });
            setCreatedId(null);
            setCreatedCNNumber(null);
        }
    }, [isOpen]);

    // Auto-fill invoice reference when sale is selected
    useEffect(() => {
        if (formData.saleId) {
            const selectedSale = sales.find(s => s.id === formData.saleId);
            if (selectedSale) {
                setFormData(prev => ({
                    ...prev,
                    invoiceRef: selectedSale.invoiceNumber,
                    amount: prev.amount || selectedSale.totalAmount.toString()
                }));
            }
        }
    }, [formData.saleId, sales]);

    const handleFormSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.amount || parseFloat(formData.amount) <= 0) {
            showToast("Please enter a valid credit note amount", "error");
            return;
        }

        if (!formData.invoiceRef) {
            showToast("Please enter an invoice reference", "error");
            return;
        }

        if (!formData.reason) {
            showToast("Please provide a reason for the credit note", "error");
            return;
        }

        setStep('confirm');
    };

    const handleConfirmSubmit = async () => {
        setIsSubmitting(true);

        try {
            const res = await fetch("/api/accounting/credit-notes", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    customerId,
                    amount: parseFloat(formData.amount),
                    invoiceRef: formData.invoiceRef,
                    reason: formData.reason,
                    saleId: formData.saleId || undefined,
                    cnNumber: formData.cnNumber || undefined,
                    date: formData.date
                })
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || "Failed to create credit note");
            }

            const creditNote = await res.json();
            setCreatedId(creditNote.id);
            setCreatedCNNumber(creditNote.cnNumber);
            setStep('success');
            showToast(`Credit Note ${creditNote.cnNumber} created successfully!`, "success");
            router.refresh();

        } catch (error: any) {
            showToast(error.message, "error");
            setStep('form');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleOpenInStudio = (type: 'CREDIT_NOTE' | 'RECEIPT') => {
        if (!createdId) return;

        const params = new URLSearchParams();
        params.set('type', type);
        params.set('id', createdId);
        params.set('customerId', customerId);

        // Pass known data to pre-fill 
        params.set('cnNumber', createdCNNumber || '');
        params.set('amount', formData.amount);
        params.set('customerName', customerName);
        params.set('reason', formData.reason);
        params.set('invoiceRef', formData.invoiceRef);
        params.set('date', formData.date || new Date().toISOString());

        // For receipt mode, map credit note fields
        if (type === 'RECEIPT') {
            params.set('paymentMethod', 'Credit Note');
            params.set('transactionRef', createdCNNumber || '');
            params.set('receivedFrom', customerName);
            params.set('originalAmount', formData.amount);
        }

        router.push(`/finance-studio?${params.toString()}`);
    };

    const handleClose = () => {
        setStep('form');
        setFormData({
            amount: "",
            invoiceRef: "",
            reason: "",
            saleId: "",
            cnNumber: "",
            date: new Date().toISOString().split('T')[0]
        });
        setCreatedId(null);
        setCreatedCNNumber(null);
        onClose();
    };

    // RENDER: SUCCESS STEP
    if (step === 'success') {
        return (
            <FormModal
                isOpen={isOpen}
                onClose={handleClose}
                title="Credit Note Created"
                subtitle="What would you like to do next?"
                icon={<PiCheckCircle className="text-2xl text-emerald-600" />}
                maxWidth="lg"
            >
                <div className="p-6 space-y-6">
                    <div className="bg-emerald-50 rounded-lg p-4 border border-emerald-100 flex items-start gap-3">
                        <PiCheckCircle className="text-xl text-emerald-600 mt-0.5 shrink-0" />
                        <div>
                            <p className="text-sm font-semibold text-emerald-900">Successfully Created {createdCNNumber}</p>
                            <p className="text-xs text-emerald-700 mt-1">
                                The credit note has been saved and posted to the General Ledger.
                                <br />Customer balance has been updated.
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-3">


                        <button
                            onClick={() => handleOpenInStudio('RECEIPT')}
                            className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-xl hover:border-emerald-500 hover:shadow-md transition-all group"
                        >
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center group-hover:bg-emerald-600 transition-colors">
                                    <PiReceipt className="text-xl text-emerald-600 group-hover:text-white" />
                                </div>
                                <div className="text-left">
                                    <p className="text-sm font-semibold text-gray-900">Create Receipt</p>
                                    <p className="text-xs text-gray-500">Generate a receipt for this credit application</p>
                                </div>
                            </div>
                            <PiArrowRight className="text-gray-400 group-hover:text-emerald-600" />
                        </button>
                    </div>

                    <div className="flex justify-end pt-4 border-t border-gray-100">
                        <Button onClick={handleClose} variant="outline">
                            Close
                        </Button>
                    </div>
                </div>
            </FormModal>
        );
    }

    // RENDER: CONFIRM STEP
    if (step === 'confirm') {
        return (
            <FormModal
                isOpen={isOpen}
                onClose={() => setStep('form')}
                title="Confirm Credit Note"
                subtitle="Please review details before submission"
                icon={<PiWarningCircle className="text-2xl text-amber-600" />}
                maxWidth="md"
            >
                <div className="p-6 space-y-6">
                    <div className="bg-amber-50 rounded-lg p-4 border border-amber-100">
                        <p className="text-xs text-amber-800 font-medium flex items-center gap-2">
                            <PiWarningCircle className="text-lg" />
                            Once created, credit notes cannot be edited, only voided.
                        </p>
                    </div>

                    <div className="space-y-4 bg-gray-50 p-4 rounded-xl border border-gray-100">
                        <div className="grid grid-cols-2 gap-y-4 gap-x-2 text-sm">
                            <div className="space-y-1">
                                <p className="text-[10px] uppercase font-semibold text-gray-400">Customer</p>
                                <p className="font-semibold text-gray-900">{customerName}</p>
                            </div>
                            <div className="space-y-1">
                                <p className="text-[10px] uppercase font-semibold text-gray-400">Amount</p>
                                <p className="font-semibold text-gray-900 text-lg font-mono">{currency} {parseFloat(formData.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                            </div>
                            <div className="space-y-1">
                                <p className="text-[10px] uppercase font-semibold text-gray-400">Credit Note No.</p>
                                <p className="font-semibold text-gray-900">{formData.cnNumber || "(Auto-generated)"}</p>
                            </div>
                            <div className="space-y-1 col-span-2">
                                <p className="text-[10px] uppercase font-semibold text-gray-400">Invoice Reference</p>
                                <p className="font-medium text-gray-900">{formData.invoiceRef}</p>
                            </div>
                            <div className="space-y-1 col-span-2">
                                <p className="text-[10px] uppercase font-semibold text-gray-400">Reason</p>
                                <p className="font-medium text-gray-900 italic">"{formData.reason}"</p>
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-6 border-t border-gray-100">
                        <Button variant="outline" onClick={() => setStep('form')}>
                            Back to Edit
                        </Button>
                        <Button
                            onClick={handleConfirmSubmit}
                            disabled={isSubmitting}
                            className="bg-amber-500 hover:bg-amber-600 text-white min-w-[140px]"
                        >
                            {isSubmitting ? <PiSpinner className="animate-spin text-lg" /> : "Confirm & Create"}
                        </Button>
                    </div>
                </div>
            </FormModal>
        );
    }

    // RENDER: FORM STEP
    return (
        <FormModal
            isOpen={isOpen}
            onClose={onClose}
            title="Create Credit Note"
            subtitle={`Issue a credit note for ${customerName}`}
            icon={<img src="/pos.png" alt="Credit Note" className="w-10 h-10 object-contain" />}
            maxWidth="2xl"
            hideIconBackground
        >
            <form onSubmit={handleFormSubmit} className="flex flex-col h-full">
                <div className="p-8 space-y-6 flex-1 overflow-y-auto">

                    {/* Sales Selection (if sales exist) */}
                    {sales.length > 0 && (
                        <div className="space-y-2">
                            <label className="block text-[11px] font-semibold text-gray-500 pl-1 mb-1.5">Against invoice (optional)</label>
                            <Select
                                value={formData.saleId}
                                onChange={val => setFormData({ ...formData, saleId: val })}
                                options={[
                                    { value: "", label: "Select an invoice..." },
                                    ...sales.map(sale => ({
                                        value: sale.id,
                                        label: `Inv #${sale.invoiceNumber} — ${currency} ${sale.totalAmount.toLocaleString()} (${new Date(sale.issueDate).toLocaleDateString()})`
                                    }))
                                ]}
                                className="w-full"
                            />
                        </div>
                    )}

                    <div className="space-y-2">
                        <label className="block text-[11px] font-semibold text-gray-500 pl-1 mb-1.5">Date</label>
                        <DatePicker
                            value={formData.date ? new Date(formData.date) : undefined}
                            onChange={(date) => setFormData({ ...formData, date: format(date, 'yyyy-MM-dd') })}
                            placeholder="Select date"
                            className="w-full"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="block text-[11px] font-semibold text-gray-500 pl-1 mb-1.5">
                            Invoice reference
                            {formData.saleId && <span className="text-[10px] text-indigo-600 ml-2">(auto-filled from selected invoice)</span>}
                        </label>
                        <Input
                            placeholder={formData.saleId ? "Auto-filled from invoice" : "e.g. INV-001"}
                            value={formData.invoiceRef}
                            onChange={e => setFormData({ ...formData, invoiceRef: e.target.value })}
                            required
                            disabled={!!formData.saleId}
                            className={`border-gray-200 rounded-[5px] h-11 shadow-none focus-visible:ring-1 focus-visible:ring-[#6366F1]/10 focus-visible:border-gray-300 ${formData.saleId ? 'bg-gray-50 cursor-not-allowed' : 'bg-white'
                                }`}
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="block text-[11px] font-semibold text-gray-500 pl-1 mb-1.5">Credit note no. (optional)</label>
                        <Input
                            placeholder="e.g. CN-001 (Leave blank to auto-generate)"
                            value={formData.cnNumber}
                            onChange={e => setFormData({ ...formData, cnNumber: e.target.value })}
                            className="bg-white border-gray-200 rounded-[5px] h-11 shadow-none focus-visible:ring-1 focus-visible:ring-[#6366F1]/10 focus-visible:border-gray-300"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="block text-[11px] font-semibold text-gray-500 pl-1 mb-1.5">Credit amount</label>
                        <Input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="0.00"
                            value={formData.amount}
                            onChange={e => setFormData({ ...formData, amount: e.target.value })}
                            required
                            className="bg-white border-gray-200 rounded-[5px] h-11 shadow-none focus-visible:ring-1 focus-visible:ring-[#6366F1]/10 focus-visible:border-gray-300"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="block text-[11px] font-semibold text-gray-500 pl-1 mb-1.5">Reason for credit note</label>
                        <textarea
                            className="w-full px-4 py-3 bg-white border border-gray-200 rounded-[5px] text-sm font-medium text-gray-900 placeholder:text-gray-300 focus:outline-none focus:ring-1 focus:ring-[#6366F1] transition-all resize-none h-24 shadow-none"
                            placeholder="e.g. Product return, pricing error, damaged goods..."
                            value={formData.reason}
                            onChange={e => setFormData({ ...formData, reason: e.target.value })}
                            required
                        />
                    </div>

                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                        <div className="flex gap-3">
                            <PiReceipt className="text-amber-600 text-xl shrink-0 mt-0.5" />
                            <div className="text-xs text-amber-800">
                                <p className="font-semibold mb-1">About Credit Notes</p>
                                <p className="text-amber-700">
                                    A credit note reduces the customer's outstanding balance and will be posted to the General Ledger.
                                    This transaction cannot be reversed once created (only voided).
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="h-[80px] px-8 bg-white border-t border-gray-100 flex items-center justify-end gap-3 shrink-0">
                    <button
                        type="button"
                        onClick={handleClose}
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
                        Review Credit Note
                    </button>
                </div>
            </form>
        </FormModal>
    );
}
