"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { PiX, PiTrash, PiWarning, PiSpinner, PiCheckCircle, PiReceipt, PiBank, PiPencil, PiFloppyDisk, PiArrowLeft } from "react-icons/pi";
import { ConfirmationModal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/ToastProvider";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/Input";
import { format } from "date-fns";
import { CustomSelect } from "@/components/ui/CustomSelect";

interface Payment {
    id: string;
    amount: number;
    currency: string;
    paymentDate: string | Date;
    method: string;
    reference?: string | null;
    notes?: string | null;
}

interface ManagePaymentsModalProps {
    isOpen: boolean;
    onClose: () => void;
    customerId: string;
    customerName: string;
    payments?: Payment[]; // We can pass initial payments or fetch them
}

export function ManagePaymentsModal({
    isOpen,
    onClose,
    customerId,
    customerName
}: ManagePaymentsModalProps) {
    const router = useRouter();
    const { showToast } = useToast();
    const [payments, setPayments] = useState<Payment[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isDeleting, setIsDeleting] = useState<string | null>(null);
    const [mounted, setMounted] = useState(false);

    // Edit State
    const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [editForm, setEditForm] = useState({
        amount: "",
        paymentDate: "",
        method: "",
        reference: "",
        notes: ""
    });

    useEffect(() => {
        setMounted(true);
        return () => setMounted(false);
    }, []);

    // Fetch payments when modal opens
    useEffect(() => {
        if (isOpen && customerId) {
            fetchPayments();
            setEditingPayment(null); // Reset edit mode on open
        }
    }, [isOpen, customerId]);

    const fetchPayments = async () => {
        setIsLoading(true);
        try {
            const res = await fetch(`/api/accounting/payments?customerId=${customerId}`);
            if (res.ok) {
                const data = await res.json();
                setPayments(data);
            }
        } catch (error) {
            console.error("Failed to fetch payments", error);
        } finally {
            setIsLoading(false);
        }
    };

    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [paymentToDelete, setPaymentToDelete] = useState<string | null>(null);

    const handleDelete = async (paymentId: string) => {
        setPaymentToDelete(paymentId);
        setShowDeleteConfirm(true);
    };

    const confirmDelete = async () => {
        if (!paymentToDelete) return;

        setIsDeleting(paymentToDelete);
        try {
            const res = await fetch(`/api/accounting/payments?id=${paymentToDelete}`, {
                method: "DELETE"
            });

            if (!res.ok) {
                throw new Error("Failed to delete payment");
            }

            showToast("Payment deleted successfully", "success");

            // Refresh list and router
            setPayments(prev => prev.filter(p => p.id !== paymentToDelete));
            router.refresh();

        } catch (error) {
            showToast("Failed to delete payment", "error");
        } finally {
            setIsDeleting(null);
            setShowDeleteConfirm(false);
            setPaymentToDelete(null);
        }
    };

    const startEdit = (payment: Payment) => {
        setEditingPayment(payment);
        setEditForm({
            amount: payment.amount.toString(),
            paymentDate: new Date(payment.paymentDate).toISOString().split('T')[0],
            method: payment.method,
            reference: payment.reference || "",
            notes: payment.notes || ""
        });
    };

    const saveEdit = async () => {
        if (!editingPayment) return;

        setIsSaving(true);
        try {
            const res = await fetch(`/api/accounting/payments`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    id: editingPayment.id,
                    amount: parseFloat(editForm.amount),
                    paymentDate: editForm.paymentDate,
                    method: editForm.method,
                    reference: editForm.reference,
                    notes: editForm.notes
                })
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || "Failed to update payment");
            }

            const updatedPayment = await res.json();

            // Update local state
            setPayments(prev => prev.map(p => p.id === updatedPayment.id ? updatedPayment : p));
            showToast("Payment updated successfully", "success");
            setEditingPayment(null);
            router.refresh();

        } catch (error: any) {
            showToast(error.message, "error");
        } finally {
            setIsSaving(false);
        }
    };

    if (!isOpen || !mounted) return null;

    return createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6 lg:p-8 bg-black/50 backdrop-blur-sm animate-fade-in">
            <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-scale-in ring-1 ring-gray-200">
                {/* Header */}
                <div className="px-8 py-6 border-b border-gray-100 flex items-center justify-between bg-white shrink-0">
                    <div>
                        <h2 className="text-xl font-semibold text-gray-900">
                            {editingPayment ? "Edit Payment" : "Payment History"}
                        </h2>
                        <p className="text-sm text-gray-500 font-medium flex items-center gap-2 mt-1">
                            <span className="w-2 h-2 rounded-full bg-emerald-500" />
                            {customerName}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-full transition-colors"
                    >
                        <PiX className="text-xl" />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-8">
                    {editingPayment ? (
                        <div className="space-y-6 animate-fade-in">
                            <button
                                onClick={() => setEditingPayment(null)}
                                className="flex items-center gap-2 text-xs font-semibold text-gray-500 hover:text-gray-800 mb-4 transition-colors"
                            >
                                <PiArrowLeft /> Back to List
                            </button>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-xs font-semibold text-gray-500 uppercase">Amount ({editingPayment.currency})</label>
                                    <Input
                                        type="number"
                                        value={editForm.amount}
                                        onChange={e => setEditForm({ ...editForm, amount: e.target.value })}
                                        className="h-11 border-gray-200 font-mono text-lg font-semibold text-gray-900 bg-gray-50/50 focus:bg-white"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-semibold text-gray-500 uppercase">Payment Date</label>
                                    <Input
                                        type="date"
                                        value={editForm.paymentDate}
                                        onChange={e => setEditForm({ ...editForm, paymentDate: e.target.value })}
                                        className="h-11 border-gray-200 bg-gray-50/50 focus:bg-white"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-semibold text-gray-500 uppercase">Method</label>
                                    <CustomSelect
                                        value={editForm.method}
                                        onChange={val => setEditForm({ ...editForm, method: val })}
                                        options={[
                                            { value: "CASH", label: "Cash" },
                                            { value: "BANK_TRANSFER", label: "Bank Transfer" },
                                            { value: "CHEQUE", label: "Cheque" },
                                            { value: "MOBILE_MONEY", label: "Mobile Money" },
                                            { value: "CARD", label: "Card Payment" },
                                        ]}
                                        className="w-full h-11 px-3 bg-gray-50/50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-semibold text-gray-500 uppercase">Reference</label>
                                    <Input
                                        value={editForm.reference}
                                        onChange={e => setEditForm({ ...editForm, reference: e.target.value })}
                                        placeholder="e.g. TXN-12345"
                                        className="h-11 border-gray-200 bg-gray-50/50 focus:bg-white"
                                    />
                                </div>
                                <div className="col-span-1 sm:col-span-2 space-y-2">
                                    <label className="text-xs font-semibold text-gray-500 uppercase">Notes</label>
                                    <textarea
                                        value={editForm.notes}
                                        onChange={e => setEditForm({ ...editForm, notes: e.target.value })}
                                        className="w-full p-3 bg-gray-50/50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all resize-none h-24"
                                        placeholder="Internal notes..."
                                    />
                                </div>
                            </div>

                            <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
                                <button
                                    onClick={() => setEditingPayment(null)}
                                    disabled={isSaving}
                                    className="px-4 py-2 text-sm font-semibold text-gray-500 hover:bg-gray-50 rounded-lg transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={saveEdit}
                                    disabled={isSaving}
                                    className="px-6 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-sm font-semibold shadow-lg shadow-emerald-500/20 flex items-center gap-2 transition-all"
                                >
                                    {isSaving ? <PiSpinner className="animate-spin" /> : <PiFloppyDisk />}
                                    Save Changes
                                </button>
                            </div>
                        </div>
                    ) : (
                        // Payment List
                        <>
                            {isLoading ? (
                                <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                                    <PiSpinner className="animate-spin text-3xl mb-3" />
                                    <p className="text-sm font-medium">Loading payments...</p>
                                </div>
                            ) : payments.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-12 text-gray-400 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
                                    <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-3">
                                        <PiReceipt className="text-2xl text-gray-300" />
                                    </div>
                                    <p className="text-sm font-semibold text-gray-500">No payments recorded</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {payments.map((payment) => (
                                        <div key={payment.id} className="group p-5 bg-gray-50/50 hover:bg-white border boundary-gray-200 hover:border-emerald-200 hover:shadow-lg hover:shadow-emerald-500/5 transition-all rounded-2xl flex items-center justify-between">
                                            <div className="flex items-center gap-4">
                                                <div className="w-12 h-12 rounded-xl bg-white border border-gray-100 flex items-center justify-center text-emerald-600 shadow-sm">
                                                    <PiBank className="text-xl" />
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className="text-lg font-semibold text-gray-900">
                                                            {payment.currency} {payment.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                        </span>
                                                        <span className="text-[10px] uppercase font-semibold tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                                                            {payment.method.replace('_', ' ')}
                                                        </span>
                                                    </div>
                                                    <p className="text-xs text-gray-500 font-medium flex gap-2">
                                                        <span>{new Date(payment.paymentDate).toLocaleDateString()}</span>
                                                        {payment.reference && (
                                                            <>
                                                                <span className="text-gray-300">•</span>
                                                                <span className="font-mono text-gray-400">{payment.reference}</span>
                                                            </>
                                                        )}
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={() => startEdit(payment)}
                                                    disabled={isDeleting === payment.id}
                                                    className="p-3 rounded-xl text-gray-400 hover:bg-indigo-50 hover:text-indigo-600 transition-colors disabled:opacity-50"
                                                    title="Edit Payment"
                                                >
                                                    <PiPencil className="text-xl" />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(payment.id)}
                                                    disabled={isDeleting === payment.id}
                                                    className="p-3 rounded-xl text-gray-400 hover:bg-rose-50 hover:text-rose-600 transition-colors disabled:opacity-50"
                                                    title="Delete Payment"
                                                >
                                                    {isDeleting === payment.id ? (
                                                        <PiSpinner className="animate-spin text-xl" />
                                                    ) : (
                                                        <PiTrash className="text-xl" />
                                                    )}
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>

            <ConfirmationModal
                isOpen={showDeleteConfirm}
                onClose={() => setShowDeleteConfirm(false)}
                onConfirm={confirmDelete}
                title="Delete Payment?"
                description="Are you sure you want to delete this payment? This will revert any linked invoice statuses and this action cannot be undone."
                confirmText="Yes, Delete Payment"
                variant="danger"
                isLoading={isDeleting !== null}
            />
        </div>,
        document.body
    );
}
