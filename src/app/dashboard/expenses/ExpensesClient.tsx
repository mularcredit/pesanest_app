"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { DateRangeFilter, filterByDateRange, type DateRange } from "@/components/ui/DateRangeFilter";
import {
    PiPlus,
    PiWallet,
    PiClock,
    PiCheckCircle,
    PiReceipt,
    PiFileText,
    PiWarningCircle,
    PiUploadSimple
} from "react-icons/pi";
import { UnifiedExpenseModal } from "@/components/expenses/UnifiedExpenseModal";
import { Button } from "@/components/ui/Button";

import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/ToastProvider";
import { submitAllDrafts, deleteExpense, rejectExpense, submitSelectedExpenses } from "./actions";
import { PiSpinner, PiTrash, PiProhibit, PiCheckSquare, PiSquare } from "react-icons/pi";
import { ConfirmationModal } from "@/components/ui/Modal";

interface ExpensesClientProps {
    draftExpenses: any[];
    submittedExpenses: any[];
    unsubmittedAmount: number;
    isAdmin: boolean;
}

export function ExpensesClient({
    draftExpenses,
    submittedExpenses,
    unsubmittedAmount,
    isAdmin
}: ExpensesClientProps) {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [viewingExpense, setViewingExpense] = useState<any>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isDeleting, setIsDeleting] = useState<string | null>(null);
    const { showToast } = useToast();
    const router = useRouter();

    const [showConfirmSubmit, setShowConfirmSubmit] = useState(false);
    const [expenseToDelete, setExpenseToDelete] = useState<any>(null);
    const [expenseToReject, setExpenseToReject] = useState<any>(null);
    const [isRejecting, setIsRejecting] = useState<string | null>(null);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [showEmergencyAlert, setShowEmergencyAlert] = useState(false);
    const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending');
    const [dateRange, setDateRange] = useState<DateRange>({ from: null, to: null });

    const filteredDrafts = useMemo(() => filterByDateRange(draftExpenses, dateRange, 'expenseDate'), [draftExpenses, dateRange]);
    const filteredSubmitted = useMemo(() => filterByDateRange(submittedExpenses, dateRange, 'expenseDate'), [submittedExpenses, dateRange]);

    const handleSubmitReport = async () => {
        setShowConfirmSubmit(false);

        setIsSubmitting(true);
        try {
            const res = selectedIds.length > 0
                ? await submitSelectedExpenses(selectedIds)
                : await submitAllDrafts();

            if (res.success) {
                showToast(res.message || "Expenses submitted successfully", "success");
                setSelectedIds([]);
                router.refresh();
            } else {
                showToast(res.message || res.error || "Failed to submit expenses", "error");
                if (res.errors && res.errors.length > 0) {
                    console.error(res.errors);
                }
            }
        } catch (error) {
            showToast("An unexpected error occurred", "error");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeleteExpense = async () => {
        if (!expenseToDelete) return;

        setIsDeleting(expenseToDelete.id);
        setExpenseToDelete(null);

        try {
            const res = await deleteExpense(isDeleting!);
            if (res.success) {
                showToast("Expense removed", "success");
                router.refresh();
            } else {
                showToast(res.error || "Failed to delete expense", "error");
            }
        } catch (error) {
            showToast("An unexpected error occurred", "error");
        } finally {
            setIsDeleting(null);
        }
    };

    const handleRejectExpense = async () => {
        if (!expenseToReject) return;

        setIsRejecting(expenseToReject.id);
        setExpenseToReject(null);

        try {
            const res = await rejectExpense(isRejecting!);
            if (res.success) {
                showToast("Expense rejected", "success");
                router.refresh();
            } else {
                showToast(res.error || "Failed to reject expense", "error");
            }
        } catch (error) {
            showToast("An unexpected error occurred", "error");
        } finally {
            setIsRejecting(null);
        }
    };

    const handleExpenseClick = (exp: any) => {
        setViewingExpense(exp);
        setIsModalOpen(true);
    };

    const handleToggleSelect = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setSelectedIds(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const handleToggleAll = () => {
        if (selectedIds.length === filteredDrafts.length) {
            setSelectedIds([]);
        } else {
            setSelectedIds(filteredDrafts.map(e => e.id));
        }
    };

    const getStatusStyles = (status: string) => {
        switch (status.toUpperCase()) {
            case 'APPROVED': case 'PAID': case 'REIMBURSED':
                return "text-emerald-600 bg-emerald-50 border-emerald-200";
            case 'PENDING_APPROVAL': case 'SUBMITTED':
                return "text-blue-600 bg-blue-50 border-blue-200";
            case 'ADJUSTMENT_REQUIRED':
                return "text-amber-600 bg-amber-50 border-amber-200";
            case 'REJECTED':
                return "text-rose-600 bg-rose-50 border-rose-200";
            default:
                return "text-gray-600 bg-gray-50 border-gray-200";
        }
    };

    return (
        <div className="flex -mt-[22px] -mx-[26px] -mb-[52px] min-h-[calc(100vh-64px)] animate-fade-in-up font-sans">

            {/* Left Sidebar */}
            <aside className="w-[220px] shrink-0 border-r border-indigo-100 bg-violet-50 flex flex-col sticky top-0 h-[calc(100vh-64px)] overflow-y-auto">
                <div className="px-5 pt-6 pb-4 border-b border-indigo-100">
                    <h1 className="text-sm font-semibold text-slate-900 tracking-tight">My Emergencies</h1>
                    <p className="text-[11px] text-slate-500 mt-0.5">Track and submit your expenditures</p>
                </div>
                <nav className="flex-1 divide-y divide-indigo-100/60">
                    <button
                        onClick={() => setActiveTab('pending')}
                        className={cn(
                            "w-full flex items-center gap-3 px-5 py-4 border-l-[3px] text-sm font-medium transition-all text-left",
                            activeTab === 'pending' ? "border-[#6366F1] bg-white/70 text-[#6366F1]" : "border-indigo-200 text-slate-500 hover:bg-white/50 hover:text-slate-800"
                        )}
                    >
                        <PiClock className="shrink-0 text-base" />
                        <span className="flex-1 truncate">Pending Drafts</span>
                        {draftExpenses.length > 0 && (
                            <span className={cn(
                                "text-[10px] font-semibold px-1.5 py-0.5 rounded-full min-w-[20px] text-center",
                                activeTab === 'pending' ? "bg-[#6366F1]/15 text-[#6366F1]" : "bg-white/70 text-slate-500"
                            )}>{draftExpenses.length}</span>
                        )}
                    </button>
                    <button
                        onClick={() => setActiveTab('history')}
                        className={cn(
                            "w-full flex items-center gap-3 px-5 py-4 border-l-[3px] text-sm font-medium transition-all text-left",
                            activeTab === 'history' ? "border-[#6366F1] bg-white/70 text-[#6366F1]" : "border-indigo-200 text-slate-500 hover:bg-white/50 hover:text-slate-800"
                        )}
                    >
                        <PiFileText className="shrink-0 text-base" />
                        <span className="flex-1 truncate">History</span>
                        {submittedExpenses.length > 0 && (
                            <span className={cn(
                                "text-[10px] font-semibold px-1.5 py-0.5 rounded-full min-w-[20px] text-center",
                                activeTab === 'history' ? "bg-[#6366F1]/15 text-[#6366F1]" : "bg-white/70 text-slate-500"
                            )}>{submittedExpenses.length}</span>
                        )}
                    </button>
                </nav>
                <div className="p-3 border-t border-indigo-100">
                    <Button
                        onClick={() => setShowEmergencyAlert(true)}
                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white shadow-none font-semibold rounded-md h-9 px-4 text-xs justify-center"
                    >
                        <PiPlus className="mr-2 text-base" />
                        New Emergency
                    </Button>
                </div>
            </aside>

            {/* Main Content */}
            <div className="flex-1 min-w-0 p-6 pb-12 space-y-6">

            {/* Global Stats Bar */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Active Pending Values */}
 <div className="glass-card glass-frost p-5 flex items-center justify-between">
                    <div>
                        <h3 className="text-[10px] font-semibold tracking-widest uppercase text-slate-500 mb-1">
                            {selectedIds.length > 0 ? 'Selected To Submit' : 'Unsubmitted Drafts'}
                        </h3>
                        <p className="text-3xl font-semibold tracking-tight text-slate-900">
                            ${(selectedIds.length > 0
                                ? draftExpenses.filter(e => selectedIds.includes(e.id)).reduce((sum, e) => sum + e.amount, 0)
                                : unsubmittedAmount
                            ).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </p>
                        <p className="text-[11px] text-slate-500 mt-1 font-medium">
                            {selectedIds.length > 0
                                ? `${selectedIds.length} items configured for dispatch`
                                : `${draftExpenses.length} items awaiting submission`}
                        </p>
                    </div>
                    
                    <div className="shrink-0 ml-4">
                        <Button
                            onClick={() => setShowConfirmSubmit(true)}
                            disabled={(selectedIds.length === 0 && unsubmittedAmount === 0) || isSubmitting}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-none font-semibold rounded-md h-9 px-5 text-xs touch-manipulation disabled:opacity-50"
                        >
                            {isSubmitting ? <PiSpinner className="animate-spin mr-2" /> : null}
                            {isSubmitting ? 'Submitting...' : (selectedIds.length > 0 ? `Submit Selected` : 'Submit Report')}
                        </Button>
                    </div>
                </div>

                {/* Policy Snippet */}
 <div className="glass-card glass-frost p-5 flex items-center gap-5">
                    <div className="w-10 h-10 rounded-lg bg-slate-50 border border-slate-100 text-slate-500 flex items-center justify-center shrink-0">
                        <PiWarningCircle className="text-xl" />
                    </div>
                    <div className="text-sm text-slate-600">
                        <h3 className="text-xs font-semibold text-slate-900 mb-0.5 uppercase tracking-wide">Policy Information</h3>
                        <ul className="list-disc pl-4 space-y-0.5 text-[11px] font-medium text-slate-500">
                            <li>Receipts mandatory for items over <strong className="text-slate-700">$25.00</strong>.</li>
                            <li>Mileage rate is <strong className="text-slate-700">$0.67</strong>/mile.</li>
                            <li>Reports due by the <strong className="text-slate-700">5th of each month</strong>.</li>
                        </ul>
                    </div>
                </div>
            </div>

            <div className="flex items-center justify-between flex-wrap gap-3 bg-white/60 border border-slate-200 rounded-lg px-3 py-2">
                <DateRangeFilter value={dateRange} onChange={setDateRange} />
            </div>

            {activeTab === 'pending' && filteredDrafts.length > 0 && (
                <div className="flex justify-end">
                    <button
                        onClick={handleToggleAll}
                        className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500 hover:text-slate-800 transition-colors bg-white border border-slate-200 px-3 py-1.5 rounded-md shadow-sm"
                    >
                        {selectedIds.length === filteredDrafts.length ? <PiCheckSquare className="text-base text-emerald-600" /> : <PiSquare className="text-base" />}
                        {selectedIds.length === filteredDrafts.length ? 'Deselect All' : 'Select All'}
                    </button>
                </div>
            )}

            {/* Content Queue */}
            {activeTab === 'pending' ? (
 <div className="glass-card glass-frost overflow-hidden">
                    {filteredDrafts.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 bg-slate-50/50">
                            <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4 border border-slate-200">
                                <PiReceipt className="text-2xl text-slate-400" />
                            </div>
                            <h3 className="text-slate-900 font-semibold mb-1">
                                {draftExpenses.length === 0 ? 'No Draft Emergencies' : 'No drafts in this date range'}
                            </h3>
                            <p className="text-slate-500 text-sm">
                                {draftExpenses.length === 0 ? "You're all caught up. Create an emergency to begin." : 'Try clearing or widening the date filter.'}
                            </p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="border-b border-slate-200 bg-slate-50">
                                        <th className="py-3 px-4 font-semibold text-[11px] text-slate-500 uppercase tracking-wider w-10"></th>
                                        <th className="py-3 px-4 font-semibold text-[11px] text-slate-500 uppercase tracking-wider">Expense Details</th>
                                        <th className="py-3 px-4 font-semibold text-[11px] text-slate-500 uppercase tracking-wider">Cost Center</th>
                                        <th className="py-3 px-4 font-semibold text-[11px] text-slate-500 uppercase tracking-wider text-right">Amount</th>
                                        <th className="py-3 px-4 font-semibold text-[11px] text-slate-500 uppercase tracking-wider text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {filteredDrafts.map((exp: any) => (
                                        <tr 
                                            key={exp.id} 
                                            className={cn(
                                                "group hover:bg-slate-50/50 transition-colors cursor-pointer",
                                                selectedIds.includes(exp.id) && "bg-emerald-50/30"
                                            )}
                                            onClick={() => handleExpenseClick(exp)}
                                        >
                                            <td className="py-4 px-4 align-top w-10">
                                                <div 
                                                    className="inline-block p-1 hover:bg-slate-200/50 rounded transition-colors -ml-1 mt-0.5"
                                                    onClick={(e) => handleToggleSelect(exp.id, e)}
                                                >
                                                    {selectedIds.includes(exp.id) ? (
                                                        <PiCheckSquare className="text-xl text-emerald-600" />
                                                    ) : (
                                                        <PiSquare className="text-xl text-slate-300" />
                                                    )}
                                                </div>
                                            </td>
                                            <td className="py-4 px-4 align-top">
                                                <p className="font-semibold text-slate-900 text-sm">{exp.title}</p>
                                                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                                    <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider bg-slate-100 px-2 py-0.5 rounded border border-slate-200">{exp.category}</span>
                                                    {exp.expenseDate && (
                                                        <span className="text-[10.5px] text-slate-400">
                                                            {new Date(exp.expenseDate).toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                                                        </span>
                                                    )}
                                                    {exp.merchant && <span className="text-[10.5px] text-slate-500">· {exp.merchant}</span>}
                                                    {exp.receiptUrl && <span className="text-[10px] text-emerald-600 bg-emerald-50 border border-emerald-100 flex items-center gap-1 font-semibold px-2 py-0.5 rounded"><PiCheckCircle /> Receipt</span>}
                                                    {exp.etrNumber && (
                                                        <span className={`text-[10px] flex items-center gap-1 font-semibold px-2 py-0.5 rounded border font-mono ${exp.etrVerified ? 'text-indigo-700 bg-indigo-50 border-indigo-100' : 'text-amber-700 bg-amber-50 border-amber-100'}`}>
                                                            {exp.etrVerified ? <PiCheckCircle /> : <PiWarningCircle />}
                                                            ETR{exp.etrVerified ? ' ✓' : ' ?'}
                                                        </span>
                                                    )}
                                                </div>
                                                {exp.description && (
                                                    <p className="text-[11.5px] text-slate-500 mt-1.5 max-w-md truncate" title={exp.description}>{exp.description}</p>
                                                )}
                                            </td>
                                            <td className="py-4 px-4 align-top">
                                                {exp.costCenter ? (
                                                    <span className={cn(
                                                        "inline-flex text-[10px] uppercase font-semibold tracking-wider px-2 py-0.5 rounded border text-slate-600 bg-slate-50 border-slate-200"
                                                    )}>{exp.costCenter}</span>
                                                ) : <span className="text-xs text-slate-400">-</span>}
                                            </td>
                                            <td className="py-4 px-4 align-top text-right">
                                                <p className="font-semibold text-slate-900">${exp.amount.toFixed(2)}</p>
                                                <span className="text-[10px] font-semibold text-slate-400 mt-1 block">TBD</span>
                                            </td>
                                            <td className="py-4 px-4 align-top text-right">
                                                <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    {isAdmin && (
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); setExpenseToReject(exp); }}
                                                            disabled={isRejecting === exp.id}
                                                            className="h-8 px-3 rounded-md text-xs font-semibold bg-orange-50 text-orange-600 hover:bg-orange-100 transition-colors border border-orange-200 flex items-center disabled:opacity-50"
                                                        >
                                                            {isRejecting === exp.id ? <PiSpinner className="animate-spin text-sm" /> : <PiProhibit className="text-sm mr-1.5" />}
                                                            Reject
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); setExpenseToDelete(exp); }}
                                                        disabled={isDeleting === exp.id}
                                                        className="h-8 px-3 rounded-md text-xs font-semibold bg-red-50 text-red-600 hover:bg-red-100 transition-colors border border-red-200 flex items-center disabled:opacity-50"
                                                    >
                                                        {isDeleting === exp.id ? <PiSpinner className="animate-spin text-sm" /> : <PiTrash className="text-sm mr-1.5" />}
                                                        Discard
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
            ) : (
 <div className="glass-card glass-frost overflow-hidden">
                    {filteredSubmitted.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 bg-slate-50/50">
                            <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4 border border-slate-200">
                                <PiClock className="text-2xl text-slate-400" />
                            </div>
                            <h3 className="text-slate-900 font-semibold mb-1">
                                {submittedExpenses.length === 0 ? 'No Expense History' : 'No history in this date range'}
                            </h3>
                            <p className="text-slate-500 text-sm">
                                {submittedExpenses.length === 0 ? 'Past submitted items will appear here.' : 'Try clearing or widening the date filter.'}
                            </p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="border-b border-slate-200 bg-slate-50">
                                        <th className="py-3 px-4 font-semibold text-[11px] text-slate-500 uppercase tracking-wider">Date & Info</th>
                                        <th className="py-3 px-4 font-semibold text-[11px] text-slate-500 uppercase tracking-wider">Amount</th>
                                        <th className="py-3 px-4 font-semibold text-[11px] text-slate-500 uppercase tracking-wider w-32">Status</th>
                                        <th className="py-3 px-4 font-semibold text-[11px] text-slate-500 uppercase tracking-wider text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {filteredSubmitted.map((exp: any) => (
                                        <tr key={exp.id} className="hover:bg-slate-50/50 transition-colors cursor-pointer group" onClick={() => handleExpenseClick(exp)}>
                                            <td className="py-4 px-4 align-top">
                                                <p className="font-semibold text-slate-900 text-sm">{exp.title}</p>
                                                <div className="text-xs text-slate-500 mt-1 flex items-center gap-1.5 flex-wrap">
                                                    <span>{new Date(exp.expenseDate).toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>
                                                    <span className="text-slate-300">•</span>
                                                    <span>{exp.category}</span>
                                                    {exp.merchant && (
                                                        <>
                                                            <span className="text-slate-300">•</span>
                                                            <span>{exp.merchant}</span>
                                                        </>
                                                    )}
                                                    {exp.costCenter && (
                                                        <>
                                                            <span className="text-slate-300">•</span>
                                                            <span className="text-slate-700 font-medium">{exp.costCenter}</span>
                                                        </>
                                                    )}
                                                </div>
                                                {exp.description && (
                                                    <p className="text-[11.5px] text-slate-500 mt-1.5 max-w-md truncate" title={exp.description}>{exp.description}</p>
                                                )}
                                                {exp.approvals && exp.approvals.length > 0 && exp.approvals[0].comments && (
                                                    <div className="mt-2 p-2 bg-orange-50 border border-orange-100 rounded text-[11px] text-orange-700 italic max-w-lg">
                                                        <strong className="font-semibold">Note:</strong> {exp.approvals[0].comments}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="py-4 px-4 align-top">
                                                <p className="font-semibold text-slate-900">${exp.amount.toFixed(2)}</p>
                                            </td>
                                            <td className="py-4 px-4 align-top">
                                                <span className={cn("inline-flex text-[10px] font-semibold px-2.5 py-1 rounded-md border uppercase tracking-wider text-center", getStatusStyles(exp.status))}>
                                                    {exp.status.replace('_', ' ')}
                                                </span>
                                            </td>
                                            <td className="py-4 px-4 align-top text-right">
                                                {['APPROVED', 'PAID', 'REIMBURSED'].includes(exp.status.toUpperCase()) && (
                                                    <a
                                                        href={`/receipt-studio?expenseId=${exp.id}`}
                                                        onClick={(e) => e.stopPropagation()}
                                                        className="inline-flex items-center gap-1 h-8 px-3 rounded-md text-xs font-semibold bg-[#6366F1]/5 text-[#6366F1] hover:bg-[#6366F1]/10 transition-colors border border-[#6366F1]/10"
                                                    >
                                                        <PiFileText className="text-sm" />
                                                        Voucher
                                                    </a>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

                <UnifiedExpenseModal
                    isOpen={isModalOpen}
                    onClose={() => {
                        setIsModalOpen(false);
                        setViewingExpense(null);
                    }}
                    mode="full"
                    expense={viewingExpense}
                />

                <ConfirmationModal
                    isOpen={showEmergencyAlert}
                    onClose={() => setShowEmergencyAlert(false)}
                    onConfirm={() => {
                        setShowEmergencyAlert(false);
                        setViewingExpense(null);
                        setIsModalOpen(true);
                    }}
                    onCancel={() => {
                        window.location.href = '/dashboard/requisitions/new';
                    }}
                    title="Emergency Form Confirmation"
                    description="Note: The Emergency form is specifically for urgent requests that require immediate action. For all non-urgent business expenditures, please use the standard Expense form."
                    confirmText="Yes, Proceed to Emergency"
                    cancelText="Use Standard Expense"
                    variant="info"
                />

                <ConfirmationModal
                    isOpen={showConfirmSubmit}
                    onClose={() => setShowConfirmSubmit(false)}
                    onConfirm={handleSubmitReport}
                    title={selectedIds.length > 0 ? "Submit Selected Expenses?" : "Submit All Expenses?"}
                    description={selectedIds.length > 0 
                        ? `Are you sure you want to submit the ${selectedIds.length} selected expenses for approval?`
                        : "Are you sure you want to submit all pending drafts for approval? This will send them to your manager for review."
                    }
                    confirmText={selectedIds.length > 0 ? "Yes, Submit Selected" : "Yes, Submit All"}
                    variant="info"
                    isLoading={isSubmitting}
                />

                <ConfirmationModal
                    isOpen={!!expenseToDelete}
                    onClose={() => setExpenseToDelete(null)}
                    onConfirm={handleDeleteExpense}
                    title="Delete Expense?"
                    description={`Are you sure you want to delete "${expenseToDelete?.title}"? This action cannot be undone.`}
                    confirmText="Delete"
                    variant="danger"
                    isLoading={!!isDeleting}
                />

                <ConfirmationModal
                    isOpen={!!expenseToReject}
                    onClose={() => setExpenseToReject(null)}
                    onConfirm={handleRejectExpense}
                    title="Reject Expense?"
                    description={`Are you sure you want to reject "${expenseToReject?.title}"? The item will be marked as REJECTED but not deleted.`}
                    confirmText="Reject"
                    variant="danger"
                    isLoading={!!isRejecting}
                />
            </div>
        </div>
    );
}
