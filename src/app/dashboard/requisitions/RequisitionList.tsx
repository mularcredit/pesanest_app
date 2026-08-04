"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { BiX, BiReceipt } from "react-icons/bi";
import { PiCaretRight, PiCheckCircle, PiUploadSimple, PiBuilding, PiTag, PiCalendar, PiCurrencyDollar, PiFileText, PiPlus, PiPencil, PiWarning } from "react-icons/pi";
import { fulfillRequisition, updateRequisition } from "./actions";
import { useToast } from "@/components/ui/ToastProvider";
import { EtrReceiptInput } from "@/components/accounting/EtrReceiptInput";
import { DeleteEntityButton } from "@/components/dashboard/DeleteEntityButton";
import { AddItemModal } from "@/components/requisitions/AddItemModal";
import { EditBudgetModal } from "@/components/requisitions/EditBudgetModal";
import { DatePicker } from "@/components/ui/DatePicker";
import { Select } from "@/components/ui/Select";
import { EXPENSE_CATEGORIES_WITH_GROUPS } from "@/lib/constants";
import { getReceiptViewerUrl } from "@/lib/receipt-url";

interface RequisitionListProps {
    requisitions: any[];
    monthlyBudgets?: any[];
}

export function RequisitionList({ requisitions, monthlyBudgets = [] }: RequisitionListProps) {
    const { showToast } = useToast();
    const router = useRouter();
    const [mounted, setMounted] = useState(false);
    const [selectedReq, setSelectedReq] = useState<any>(null);
    const [viewingReq, setViewingReq] = useState<any>(null);

    const formatCurrency = (amount: number, currency: string = 'KES') => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: currency,
        }).format(amount);
    };

    useEffect(() => {
        setMounted(true);
    }, []);

    // Normalize both types for a unified list
    const allItems = [
        ...requisitions.map(r => ({ ...r, listType: 'STANDARD' })),
        ...monthlyBudgets.map(b => ({
            ...b,
            listType: 'MONTHLY',
            title: `Budget: ${new Date(2024, b.month - 1).toLocaleString('default', { month: 'long' })} ${b.year}`,
            amount: b.totalAmount
        }))
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const [isUploading, setIsUploading] = useState(false);
    const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
    const [etrNumber, setEtrNumber] = useState("");
    const [etrVerified, setEtrVerified] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showConfirmation, setShowConfirmation] = useState(false);
    const [addingItemTo, setAddingItemTo] = useState<any>(null);
    const [editingBudget, setEditingBudget] = useState<any>(null);

    // Edit state
    const [editingReq, setEditingReq] = useState<any>(null);
    const [editTitle, setEditTitle] = useState("");
    const [editDescription, setEditDescription] = useState("");
    const [editBranch, setEditBranch] = useState("");
    const [editDepartment, setEditDepartment] = useState("");
    const [editExpectedDate, setEditExpectedDate] = useState<Date | undefined>(undefined);
    const [editAmount, setEditAmount] = useState("");
    const [editCurrency, setEditCurrency] = useState("KES");
    const [editCategory, setEditCategory] = useState("");
    const [editPaymentMethod, setEditPaymentMethod] = useState("");
    const [editPaymentReference, setEditPaymentReference] = useState("");
    const [editSaving, setEditSaving] = useState(false);
    const [editError, setEditError] = useState("");

    const CURRENCIES = [
        { code: 'KES', name: 'Kenyan Shilling', symbol: 'KSh', flag: '🇰🇪' },
        { code: 'UGX', name: 'Ugandan Shilling', symbol: 'USh', flag: '🇺🇬' },
        { code: 'TZS', name: 'Tanzanian Shilling', symbol: 'TSh', flag: '🇹🇿' },
        { code: 'USD', name: 'US Dollar', symbol: '$', flag: '🇺🇸' },
        { code: 'EUR', name: 'Euro', symbol: '€', flag: '🇪🇺' },
        { code: 'GBP', name: 'British Pound', symbol: '£', flag: '🇬🇧' },
    ];

    const CATEGORY_GROUPS = EXPENSE_CATEGORIES_WITH_GROUPS.map(g => ({
        label: g.group,
        options: g.items.map(item => ({ value: item, label: item }))
    }));

    const PAYMENT_METHODS = [
        { value: "CASH", label: "Cash" },
        { value: "BANK_TRANSFER", label: "Bank Transfer" },
        { value: "MPESA", label: "M-Pesa" },
        { value: "CHEQUE", label: "Cheque" },
        { value: "CARD", label: "Card" },
        { value: "PAYBILL", label: "Paybill" },
    ];

    const openEdit = (req: any) => {
        setEditingReq(req);
        setEditTitle(req.title || "");
        setEditDescription(req.description || "");
        setEditBranch(req.branch || "");
        setEditDepartment(req.department || "");
        setEditExpectedDate(req.expectedDate ? new Date(req.expectedDate) : undefined);
        setEditAmount(req.amount?.toString() || "");
        setEditCurrency(req.currency || "KES");
        setEditCategory(req.category || "");
        setEditPaymentMethod(req.paymentMethod || "");
        setEditPaymentReference(req.paymentReference || "");
        setEditError("");
    };

    const handleEditSave = async () => {
        if (!editingReq) return;
        setEditSaving(true);
        setEditError("");
        const fd = new FormData();
        fd.append("id", editingReq.id);
        fd.append("title", editTitle);
        fd.append("description", editDescription);
        fd.append("branch", editBranch);
        fd.append("department", editDepartment);
        if (editExpectedDate) fd.append("expectedDate", editExpectedDate.toISOString());
        fd.append("amount", editAmount);
        fd.append("currency", editCurrency);
        fd.append("category", editCategory);
        fd.append("paymentMethod", editPaymentMethod);
        fd.append("paymentReference", editPaymentReference);
        const result = await updateRequisition(fd);
        setEditSaving(false);
        if (result.success) {
            showToast(result.message || "Expense updated successfully", "success");
            setEditingReq(null);
            router.refresh();
        } else {
            setEditError(result.message || "Failed to save");
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        const formData = new FormData();
        formData.append('file', file);

        try {
            const res = await fetch('/api/upload', {
                method: 'POST',
                body: formData
            });
            const data = await res.json();
            if (data.url) {
                setReceiptUrl(data.url);
                showToast("Receipt uploaded successfully", "success");
            }
        } catch (err) {
            showToast("Failed to upload receipt", "error");
        } finally {
            setIsUploading(false);
        }
    };

    const handleFulfill = async () => {
        if (!receiptUrl || !selectedReq) return;

        setIsSubmitting(true);
        const formData = new FormData();
        formData.append("requisitionId", selectedReq.id);
        formData.append("receiptUrl", receiptUrl);
        if (etrNumber.trim()) {
            formData.append("etrNumber", etrNumber.trim());
            formData.append("etrVerified", String(etrVerified));
        }

        try {
            const result = await fulfillRequisition(formData);
            if (result.success) {
                showToast("Receipt submitted! Expense is now in the Pay queue.", "success");
                setSelectedReq(null);
                setReceiptUrl(null);
                setEtrNumber("");
                setEtrVerified(false);
                setShowConfirmation(false);
                router.refresh();
            } else {
                showToast(result.error || "Failed to submit", "error");
            }
        } catch (err) {
            showToast("An error occurred", "error");
        } finally {
            setIsSubmitting(false);
        }
    };

    const getStatusStyles = (status: string) => {
        switch (status.toUpperCase()) {
            case 'APPROVED':
            case 'PAID':
            case 'FULFILLED':
            case 'COMPLETED':
                return "text-emerald-700 font-semibold uppercase tracking-widest text-[9px]";
            case 'PENDING': return "text-gray-500 font-semibold uppercase tracking-widest text-[9px]";
            case 'REJECTED': return "text-red-700 font-semibold uppercase tracking-widest text-[9px]";
            default: return "text-gray-400 font-semibold uppercase tracking-widest text-[9px]";
        }
    };

    return (
        <>
 <div className="bg-white rounded-xl overflow-x-auto pb-1 [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar-thumb]:bg-slate-300 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-track]:bg-slate-50" style={{border:'1px solid rgba(0,0,0,0.09)',boxShadow:'0 1px 3px rgba(0,0,0,0.06)'}}>
                    <table className="w-full text-left text-[12px] whitespace-nowrap border-collapse">
                        <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider text-[10px] font-semibold">
                            <tr>
                            <th className="px-4 py-3 w-28 text-left rounded-tl-xl">ID</th>
                            <th className="px-4 py-3 text-left">Item / Purpose</th>
                            <th className="px-4 py-3 w-28 text-left">Date</th>
                            <th className="px-4 py-3 w-32 text-left">Amount</th>
                            <th className="px-4 py-3 w-28 text-left">Status</th>
                            <th className="px-4 py-3 w-44 text-right bg-slate-50 rounded-tr-xl">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {allItems.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="py-16 text-center text-gray-400 italic">
                                    No records found.
                                </td>
                            </tr>
                        ) : (
                            allItems.map((req: any, i: number) => (
                                <tr key={i} className="hover:bg-slate-50 transition-colors group">
                                    <td className="px-4 py-3 font-mono text-[11px] text-slate-500 align-top">
                                        REQ-{req.id.slice(0, 8).toUpperCase()}
                                    </td>
                                    <td className="px-4 py-3 align-top">
                                        <div className="flex flex-col gap-1.5 pr-4">
                                            <div className="flex items-start gap-2">
                                                {req.listType === 'MONTHLY' && (
                                                    <span className="text-[9px] font-semibold text-violet-700 bg-violet-50 border border-violet-100 px-1.5 py-0.5 rounded shrink-0 leading-none mt-0.5 uppercase tracking-wide">Plan</span>
                                                )}
                                                <span className="font-medium text-slate-800 leading-snug break-words whitespace-normal tracking-wide">
                                                    {req.title}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-medium tracking-wide">
                                                <PiBuilding />
                                                <span>{req.branch || "Global"} {req.department && `• ${req.department}`}</span>
                                            </div>
                                            {req.approvals && req.approvals.length > 0 && req.approvals[0].comments && (
                                                <div className="mt-0.5 max-w-sm">
                                                    <p className="text-[10px] text-orange-600 bg-orange-50 border border-orange-100 px-2 py-1.5 rounded text-left leading-normal italic line-clamp-2" title={req.approvals[0].comments}>
                                                        Note: {req.approvals[0].comments}
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-slate-500 align-top">
                                        {new Date(req.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                    </td>
                                    <td className="px-4 py-3 font-semibold text-slate-900 border-r-0 align-top">
                                        {formatCurrency(req.amount, req.currency)}
                                    </td>
                                    <td className="px-4 py-3 align-top">
                                        <span className={cn(
                                            "inline-flex shrink-0 px-2.5 py-1 rounded-md text-[10px] font-semibold tracking-wide whitespace-nowrap",
                                            req.status === 'APPROVED' || req.status === 'PAID' || req.status === 'FULFILLED' || req.status === 'COMPLETED' ? "bg-emerald-50 text-emerald-700 border border-emerald-200" :
                                                req.status === 'REJECTED' ? "bg-rose-50 text-rose-700 border border-rose-200" :
                                                    "bg-slate-50 text-slate-600 border border-slate-200"
                                        )}>
                                            {req.status}
                                        </span>
                                    </td>
                                    <td className="pl-4 pr-6 py-3 align-middle group-hover:bg-slate-50 transition-colors">
                                        <div className="flex items-center justify-end gap-1">
                                            {req.listType === 'STANDARD' && ['PENDING', 'NEEDS_INFO', 'ADJUSTMENT_REQUIRED'].includes(req.status) && (
                                                <button
                                                    onClick={() => openEdit(req)}
                                                    className="p-1.5 rounded-md hover:bg-amber-50 text-slate-400 hover:text-amber-600 transition-all"
                                                    title="Edit Expense"
                                                >
                                                    <PiPencil className="text-base" />
                                                </button>
                                            )}

                                            {req.listType === 'MONTHLY' && req.status === 'PENDING' && (
                                                <button
                                                    onClick={() => setEditingBudget(req)}
                                                    className="p-1.5 rounded-md hover:bg-amber-50 text-slate-400 hover:text-amber-600 transition-all"
                                                    title="Edit Budget"
                                                >
                                                    <PiPencil className="text-base" />
                                                </button>
                                            )}

                                            {req.listType === 'MONTHLY' && req.status === 'PENDING' && (
                                                <button
                                                    onClick={() => setAddingItemTo(req)}
                                                    className="p-1.5 rounded-md hover:bg-indigo-50 text-slate-400 hover:text-indigo-600 transition-all"
                                                    title="Add Item to Budget"
                                                >
                                                    <PiPlus className="text-base" />
                                                </button>
                                            )}

                                            {req.listType === 'STANDARD' && (req.status === 'PENDING' || req.status === 'APPROVED') && (
                                                <button
                                                    onClick={() => setAddingItemTo(req)}
                                                    className="inline-flex items-center gap-1 px-1.5 py-1 rounded text-[9px] font-semibold text-indigo-600 bg-indigo-50 border border-indigo-100 hover:bg-indigo-100 transition-all whitespace-nowrap"
                                                    title="Add Item"
                                                >
                                                    <PiPlus className="text-[10px]" />
                                                    Add item
                                                </button>
                                            )}

                                            {req.listType === 'STANDARD' && req.status === 'APPROVED' ? (
                                                <button
                                                    onClick={() => setSelectedReq(req)}
                                                    className="p-1.5 rounded-md hover:bg-[#6366F1]/10 text-slate-400 hover:text-[#6366F1] transition-all"
                                                    title="Submit Receipt"
                                                >
                                                    <PiUploadSimple className="text-base" />
                                                </button>
                                            ) : null}

                                            {req.listType === 'STANDARD' && (req.status === 'APPROVED' || req.status === 'PAID' || req.status === 'FULFILLED' || req.status === 'COMPLETED' || req.status === 'CLOSED') ? (
                                                <Link
                                                    href={`/receipt-studio?requisitionId=${req.id}`}
                                                    className="inline-flex items-center gap-1 px-1.5 py-1 rounded text-[9px] font-semibold text-slate-600 bg-slate-50 border border-slate-200 hover:bg-slate-100 transition-all whitespace-nowrap"
                                                    title="Generate Voucher"
                                                >
                                                    <BiReceipt className="text-[10px]" />
                                                    Voucher
                                                </Link>
                                            ) : null}

                                            {req.listType === 'STANDARD' && req.receiptUrl ? (
                                                <a
                                                    href={getReceiptViewerUrl(req.receiptUrl)}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="p-1.5 rounded-md hover:bg-emerald-50 text-emerald-500 hover:text-emerald-700 transition-all"
                                                    title="View Receipt"
                                                >
                                                    <BiReceipt className="text-base" />
                                                </a>
                                            ) : null}

                                            <div className="flex items-center gap-0.5 ml-0.5 border-l border-slate-100 pl-0.5">
                                                <Link
                                                    href={`/dashboard/requisitions/${req.id}`}
                                                    className="p-1.5 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-900 transition-all"
                                                    title="View Details"
                                                >
                                                    <PiCaretRight className="text-[15px]" />
                                                </Link>

                                                {req.listType === 'STANDARD' && req.status !== 'FULFILLED' && (
                                                    <DeleteEntityButton
                                                        id={req.id}
                                                        entityType="requisition"
                                                        entityName={req.title}
                                                        className="p-1.5 !text-slate-400 hover:!text-rose-500 hover:!bg-rose-50"
                                                    />
                                                )}
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Fulfill Modal */}
            {selectedReq && mounted && createPortal(
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-md animate-fade-in gpu-accel">
                    <div className="bg-white max-w-xl w-full rounded-xl shadow-2xl overflow-hidden animate-scale-in flex flex-col border border-gray-200">
                        <div className="h-[88px] px-6 flex justify-between items-center bg-white border-b border-gray-100 shrink-0">
                            <div>
                                <h2 className="text-base font-semibold text-gray-900">Fulfill Expense</h2>
                                <div className="flex items-center gap-2 mt-1">
                                    <p className="text-[10px] text-gray-400 font-medium uppercase tracking-widest">
                                        ID: {selectedReq.id.slice(0, 8)}
                                    </p>
                                    <span className="w-1 h-1 bg-gray-200 rounded-full" />
                                    <p className="text-[10px] text-[#6366F1] font-semibold uppercase tracking-widest">
                                        Amount: {formatCurrency(selectedReq.amount, selectedReq.currency)}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => { setSelectedReq(null); setReceiptUrl(null); setEtrNumber(""); setEtrVerified(false); setShowConfirmation(false); }}
                                className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-900 transition-colors"
                            >
                                <BiX className="text-2xl" />
                            </button>
                        </div>

                        <div className="bg-[#F6F6F6] p-8 space-y-6">
                            <div className={cn(
                                "p-8 rounded-xl border-2 border-dashed transition-all group bg-white",
                                receiptUrl ? "border-[#6366F1]/30" : "border-gray-200 hover:border-[#6366F1]"
                            )}>
                                <input
                                    type="file"
                                    onChange={handleFileUpload}
                                    className="hidden"
                                    id="modal-receipt-upload"
                                    accept="image/*,.pdf"
                                />
                                <label htmlFor="modal-receipt-upload" className="cursor-pointer space-y-4 block text-center">
                                    {isUploading ? (
                                        <div className="flex flex-col items-center gap-3">
                                            <div className="w-10 h-10 border-2 border-[#6366F1] border-t-transparent rounded-full animate-spin" />
                                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Uploading...</p>
                                        </div>
                                    ) : receiptUrl ? (
                                        <div className="flex flex-col items-center gap-3">
                                            <div className="w-12 h-12 rounded-full bg-[#6366F1]/10 flex items-center justify-center">
                                                <PiCheckCircle className="text-3xl text-[#6366F1]" />
                                            </div>
                                            <div>
                                                <p className="text-sm font-semibold text-gray-900">Receipt Attached</p>
                                                <p className="text-[10px] text-[#6366F1] font-semibold uppercase mt-1">Ready to submit</p>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            <div className="w-14 h-14 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-center mx-auto group-hover:scale-110 transition-transform shadow-sm">
                                                <PiUploadSimple className="text-2xl text-gray-400" />
                                            </div>
                                            <div>
                                                <p className="text-xs font-semibold text-gray-900 uppercase tracking-wider">Click to Upload</p>
                                                <p className="text-[10px] text-gray-500 font-medium uppercase tracking-widest mt-1">PDF or image format</p>
                                            </div>
                                        </div>
                                    )}
                                </label>
                            </div>

                            <div className="bg-white rounded-xl p-4 border border-gray-100">
                                <EtrReceiptInput
                                    value={etrNumber}
                                    onChange={(v) => setEtrNumber(v)}
                                    onVerified={(verified, _result) => setEtrVerified(verified)}
                                />
                            </div>

                            {showConfirmation && (
 <div className="bg-white rounded-xl p-4 flex gap-3 animate-fade-in" style={{border:'1px solid rgba(0,0,0,0.09)'}}>
                                    <div className="w-1 h-auto bg-[#6366F1] rounded-full" />
                                    <div>
                                        <p className="text-[10px] font-semibold text-gray-900 uppercase tracking-widest mb-1">Final Confirmation</p>
                                        <p className="text-xs text-gray-500 leading-relaxed">
                                            Please verify that the attached receipt matches the approved amount of <span className="text-[#6366F1] font-semibold">{formatCurrency(selectedReq.amount, selectedReq.currency)}</span>.
                                            {etrNumber && (
                                                <span className="block mt-1">
                                                    ETR: <span className={`font-semibold font-mono ${etrVerified ? 'text-emerald-600' : 'text-amber-600'}`}>{etrNumber}</span>
                                                    {etrVerified ? ' ✓ Verified' : ' — not yet verified'}
                                                </span>
                                            )}
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="h-[88px] px-6 bg-white border-t border-gray-100 flex items-center justify-end gap-3 shrink-0">
                            <button
                                onClick={() => setSelectedReq(null)}
                                className="px-4 py-2.5 rounded-md text-xs font-medium text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 transition-colors shadow-none"
                            >
                                Cancel
                            </button>

                            {!showConfirmation ? (
                                <button
                                    onClick={() => setShowConfirmation(true)}
                                    disabled={!receiptUrl}
                                    className="px-5 py-2.5 rounded-md text-xs font-medium text-white bg-[#6366F1] hover:bg-[#6366F1]/90 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-none"
                                >
                                    <BiReceipt className="text-sm" />
                                    <span>Review & Submit</span>
                                </button>
                            ) : (
                                <div className="flex items-center gap-3">
                                    <button
                                        onClick={() => setShowConfirmation(false)}
                                        className="px-4 py-2.5 rounded-md text-xs font-medium text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 transition-colors shadow-none"
                                    >
                                        Back
                                    </button>
                                    <button
                                        onClick={handleFulfill}
                                        disabled={isSubmitting}
                                        className="px-5 py-2.5 rounded-md text-xs font-medium text-white bg-[#6366F1] hover:bg-[#6366F1]/90 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-none"
                                    >
                                        {isSubmitting ? "Submitting..." : "Confirm & Submit"}
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* Requisition Details Modal */}
            {viewingReq && mounted && createPortal(
                <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center sm:p-4 bg-black/60 backdrop-blur-xl animate-fade-in gpu-accel">
                    <div className="bg-white w-full sm:max-w-xl rounded-t-[10px] sm:rounded-[10px] overflow-hidden animate-scale-in flex flex-col border border-gray-200">

                        {/* Drag handle (mobile) */}
                        <div className="flex justify-center pt-3 pb-1 sm:hidden">
                            <div className="w-10 h-1 rounded-full bg-gray-200" />
                        </div>

                        {/* ── HEADER ─────────────────────────────── */}
                        <div className="px-8 py-5 flex items-start justify-between border-b border-gray-200">
                            <div className="flex items-center gap-4">
                                <div className="w-11 h-11 rounded-[10px] border border-[#6366F1]/15 bg-[#6366F1]/5 flex items-center justify-center shrink-0">
                                    <BiReceipt className="text-xl text-[#6366F1]" />
                                </div>
                                <div>
                                    <h2 className="text-base font-semibold text-gray-900 leading-tight">{viewingReq.title}</h2>
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className="text-[9px] font-semibold uppercase tracking-widest text-gray-400 font-mono">{viewingReq.id.slice(0, 8)}</span>
                                        <span className="w-1 h-1 rounded-full bg-gray-300" />
                                        <span className={cn(
                                            "text-[9px] font-semibold uppercase tracking-widest",
                                            viewingReq.status === 'APPROVED' || viewingReq.status === 'PAID' || viewingReq.status === 'FULFILLED' ? "text-emerald-600" :
                                                viewingReq.status === 'REJECTED' ? "text-red-600" : "text-amber-600"
                                        )}>{viewingReq.status}</span>
                                    </div>
                                </div>
                            </div>
                            <button
                                onClick={() => setViewingReq(null)}
                                className="p-2 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-all active:scale-95 shrink-0"
                            >
                                <BiX className="text-xl" />
                            </button>
                        </div>

                        {/* ── BODY ────────────────────────────────── */}
                        <div className="flex-1 overflow-y-auto divide-y divide-gray-200 bg-gray-50">

                            {/* Row: Amount & Category */}
                            <div className="grid grid-cols-2 divide-x divide-gray-200">
                                <div className="px-8 py-5">
                                    <div className="flex items-center gap-1.5 mb-1.5">
                                        <PiCurrencyDollar className="text-[#6366F1] text-sm" />
                                        <span className="text-[9px] font-semibold text-gray-400 uppercase tracking-widest">Amount</span>
                                    </div>
                                    <p className="text-2xl font-semibold text-gray-900 tracking-tight">
                                        {formatCurrency(viewingReq.amount, viewingReq.currency)}
                                    </p>
                                </div>
                                <div className="px-8 py-5">
                                    <div className="flex items-center gap-1.5 mb-1.5">
                                        <PiTag className="text-[#6366F1] text-sm" />
                                        <span className="text-[9px] font-semibold text-gray-400 uppercase tracking-widest">Category</span>
                                    </div>
                                    <p className="text-sm font-semibold text-gray-900">{viewingReq.category || "Uncategorized"}</p>
                                </div>
                            </div>

                            {/* Row: Branch & Date */}
                            <div className="grid grid-cols-2 divide-x divide-gray-200">
                                <div className="px-8 py-5">
                                    <div className="flex items-center gap-1.5 mb-1.5">
                                        <PiBuilding className="text-[#6366F1] text-sm" />
                                        <span className="text-[9px] font-semibold text-gray-400 uppercase tracking-widest">Branch</span>
                                    </div>
                                    <p className="text-sm font-semibold text-gray-800">{viewingReq.branch || "Global"}</p>
                                    {viewingReq.department && <p className="text-xs text-gray-400 font-medium mt-0.5">{viewingReq.department}</p>}
                                </div>
                                <div className="px-8 py-5">
                                    <div className="flex items-center gap-1.5 mb-1.5">
                                        <PiCalendar className="text-[#6366F1] text-sm" />
                                        <span className="text-[9px] font-semibold text-gray-400 uppercase tracking-widest">Submitted</span>
                                    </div>
                                    <p className="text-sm font-semibold text-gray-800">
                                        {new Date(viewingReq.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                                    </p>
                                </div>
                            </div>

                            {/* Row: Description */}
                            {viewingReq.description && (
                                <div className="px-8 py-5">
                                    <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-widest mb-2">Purpose & Justification</p>
                                    <p className="text-sm text-gray-600 leading-relaxed font-medium">{viewingReq.description}</p>
                                </div>
                            )}

                            {/* Row: Status */}
                            <div className="px-8 py-4 flex items-center justify-between">
                                <div className="flex items-center gap-2.5">
                                    <div className={cn(
                                        "w-2 h-2 rounded-full animate-pulse shrink-0",
                                        viewingReq.status === 'APPROVED' || viewingReq.status === 'FULFILLED' || viewingReq.status === 'PAID' ? "bg-emerald-500" :
                                            viewingReq.status === 'REJECTED' ? "bg-red-500" : "bg-amber-500"
                                    )} />
                                    <span className={cn(
                                        "text-xs font-semibold uppercase tracking-widest",
                                        viewingReq.status === 'APPROVED' || viewingReq.status === 'FULFILLED' || viewingReq.status === 'PAID' ? "text-emerald-700" :
                                            viewingReq.status === 'REJECTED' ? "text-red-700" : "text-amber-700"
                                    )}>
                                        {viewingReq.status}
                                    </span>
                                </div>
                                {viewingReq.listType === 'STANDARD' && viewingReq.status === 'APPROVED' && (
                                    <span className="text-[9px] font-semibold text-emerald-500 uppercase tracking-widest italic">Ready for fulfillment</span>
                                )}
                            </div>
                        </div>

                        {/* ── FOOTER ──────────────────────────────── */}
                        <div className="px-8 py-4 border-t border-gray-200 flex items-center justify-end gap-2 shrink-0">
                            {viewingReq.listType === 'STANDARD' && viewingReq.status !== 'FULFILLED' && (
                                <DeleteEntityButton
                                    id={viewingReq.id}
                                    entityType="requisition"
                                    entityName={viewingReq.title}
                                    className="py-2 px-4 text-xs font-semibold text-rose-500 border border-rose-200 rounded-[10px] hover:bg-rose-50 flex items-center gap-2"
                                />
                            )}
                            <button
                                onClick={() => setViewingReq(null)}
                                className="px-5 py-2.5 rounded-[10px] text-xs font-semibold text-gray-500 border border-gray-200 hover:bg-gray-50 transition-all active:scale-95"
                            >
                                Close
                            </button>
                            {viewingReq.listType === 'STANDARD' && viewingReq.status === 'APPROVED' && (
                                <button
                                    onClick={() => {
                                        setViewingReq(null);
                                        setSelectedReq(viewingReq);
                                    }}
                                    className="px-6 py-2.5 rounded-[10px] bg-[#6366F1] text-white text-xs font-semibold border border-[#6366F1] hover:-translate-y-0.5 transition-all active:scale-95 flex items-center gap-2"
                                >
                                    <PiCheckCircle className="text-base" />
                                    Proceed to Fulfill
                                </button>
                            )}
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* Add Item Modal */}
            {addingItemTo && (
                <AddItemModal
                    isOpen={true}
                    onClose={() => setAddingItemTo(null)}
                    requisitionId={addingItemTo.id}
                    currency={addingItemTo.currency || 'KES'}
                    onItemAdded={() => {
                        showToast("Item added successfully", "success");
                        router.refresh();
                    }}
                />
            )}

            {/* Edit Expense Modal */}
            {editingReq && mounted && createPortal(
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-md animate-fade-in gpu-accel">
                    <div className="bg-white max-w-xl w-full rounded-xl shadow-2xl overflow-hidden animate-scale-in flex flex-col border border-gray-200">
                        {/* Header */}
                        <div className="h-[88px] shrink-0 flex items-center justify-between px-6 bg-white border-b border-gray-100">
                            <div>
                                <h2 className="text-base font-semibold text-gray-900">Edit Expense</h2>
                                <div className="flex items-center gap-2 mt-1">
                                    <p className="text-[10px] text-gray-400 font-medium uppercase tracking-widest">
                                        ID: {editingReq.id.slice(0, 8)}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setEditingReq(null)}
                                className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-900 transition-colors"
                            >
                                <BiX className="text-2xl" />
                            </button>
                        </div>

                        {/* Body */}
                        <div className="px-6 py-5 space-y-4 overflow-y-auto bg-white max-h-[72vh]">

                            {/* Adjustment banner */}
                            {editingReq?.status === 'ADJUSTMENT_REQUIRED' && (
                                <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                                    <div className="p-1.5 bg-amber-100 rounded-md shrink-0">
                                        <PiWarning className="text-amber-600 text-base" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-semibold text-amber-800 uppercase tracking-widest mb-0.5">Adjustment Required</p>
                                        <p className="text-xs text-amber-700/90 font-medium leading-relaxed">
                                            An approver has requested changes. Update the fields below and save — your request will automatically resubmit for approval.
                                        </p>
                                        {editingReq?.approvals?.[0]?.comments && (
                                            <p className="mt-1.5 text-xs text-amber-800 font-semibold italic">"{editingReq.approvals[0].comments}"</p>
                                        )}
                                    </div>
                                </div>
                            )}

                            {editError && (
                                <div className="flex items-start gap-3 p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs font-semibold">
                                    <PiWarning className="text-base shrink-0 mt-0.5" />
                                    <p className="leading-relaxed">{editError}</p>
                                </div>
                            )}

                            {/* Title */}
                            <div>
                                <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-widest mb-1.5">
                                    Expense Title <span className="text-rose-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={editTitle}
                                    onChange={e => setEditTitle(e.target.value)}
                                    className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2.5 text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#6366F1]/10 focus:border-[#6366F1] transition-all placeholder:text-gray-300"
                                    placeholder="What is this request for?"
                                />
                            </div>

                            {/* Justification */}
                            <div>
                                <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-widest mb-1.5">
                                    Justification <span className="text-rose-500">*</span>
                                </label>
                                <textarea
                                    value={editDescription}
                                    onChange={e => setEditDescription(e.target.value)}
                                    rows={3}
                                    className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#6366F1]/10 focus:border-[#6366F1] transition-all resize-none placeholder:text-gray-300"
                                    placeholder="Explain the business need in detail..."
                                />
                            </div>

                            {/* Amount + Currency */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-widest mb-1.5">
                                        Amount <span className="text-rose-500">*</span>
                                    </label>
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={editAmount}
                                        onChange={e => setEditAmount(e.target.value)}
                                        className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2.5 text-sm font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#6366F1]/10 focus:border-[#6366F1] transition-all placeholder:text-gray-300"
                                        placeholder="0.00"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-widest mb-1.5">Currency</label>
                                    <Select
                                        value={editCurrency}
                                        onChange={setEditCurrency}
                                        options={CURRENCIES.map(c => ({ 
                                            value: c.code, 
                                            label: (
                                                <div className="flex items-center gap-2">
                                                    <span className="text-base">{c.flag}</span>
                                                    <span>{c.code} — {c.name}</span>
                                                </div>
                                            )
                                        }))}
                                        placeholder="Select Currency"
                                        searchable={true}
                                    />
                                </div>
                            </div>

                            {/* Category */}
                            <div>
                                <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-widest mb-1.5">Category</label>
                                <Select
                                    value={editCategory}
                                    onChange={setEditCategory}
                                    groups={CATEGORY_GROUPS}
                                    placeholder="Select a category..."
                                    searchable={true}
                                />
                            </div>

                            {/* Branch + Department */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-widest mb-1.5">Branch</label>
                                    <input
                                        type="text"
                                        value={editBranch}
                                        onChange={e => setEditBranch(e.target.value)}
                                        className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2.5 text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#6366F1]/10 focus:border-[#6366F1] transition-all placeholder:text-gray-300"
                                        placeholder="e.g. Nairobi HQ"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-widest mb-1.5">Department</label>
                                    <input
                                        type="text"
                                        value={editDepartment}
                                        onChange={e => setEditDepartment(e.target.value)}
                                        className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2.5 text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#6366F1]/10 focus:border-[#6366F1] transition-all placeholder:text-gray-300"
                                        placeholder="e.g. Finance"
                                    />
                                </div>
                            </div>

                            {/* Expected Date */}
                            <div>
                                <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-widest mb-1.5">Expected Date</label>
                                <DatePicker value={editExpectedDate} onChange={setEditExpectedDate} />
                            </div>

                            {/* Payment Method + Reference */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-widest mb-1.5">Payment Method</label>
                                    <Select
                                        value={editPaymentMethod}
                                        onChange={setEditPaymentMethod}
                                        options={PAYMENT_METHODS}
                                        placeholder="Select Method"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-widest mb-1.5">Reference / Account No.</label>
                                    <input
                                        type="text"
                                        value={editPaymentReference}
                                        onChange={e => setEditPaymentReference(e.target.value)}
                                        className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2.5 text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#6366F1]/10 focus:border-[#6366F1] transition-all placeholder:text-gray-300"
                                        placeholder="e.g. 254712345678"
                                    />
                                </div>
                            </div>

                        </div>
                        {/* Footer */}
                        <div className="h-[88px] px-6 bg-white border-t border-gray-100 flex items-center justify-end gap-3 shrink-0">
                            <button
                                onClick={() => setEditingReq(null)}
                                className="px-4 py-2.5 rounded-md text-xs font-medium text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 transition-colors shadow-none"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleEditSave}
                                disabled={editSaving}
                                className="px-5 py-2.5 rounded-md text-xs font-medium text-white bg-[#6366F1] hover:bg-[#6366F1]/90 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-none"
                            >
                                {editSaving 
                                    ? "Saving..." 
                                    : editingReq?.status === 'ADJUSTMENT_REQUIRED' 
                                        ? "Save & Resubmit" 
                                        : "Save Changes"
                                }
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* Edit Budget Modal */}
            <EditBudgetModal
                isOpen={!!editingBudget}
                onClose={() => setEditingBudget(null)}
                budget={editingBudget}
            />
        </>
    );
}
