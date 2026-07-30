"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/ToastProvider";
import {
    PiReceipt,
    PiSpinner,
    PiXCircle,
    PiCheckCircle,
    PiClockCounterClockwise,
    PiFileText
} from "react-icons/pi";
import { format } from "date-fns";
import { FormModal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";

interface CreditNote {
    id: string;
    cnNumber: string;
    invoiceRef: string;
    amount: number;
    reason: string;
    status: string;
    createdAt: string;
}

interface ManageCreditNotesModalProps {
    isOpen: boolean;
    onClose: () => void;
    customerId: string;
    customerName: string;
}

export function ManageCreditNotesModal({
    isOpen,
    onClose,
    customerId,
    customerName
}: ManageCreditNotesModalProps) {
    const router = useRouter();
    const { showToast } = useToast();
    const [isLoading, setIsLoading] = useState(true);
    const [isVoiding, setIsVoiding] = useState<string | null>(null);
    const [creditNotes, setCreditNotes] = useState<CreditNote[]>([]);

    const fetchCreditNotes = async () => {
        setIsLoading(true);
        try {
            const res = await fetch(`/api/accounting/credit-notes?customerId=${customerId}`);
            if (!res.ok) throw new Error("Failed to fetch credit notes");
            const data = await res.json();
            setCreditNotes(data);
        } catch (error: any) {
            showToast(error.message, "error");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen) {
            fetchCreditNotes();
        }
    }, [isOpen, customerId]);

    const handleVoid = async (id: string, cnNumber: string) => {
        if (!confirm(`Are you sure you want to void Credit Note ${cnNumber}? This will reverse the accounting entries.`)) {
            return;
        }

        setIsVoiding(id);
        try {
            const res = await fetch(`/api/accounting/credit-notes`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id, reason: "User requested void" })
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || "Failed to void credit note");
            }

            showToast(`Credit Note ${cnNumber} voided successfully`, "success");
            fetchCreditNotes();
            router.refresh();
        } catch (error: any) {
            showToast(error.message, "error");
        } finally {
            setIsVoiding(null);
        }
    };

    return (
        <FormModal
            isOpen={isOpen}
            onClose={onClose}
            title="Manage Credit Notes"
            subtitle={`Credit history for ${customerName}`}
            icon={<PiClockCounterClockwise className="text-2xl text-amber-600" />}
            maxWidth="6xl"
        >
            <div className="p-6">
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-3">
                        <PiSpinner className="animate-spin text-3xl text-amber-500" />
                        <p className="text-sm text-gray-400 font-medium">Loading history...</p>
                    </div>
                ) : creditNotes.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-4 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                        <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm">
                            <PiReceipt className="text-3xl text-gray-300" />
                        </div>
                        <div className="text-center">
                            <p className="text-gray-900 font-semibold">No credit notes found</p>
                            <p className="text-sm text-gray-400">Any credit notes issued to this customer will appear here.</p>
                        </div>
                    </div>
                ) : (
                    <div className="overflow-x-auto rounded-xl border border-gray-100 bg-white">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50/50 border-b border-gray-100">
                                <tr>
                                    <th className="py-4 px-6 text-left font-semibold text-gray-400 text-[10px]">DATE</th>
                                    <th className="py-4 px-6 text-left font-semibold text-gray-400 text-[10px]">NUMBER</th>
                                    <th className="py-4 px-6 text-left font-semibold text-gray-400 text-[10px]">INVOICE REF</th>
                                    <th className="py-4 px-6 text-left font-semibold text-gray-400 text-[10px]">REASON</th>
                                    <th className="py-4 px-6 text-right font-semibold text-gray-400 text-[10px]">AMOUNT</th>
                                    <th className="py-4 px-6 text-center font-semibold text-gray-400 text-[10px]">STATUS</th>
                                    <th className="py-4 px-6 text-right font-semibold text-gray-400 text-[10px]">ACTIONS</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {creditNotes.map((cn) => (
                                    <tr key={cn.id} className="hover:bg-gray-50/50 transition-colors group">
                                        <td className="py-4 px-6 font-medium text-gray-600 whitespace-nowrap">
                                            {format(new Date(cn.createdAt), "dd MMM yyyy")}
                                        </td>
                                        <td className="py-4 px-6">
                                            <span className="font-mono font-semibold text-gray-900">{cn.cnNumber}</span>
                                        </td>
                                        <td className="py-4 px-6 text-gray-500 font-medium">{cn.invoiceRef}</td>
                                        <td className="py-4 px-6 text-gray-500 max-w-[200px] truncate">{cn.reason}</td>
                                        <td className="py-4 px-6 text-right font-mono font-semibold text-gray-900">
                                            ${cn.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                        </td>
                                        <td className="py-4 px-6">
                                            <div className="flex justify-center">
                                                {cn.status === 'VOIDED' ? (
                                                    <span className="flex items-center gap-1.5 px-2.5 py-1 bg-red-50 text-red-600 text-[10px] font-semibold rounded-full border border-red-100">
                                                        <PiXCircle /> VOIDED
                                                    </span>
                                                ) : (
                                                    <span className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-600 text-[10px] font-semibold rounded-full border border-emerald-100">
                                                        <PiCheckCircle /> ACTIVE
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="py-4 px-6 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    onClick={() => {
                                                        const params = new URLSearchParams();
                                                        params.set('type', 'CREDIT_NOTE');
                                                        params.set('id', cn.id);
                                                        params.set('customerId', customerId);
                                                        params.set('cnNumber', cn.cnNumber);
                                                        params.set('amount', cn.amount.toString());
                                                        params.set('customerName', customerName);
                                                        params.set('reason', cn.reason);
                                                        params.set('invoiceRef', cn.invoiceRef);
                                                        params.set('date', cn.createdAt);
                                                        router.push(`/finance-studio?${params.toString()}`);
                                                    }}
                                                    className="p-2 text-gray-400 hover:text-indigo-600 transition-colors bg-gray-50 hover:bg-indigo-50 rounded-lg"
                                                    title="View Credit Note"
                                                >
                                                    <PiFileText className="text-lg" />
                                                </button>


                                                <button
                                                    onClick={() => {
                                                        const params = new URLSearchParams();
                                                        params.set('type', 'RECEIPT');
                                                        params.set('id', cn.id);
                                                        params.set('customerId', customerId);

                                                        // Pre-fill receipt data from credit note
                                                        params.set('rate', '1');
                                                        params.set('paymentMethod', 'Credit Note');
                                                        params.set('transactionRef', cn.cnNumber);
                                                        params.set('receivedFrom', customerName);
                                                        params.set('originalAmount', cn.amount.toString());
                                                        params.set('notes', `Applied Credit Note: ${cn.cnNumber}`);

                                                        router.push(`/finance-studio?${params.toString()}`);
                                                    }}
                                                    className="p-2 text-gray-400 hover:text-emerald-600 transition-colors bg-gray-50 hover:bg-emerald-50 rounded-lg"
                                                    title="Create Receipt"
                                                >
                                                    <PiReceipt className="text-lg" />
                                                </button>

                                                <button
                                                    onClick={() => handleVoid(cn.id, cn.cnNumber)}
                                                    disabled={cn.status === 'VOIDED' || isVoiding === cn.id}
                                                    className={`p-2 transition-colors rounded-lg ${cn.status === 'VOIDED'
                                                        ? 'text-gray-300 bg-gray-50 cursor-not-allowed'
                                                        : 'text-gray-400 hover:text-red-600 bg-gray-50 hover:bg-red-50'
                                                        }`}
                                                    title={cn.status === 'VOIDED' ? "Credit Note Voided" : "Void Credit Note"}
                                                >
                                                    {isVoiding === cn.id ? (
                                                        <PiSpinner className="animate-spin text-lg" />
                                                    ) : (
                                                        <PiXCircle className="text-lg" />
                                                    )}
                                                </button>

                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            <div className="h-[70px] px-8 bg-gray-50 border-t border-gray-100 flex items-center justify-end shrink-0">
                <Button variant="outline" onClick={onClose} className="px-6 py-2.5 rounded-[5px] text-xs font-semibold text-gray-500">
                    Close
                </Button>
            </div>
        </FormModal>
    );
}
