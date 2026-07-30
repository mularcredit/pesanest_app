"use client";


import { createPortal } from "react-dom";
import { useState, useEffect } from "react";
import { useToast } from "@/components/ui/ToastProvider";
import {
    PiHandCoins,
    PiCheckCircle,
    PiReceipt,
    PiUser,
    PiBank,
    PiClock,
    PiEye,
    PiArrowRight,
    PiX,
    PiMoney,
    PiTrendUp,
    PiWarningCircle,
    PiFileText,
    PiBuildings,
    PiInfo,
    PiLightbulb,
    PiCaretLeft,
    PiCaretRight,
    PiFunnel,
    PiGlobe,
    PiWallet,
    PiListBullets,
    PiGridFour,
    PiTag,
    PiStackSimple,
} from "react-icons/pi";
import { PiCheckSquare as CheckSquare, PiSquare as Square } from "react-icons/pi";
import { cn } from "@/lib/utils";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { estimatePaystackPayoutFee } from "@/lib/payments/paymentFees";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { ReconcileModal, BatchForReconcile } from "@/components/dashboard/ReconcileModal";

// Types
interface UserBasic {
    name: string | null;
    email: string | null;
    department?: string | null;
    bankAccount?: string | null;
}

interface ReceiptVerificationSummary {
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

interface Expense {
    id: string;
    title: string;
    amount: number;
    currency: string;
    category: string;
    merchant: string | null;
    receiptUrl: string | null;
    etrNumber?: string | null;
    updatedAt: Date;
    user: UserBasic;
    receiptVerification?: ReceiptVerificationSummary | null;
}

interface Invoice {
    id: string;
    invoiceNumber: string;
    vendor: { name: string };
    amount: number;
    currency: string;
    dueDate: Date;
    description: string | null;
    createdBy: UserBasic;
}

interface Requisition {
    id: string;
    title: string;
    amount: number;
    currency: string;
    category: string;
    updatedAt: Date;
    user: UserBasic;
}

interface Budget {
    id: string;
    month: number;
    year: number;
    totalAmount: number;
    currency?: string;
    branch: string;
    department: string;
    user: UserBasic;
}

interface PaymentBatch {
    id: string;
    amount: number;
    currency: string;
    status: string;
    method: string;
    notes: string | null;
    createdAt: Date;
    maker: UserBasic;
    _count?: {
        invoices: number;
        expenses: number;
        requisitions?: number;
        monthlyBudgets?: number;
    };
    expenses?: Expense[];
    requisitions?: {
        id: string;
        title: string;
        amount: number;
        currency: string;
        category: string;
        receiptUrl: string | null;
        etrNumber: string | null;
        etrVerified: boolean;
        user: { name: string | null; email: string | null };
    }[];
}

interface PaymentQueueProps {
    expenses: Expense[];
    invoices: Invoice[];
    requisitions?: Requisition[];
    budgets?: Budget[];
    pendingPayments: PaymentBatch[];
    authorizedPayments?: PaymentBatch[];
    paidPayments?: PaymentBatch[];
    history: any[];
    userRole: string;
    paystackStatus?: string;
    isSystemAdmin?: boolean;
}

export function PaymentQueue({
    expenses = [],
    invoices = [],
    requisitions = [],
    budgets = [],
    pendingPayments = [],
    authorizedPayments = [],
    paidPayments = [],
    history = [],
    userRole,
    paystackStatus = 'NOT_CONNECTED',
    isSystemAdmin = false
}: PaymentQueueProps) {
    const { showToast } = useToast();
    const router = useRouter();

    const formatAmount = (amount: number, currency: string = 'KES') => {
        const symbol = currency === 'USD' ? '$' : (currency === 'KES' ? 'KSh' : currency);
        return `${symbol} ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };

    const getDefaultTab = () => {
        const isFinance = ['FINANCE_TEAM', 'FINANCE_APPROVER', 'SYSTEM_ADMIN'].includes(userRole);
        const canApprove = ['FINANCE_APPROVER', 'MANAGER', 'SYSTEM_ADMIN'].includes(userRole);

        // Follow the natural workflow order so users always land on the most urgent/earliest stage
        if (pendingPayments.length > 0 && canApprove) return 'approvals';
        if (authorizedPayments.length > 0 && isFinance) return 'disbursements';
        if (expenses.length > 0 || invoices.length > 0 || requisitions.length > 0 || budgets.length > 0) return 'payables';
        if (paidPayments.length > 0 && isFinance) return 'closing';
        return 'history';
    }

    const [activeTab, setActiveTab] = useState<'payables' | 'approvals' | 'disbursements' | 'closing' | 'history'>(getDefaultTab());
    const [selectedExpenses, setSelectedExpenses] = useState<Set<string>>(new Set());
    const [selectedInvoices, setSelectedInvoices] = useState<Set<string>>(new Set());
    const [selectedRequisitions, setSelectedRequisitions] = useState<Set<string>>(new Set());
    const [selectedBudgets, setSelectedBudgets] = useState<Set<string>>(new Set());
    const [failureDetails, setFailureDetails] = useState<{ details: any[], summary: any } | null>(null);
    const [isFailureModalOpen, setIsFailureModalOpen] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [showBypassModal, setShowBypassModal] = useState(false);
    const [showHelp, setShowHelp] = useState(true);
    const [paymentMethod, setPaymentMethod] = useState<'WALLET' | 'BRANCH_WALLET' | 'CASH'>('WALLET');
    const [mounted, setMounted] = useState(false);
    // Default to list view for compact readability
    const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');

    useEffect(() => {
        setMounted(true);
    }, []);

    const [confirmationModal, setConfirmationModal] = useState<{
        isOpen: boolean;
        paymentId: string;
        action: 'AUTHORIZE' | 'REJECT' | 'DISBURSE' | 'CLOSE';
        paymentMethod?: 'WALLET' | 'BRANCH_WALLET' | 'CASH';
        amount?: number;
        currency?: string;
        itemCount?: number;
    } | null>(null);

    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 7; // Show 7 items per page for a cleaner look

    // Calculate pagination
    const totalPages = Math.ceil(history.length / itemsPerPage);
    const currentHistory = history.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    const toggleExpense = (id: string) => {
        const newSet = new Set(selectedExpenses);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedExpenses(newSet);
    };

    const toggleInvoice = (id: string) => {
        const newSet = new Set(selectedInvoices);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedInvoices(newSet);
    };

    const toggleRequisition = (id: string) => {
        const newSet = new Set(selectedRequisitions);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedRequisitions(newSet);
    };

    const toggleBudget = (id: string) => {
        const newSet = new Set(selectedBudgets);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedBudgets(newSet);
    };

    const totalSelectedAmount =
        expenses.filter(e => selectedExpenses.has(e.id)).reduce((sum, e) => sum + e.amount, 0) +
        invoices.filter(i => selectedInvoices.has(i.id)).reduce((sum, i) => sum + i.amount, 0) +
        requisitions.filter(r => selectedRequisitions.has(r.id)).reduce((sum, r) => sum + r.amount, 0) +
        budgets.filter(b => selectedBudgets.has(b.id)).reduce((sum, b) => sum + b.totalAmount, 0);

    const handleCreateBatch = async (bypassed: boolean = false) => {
        if (selectedExpenses.size === 0 && selectedInvoices.size === 0 && selectedRequisitions.size === 0 && selectedBudgets.size === 0) return;

        setIsProcessing(true);
        try {
            const promises: Promise<any>[] = [];

            const addRequests = (idSet: Set<string>, idKey: string) => {
                for (const id of Array.from(idSet)) {
                    promises.push(
                        fetch('/api/payments', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                expenseIds: idKey === 'expenseIds' ? [id] : [],
                                invoiceIds: idKey === 'invoiceIds' ? [id] : [],
                                requisitionIds: idKey === 'requisitionIds' ? [id] : [],
                                budgetIds: idKey === 'budgetIds' ? [id] : [],
                                method: 'BANK_TRANSFER',
                                notes: `Payment for item`,
                                skipAuthorization: bypassed
                            })
                        }).then(async (res) => {
                            const data = await res.json();
                            if (!res.ok) throw new Error(data.error || 'Failed to create payment');
                            return data;
                        })
                    );
                }
            };

            addRequests(selectedExpenses, 'expenseIds');
            addRequests(selectedInvoices, 'invoiceIds');
            addRequests(selectedRequisitions, 'requisitionIds');
            addRequests(selectedBudgets, 'budgetIds');

            await Promise.all(promises);

            showToast(bypassed ? 'Batch routed directly to Remittance.' : 'Payments created! Awaiting authorization.', 'success');
            setSelectedExpenses(new Set());
            setSelectedInvoices(new Set());
            setSelectedRequisitions(new Set());
            setSelectedBudgets(new Set());
            router.refresh();
            setActiveTab(bypassed ? 'disbursements' : 'approvals');
            setShowBypassModal(false);
        } catch (error: any) {
            showToast(error.message || 'Error occurred while creating payments', 'error');
        } finally {
            setIsProcessing(false);
        }
    };

    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [reconcileBatch, setReconcileBatch] = useState<BatchForReconcile | null>(null);

    const handleAuthorization = (paymentId: string, action: 'AUTHORIZE' | 'REJECT' | 'DISBURSE' | 'CLOSE') => {
        const batch = [...pendingPayments, ...authorizedPayments, ...paidPayments].find(p => p.id === paymentId);
        setConfirmationModal({ 
            isOpen: true, 
            paymentId, 
            action, 
            paymentMethod: paymentMethod,
            amount: batch?.amount || 0,
            currency: batch?.currency || 'KES',
            itemCount: (batch?._count?.requisitions || 0) + (batch?._count?.expenses || 0) + (batch?._count?.invoices || 0) || 1
        });
        setSelectedFile(null); // Reset file selection
    };

    const proceedAuthorization = async () => {
        if (!confirmationModal) return;
        const { paymentId, action } = confirmationModal;

        setIsProcessing(true);
        try {
            let noteAttachment = "";

            if (action === 'DISBURSE' && selectedFile) {
                const formData = new FormData();
                formData.append('file', selectedFile);

                const uploadRes = await fetch('/api/upload', {
                    method: 'POST',
                    body: formData
                });

                const uploadData = await uploadRes.json();
                if (!uploadRes.ok) throw new Error(uploadData.error || 'Failed to upload proof of payment');

                noteAttachment = ` [Proof: ${uploadData.url}]`;
            }

            const response = await fetch('/api/payments/action', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    paymentId,
                    action,
                    paymentMethod: paymentMethod || 'WALLET',
                    proofUrl: noteAttachment ? noteAttachment.replace(' [Proof: ', '').replace(']', '') : undefined
                })
            });

            // Update: I will update the route to accept notes/proofUrl because user requirement is strict.
            // But first let's get the UI working. The upload works.

            const data = await response.json();
            if (!response.ok) throw new Error(data.error);

            let successMessage = '';
            let toastType: 'success' | 'warning' | 'error' = 'success';

            if (action === 'DISBURSE' && data.summary) {
                const { success, failed, details } = data.summary;
                
                if (failed > 0) {
                    setFailureDetails({ details, summary: data.summary });
                    setIsFailureModalOpen(true);
                    
                    if (success > 0) {
                        successMessage = `Partial Payout: ${success} successful, ${failed} failed.`;
                        toastType = 'warning';
                    } else {
                        successMessage = `Payout Failed: All ${failed} transfers failed.`;
                        toastType = 'error';
                    }
                } else {
                    successMessage = `Payout Successful: ${success} transfers completed.`;
                    toastType = 'success';
                    setIsFailureModalOpen(false);
                }
            } else {
                successMessage = action === 'AUTHORIZE'
                    ? 'Payment Authorized & ready for payout'
                    : action === 'CLOSE'
                        ? 'Payment closed successfully'
                        : 'Payment Rejected';
            }

            if (toastType !== 'error' || !data.summary) {
                showToast(successMessage, toastType);
            }
            
            setConfirmationModal(null);
            router.refresh();

            if (action === 'AUTHORIZE') {
                setActiveTab('disbursements');
            } else if (action === 'DISBURSE') {
                // If it failed completely, stay here; otherwise move to closing
                if (data.summary && data.summary.success > 0) {
                    setActiveTab('closing');
                }
            }
        } catch (error: any) {
            showToast(error.message, 'error');
        } finally {
            setIsProcessing(false);
        }
    };

    const formatDate = (date: Date | string) => {
        return new Date(date).toLocaleDateString("en-US", {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        });
    };

    return (<>
        <div className="flex -mt-[22px] -mx-[26px] -mb-[52px] min-h-[calc(100vh-64px)] animate-fade-in-up">

            {/* Left Sidebar */}
            <aside className="w-[210px] shrink-0 border-r border-gray-100 bg-white flex flex-col sticky top-0 h-[calc(100vh-64px)] overflow-y-auto">
                <div className="px-5 pt-6 pb-4 border-b border-gray-100">
                    <div className="flex items-center gap-1.5 mb-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                        <span className="text-[10px] font-medium text-emerald-700 tracking-wide">System Connected</span>
                    </div>
                    <h1 className="text-sm font-semibold text-slate-900">Payment Center</h1>
                    <p className="text-[11px] text-slate-500 mt-0.5">Financial workflows</p>
                </div>
                <nav className="flex-1 divide-y divide-gray-100 px-2 py-1">
                    {([
                        { id: 'payables' as const, label: 'Payables Ledger', badge: expenses.length + invoices.length + requisitions.length + budgets.length, icon: PiReceipt },
                        { id: 'approvals' as const, label: 'Pending Auth', badge: pendingPayments.length, icon: PiCheckCircle },
                        { id: 'disbursements' as const, label: 'Remittance', badge: authorizedPayments.length, icon: PiHandCoins },
                        { id: 'closing' as const, label: 'Reconciliation', badge: paidPayments.length, icon: PiFileText },
                        { id: 'history' as const, label: 'History', badge: history.length, icon: PiListBullets },
                    ]).map((step) => {
                        const isActive = activeTab === step.id;
                        const Icon = step.icon;
                        return (
                            <button
                                key={step.id}
                                onClick={() => setActiveTab(step.id)}
                                className={cn(
                                    "w-full flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-all text-left my-0.5",
                                    isActive ? "bg-indigo-50 text-[#6366F1]" : "text-slate-500 hover:bg-gray-50 hover:text-slate-800"
                                )}
                            >
                                <Icon className="shrink-0 text-base" />
                                <span className="flex-1 truncate">{step.label}</span>
                                {step.badge > 0 && (
                                    <span className={cn(
                                        "text-[10px] font-semibold px-1.5 py-0.5 rounded-full min-w-[20px] text-center",
                                        isActive ? "bg-[#6366F1]/15 text-[#6366F1]" : "bg-gray-100 text-slate-500"
                                    )}>{step.badge}</span>
                                )}
                            </button>
                        );
                    })}
                </nav>
            </aside>

            {/* Main Content */}
            <div className="flex-1 min-w-0 p-6">


                    {/* TAB: PAYABLES */}
                    {activeTab === 'payables' && (
                        <div className="space-y-4 animate-fade-in">
                            {/* Selection Summary */}
                            {(selectedExpenses.size > 0 || selectedInvoices.size > 0 || selectedRequisitions.size > 0 || selectedBudgets.size > 0) && (
                                <div className="sticky top-4 z-[60] bg-white rounded-[10px] px-5 py-3.5 flex items-center justify-between transition-all duration-200"
                                    style={{ border: '1px solid rgba(99,102,241,0.25)', boxShadow: '0 4px 24px rgba(99,102,241,0.13)' }}>

                                    {/* Left: icon + amount + breakdown */}
                                    <div className="flex items-center gap-4">
                                        <div className="w-9 h-9 rounded-[8px] bg-indigo-50 flex items-center justify-center flex-shrink-0">
                                            <CheckSquare size={16} strokeWidth={2} className="text-[#6366F1]" />
                                        </div>
                                        <div>
                                            <p className="text-[11px] font-[500] text-gray-400 uppercase tracking-[0.07em]">
                                                {selectedExpenses.size + selectedInvoices.size + selectedRequisitions.size + selectedBudgets.size} item{(selectedExpenses.size + selectedInvoices.size + selectedRequisitions.size + selectedBudgets.size) !== 1 ? 's' : ''} selected
                                            </p>
                                            <p className="text-[16px] font-[700] text-gray-900 font-mono tabular-nums leading-tight">
                                                {formatAmount(totalSelectedAmount, 'KES')}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-1.5 ml-1">
                                            {selectedRequisitions.size > 0 && (
                                                <span className="px-2 py-0.5 rounded-[5px] bg-indigo-50 text-indigo-700 text-[10.5px] font-[600]">
                                                    {selectedRequisitions.size} REQ
                                                </span>
                                            )}
                                            {selectedBudgets.size > 0 && (
                                                <span className="px-2 py-0.5 rounded-[5px] bg-violet-50 text-violet-700 text-[10.5px] font-[600]">
                                                    {selectedBudgets.size} BUD
                                                </span>
                                            )}
                                            {selectedInvoices.size > 0 && (
                                                <span className="px-2 py-0.5 rounded-[5px] bg-sky-50 text-sky-700 text-[10.5px] font-[600]">
                                                    {selectedInvoices.size} INV
                                                </span>
                                            )}
                                            {selectedExpenses.size > 0 && (
                                                <span className="px-2 py-0.5 rounded-[5px] bg-emerald-50 text-emerald-700 text-[10.5px] font-[600]">
                                                    {selectedExpenses.size} EXP
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Right: clear + process */}
                                    <div className="flex items-center gap-3">
                                        <button
                                            onClick={() => {
                                                setSelectedExpenses(new Set());
                                                setSelectedInvoices(new Set());
                                                setSelectedRequisitions(new Set());
                                                setSelectedBudgets(new Set());
                                            }}
                                            className="text-[12px] font-[500] text-gray-400 hover:text-gray-700 transition-colors px-2 py-1.5"
                                        >
                                            Clear
                                        </button>
                                        <button
                                            onClick={() => isSystemAdmin ? setShowBypassModal(true) : handleCreateBatch(false)}
                                            disabled={isProcessing}
                                            className="flex items-center gap-2 px-5 py-2 bg-[#6366F1] hover:bg-indigo-700 text-white rounded-[7px] text-[12.5px] font-[600] transition-colors disabled:opacity-50"
                                        >
                                            {isProcessing && <PiClock className="animate-spin text-sm" />}
                                            Process Selection
                                        </button>
                                    </div>
                                </div>
                            )}

                            <div className="space-y-6">
                                {expenses.length === 0 && invoices.length === 0 && requisitions.length === 0 && budgets.length === 0 ? (
 <div className="p-12 text-center border border-slate-300 rounded-none">
                                        <p className="font-mono text-[11px] font-semibold text-slate-900 tracking-widest uppercase">No Payables Pending</p>
                                    </div>
                                ) : (
                                    <>
                                        {/* Select All Action */}
                                        <div className="flex items-center justify-between px-2">
                                            <h3 className="text-sm font-semibold text-slate-800 tracking-wide">Available Payables</h3>
                                            <button
                                                onClick={() => {
                                                    const totalItems = expenses.length + invoices.length + requisitions.length + budgets.length;
                                                    const totalSelected = selectedExpenses.size + selectedInvoices.size + selectedRequisitions.size + selectedBudgets.size;
                                                    const isAllSelected = totalItems > 0 && totalItems === totalSelected;

                                                    if (isAllSelected) {
                                                        setSelectedExpenses(new Set());
                                                        setSelectedInvoices(new Set());
                                                        setSelectedRequisitions(new Set());
                                                        setSelectedBudgets(new Set());
                                                    } else {
                                                        setSelectedExpenses(new Set(expenses.map(e => e.id)));
                                                        setSelectedInvoices(new Set(invoices.map(i => i.id)));
                                                        setSelectedRequisitions(new Set(requisitions.map(r => r.id)));
                                                        setSelectedBudgets(new Set(budgets.map(b => b.id)));
                                                    }
                                                }}
                                                className="text-[11px] font-semibold text-slate-700 hover:text-indigo-600 transition-colors bg-white hover:bg-slate-50 px-4 py-2 rounded-lg flex items-center gap-2 border border-slate-200 shadow-sm"
                                            >
                                                {(() => {
                                                    const totalItems = expenses.length + invoices.length + requisitions.length + budgets.length;
                                                    const totalSelected = selectedExpenses.size + selectedInvoices.size + selectedRequisitions.size + selectedBudgets.size;
                                                    const isAllSelected = totalItems > 0 && totalItems === totalSelected;
                                                    return (
                                                        <>
                                                            {isAllSelected
                                                                ? <CheckSquare size={15} strokeWidth={2} className="text-[#6366F1] flex-shrink-0" />
                                                                : <Square size={15} strokeWidth={1.5} className="text-gray-400 flex-shrink-0" />
                                                            }
                                                            {isAllSelected ? 'Deselect All' : 'Select All Items'}
                                                        </>
                                                    );
                                                })()}
                                            </button>
                                        </div>

                                        {/* Requisitions Section */}
                                        {requisitions.length > 0 && (
 <div className="bg-white rounded-[8px] overflow-hidden mb-6" style={{border:'1px solid rgba(0,0,0,0.09)'}}>
                                                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50/50">
                                                    <div className="flex items-center gap-3">
                                                        <h3 className="text-[13px] font-semibold text-slate-800 tracking-wide">Expenses</h3>
                                                        <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-md text-[10px] font-semibold border border-indigo-100">{requisitions.length} Items</span>
                                                    </div>
                                                    <button
                                                        onClick={() => {
                                                            const allSelected = requisitions.every(r => selectedRequisitions.has(r.id));
                                                            if (allSelected) setSelectedRequisitions(new Set());
                                                            else setSelectedRequisitions(new Set(requisitions.map(r => r.id)));
                                                        }}
                                                        className="text-[11px] font-semibold text-slate-500 hover:text-indigo-600 transition-colors bg-white px-3 py-1.5 border border-slate-200 rounded-lg shadow-sm"
                                                    >
                                                        {requisitions.every(r => selectedRequisitions.has(r.id)) ? 'Deselect All' : 'Select All'}
                                                    </button>
                                                </div>
                                                <div className="overflow-x-auto">
                                                    <table className="w-full text-left text-[12px] whitespace-nowrap">
                                                        <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider text-[10px] font-semibold">
                                                            <tr>
                                                                <th className="px-4 py-3 w-10 text-center">Sel</th>
                                                                <th className="px-4 py-3">Ref ID</th>
                                                                <th className="px-4 py-3">Description</th>
                                                                <th className="px-4 py-3">Beneficiary</th>
                                                                <th className="px-4 py-3 text-right">Amount</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-slate-100">
                                                            {requisitions.map(req => (
                                                                <tr
                                                                    key={req.id}
                                                                    className={cn(
                                                                        "group cursor-pointer hover:bg-slate-50 transition-colors",
                                                                        selectedRequisitions.has(req.id) ? "bg-indigo-50/30" : ""
                                                                    )}
                                                                    onClick={() => toggleRequisition(req.id)}
                                                                >
                                                                    <td className="px-4 py-3 flex items-center justify-center">
                                                                        {selectedRequisitions.has(req.id)
                                                                            ? <CheckSquare size={15} strokeWidth={2} className="text-[#6366F1] flex-shrink-0" />
                                                                            : <Square size={15} strokeWidth={1.5} className="text-gray-300 flex-shrink-0 group-hover:text-gray-500" />
                                                                        }
                                                                    </td>
                                                                    <td className="px-4 py-3 font-mono text-[11px] text-slate-500">REQ-{req.id.substring(0, 8).toUpperCase()}</td>
                                                                    <td className="px-4 py-3 font-medium text-slate-800">{req.title}</td>
                                                                    <td className="px-4 py-3">
                                                                        <div className="flex items-center gap-2">
                                                                            <span className="w-5 h-5 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-[8px] font-semibold text-slate-500">USR</span>
                                                                            <p className="font-medium text-slate-700">{req.user.name}</p>
                                                                        </div>
                                                                    </td>
                                                                    <td className="px-4 py-3 text-right font-semibold text-slate-900">{formatAmount(req.amount, req.currency)}</td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        )}

                                        {/* Budgets Section */}
                                        {budgets.length > 0 && (
 <div className="bg-white rounded-[8px] overflow-hidden mb-6" style={{border:'1px solid rgba(0,0,0,0.09)'}}>
                                                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50/50">
                                                    <div className="flex items-center gap-3">
                                                        <h3 className="text-[13px] font-semibold text-slate-800 tracking-wide">Monthly Budgets</h3>
                                                        <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-md text-[10px] font-semibold border border-indigo-100">{budgets.length} Items</span>
                                                    </div>
                                                    <button
                                                        onClick={() => {
                                                            const allSelected = budgets.every(b => selectedBudgets.has(b.id));
                                                            if (allSelected) setSelectedBudgets(new Set());
                                                            else setSelectedBudgets(new Set(budgets.map(b => b.id)));
                                                        }}
                                                        className="text-[11px] font-semibold text-slate-500 hover:text-indigo-600 transition-colors bg-white px-3 py-1.5 border border-slate-200 rounded-lg shadow-sm"
                                                    >
                                                        {budgets.every(b => selectedBudgets.has(b.id)) ? 'Deselect All' : 'Select All'}
                                                    </button>
                                                </div>
                                                <div className="overflow-x-auto">
                                                    <table className="w-full text-left text-[12px] whitespace-nowrap">
                                                        <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider text-[10px] font-semibold">
                                                            <tr>
                                                                <th className="px-4 py-3 w-10 text-center">Sel</th>
                                                                <th className="px-4 py-3">Ref ID</th>
                                                                <th className="px-4 py-3">Period</th>
                                                                <th className="px-4 py-3">Department/Branch</th>
                                                                <th className="px-4 py-3 text-right">Amount</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-slate-100">
                                                            {budgets.map(bud => (
                                                                <tr
                                                                    key={bud.id}
                                                                    className={cn(
                                                                        "group cursor-pointer hover:bg-slate-50 transition-colors",
                                                                        selectedBudgets.has(bud.id) ? "bg-indigo-50/30" : ""
                                                                    )}
                                                                    onClick={() => toggleBudget(bud.id)}
                                                                >
                                                                    <td className="px-4 py-3 flex items-center justify-center">
                                                                        {selectedBudgets.has(bud.id)
                                                                            ? <CheckSquare size={15} strokeWidth={2} className="text-[#6366F1] flex-shrink-0" />
                                                                            : <Square size={15} strokeWidth={1.5} className="text-gray-300 flex-shrink-0 group-hover:text-gray-500" />
                                                                        }
                                                                    </td>
                                                                    <td className="px-4 py-3 font-mono text-[11px] text-slate-500">BUD-{bud.id.substring(0, 8).toUpperCase()}</td>
                                                                    <td className="px-4 py-3 font-medium text-slate-800">{bud.month}/{bud.year}</td>
                                                                    <td className="px-4 py-3">
                                                                        <div className="flex items-center gap-2">
                                                                            <span className="w-5 h-5 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-[8px] font-semibold text-slate-500">DPT</span>
                                                                            <p className="font-medium text-slate-700 tracking-wide">{bud.department}</p>
                                                                        </div>
                                                                    </td>
                                                                    <td className="px-4 py-3 text-right font-semibold text-slate-900">{formatAmount(bud.totalAmount, bud.currency || 'KES')}</td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        )}

                                        {/* Invoices Section */}
                                        {invoices.length > 0 && (
 <div className="bg-white rounded-[8px] overflow-hidden mb-6" style={{border:'1px solid rgba(0,0,0,0.09)'}}>
                                                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50/50">
                                                    <div className="flex items-center gap-3">
                                                        <h3 className="text-[13px] font-semibold text-slate-800 tracking-wide">Vendor Invoices</h3>
                                                        <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-md text-[10px] font-semibold border border-indigo-100">{invoices.length} Items</span>
                                                    </div>
                                                    <button
                                                        onClick={() => {
                                                            const allSelected = invoices.every(i => selectedInvoices.has(i.id));
                                                            if (allSelected) setSelectedInvoices(new Set());
                                                            else setSelectedInvoices(new Set(invoices.map(i => i.id)));
                                                        }}
                                                        className="text-[11px] font-semibold text-slate-500 hover:text-indigo-600 transition-colors bg-white px-3 py-1.5 border border-slate-200 rounded-lg shadow-sm"
                                                    >
                                                        {invoices.every(i => selectedInvoices.has(i.id)) ? 'Deselect All' : 'Select All'}
                                                    </button>
                                                </div>
                                                <div className="overflow-x-auto">
                                                    <table className="w-full text-left text-[12px] whitespace-nowrap">
                                                        <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider text-[10px] font-semibold">
                                                            <tr>
                                                                <th className="px-4 py-3 w-10 text-center">Sel</th>
                                                                <th className="px-4 py-3">Ref ID</th>
                                                                <th className="px-4 py-3">Invoice No.</th>
                                                                <th className="px-4 py-3">Vendor</th>
                                                                <th className="px-4 py-3 text-right">Amount</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-slate-100">
                                                            {invoices.map(invoice => (
                                                                <tr
                                                                    key={invoice.id}
                                                                    className={cn(
                                                                        "group cursor-pointer hover:bg-slate-50 transition-colors",
                                                                        selectedInvoices.has(invoice.id) ? "bg-indigo-50/30" : ""
                                                                    )}
                                                                    onClick={() => toggleInvoice(invoice.id)}
                                                                >
                                                                    <td className="px-4 py-3 flex items-center justify-center">
                                                                        {selectedInvoices.has(invoice.id)
                                                                            ? <CheckSquare size={15} strokeWidth={2} className="text-[#6366F1] flex-shrink-0" />
                                                                            : <Square size={15} strokeWidth={1.5} className="text-gray-300 flex-shrink-0 group-hover:text-gray-500" />
                                                                        }
                                                                    </td>
                                                                    <td className="px-4 py-3 font-mono text-[11px] text-slate-500">INV-{invoice.id.substring(0, 8).toUpperCase()}</td>
                                                                    <td className="px-4 py-3 font-mono font-medium text-slate-700 tracking-wider">#{invoice.invoiceNumber}</td>
                                                                    <td className="px-4 py-3">
                                                                        <div className="flex items-center gap-2">
                                                                            <span className="w-5 h-5 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-[8px] font-semibold text-slate-500">VND</span>
                                                                            <p className="font-medium text-slate-800">{invoice.vendor.name}</p>
                                                                        </div>
                                                                    </td>
                                                                    <td className="px-4 py-3 text-right font-semibold text-slate-900">{formatAmount(invoice.amount, invoice.currency)}</td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        )}

                                        {/* Expenses Section */}
                                        {expenses.length > 0 && (
 <div className="bg-white rounded-[8px] overflow-hidden mb-6" style={{border:'1px solid rgba(0,0,0,0.09)'}}>
                                                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50/50">
                                                    <div className="flex items-center gap-3">
                                                        <h3 className="text-[13px] font-semibold text-slate-800 tracking-wide">Employee Reimbursements</h3>
                                                        <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-md text-[10px] font-semibold border border-indigo-100">{expenses.length} Items</span>
                                                    </div>
                                                    <button
                                                        onClick={() => {
                                                            const allSelected = expenses.every(e => selectedExpenses.has(e.id));
                                                            if (allSelected) setSelectedExpenses(new Set());
                                                            else setSelectedExpenses(new Set(expenses.map(e => e.id)));
                                                        }}
                                                        className="text-[11px] font-semibold text-slate-500 hover:text-indigo-600 transition-colors bg-white px-3 py-1.5 border border-slate-200 rounded-lg shadow-sm"
                                                    >
                                                        {expenses.every(e => selectedExpenses.has(e.id)) ? 'Deselect All' : 'Select All'}
                                                    </button>
                                                </div>
                                                <div className="overflow-x-auto">
                                                    <table className="w-full text-left text-[12px] whitespace-nowrap">
                                                        <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider text-[10px] font-semibold">
                                                            <tr>
                                                                <th className="px-4 py-3 w-10 text-center">Sel</th>
                                                                <th className="px-4 py-3">Ref ID</th>
                                                                <th className="px-4 py-3">Description</th>
                                                                <th className="px-4 py-3">Employee</th>
                                                                <th className="px-4 py-3 text-right">Amount</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-slate-100">
                                                            {expenses.map(expense => (
                                                                <tr
                                                                    key={expense.id}
                                                                    className={cn(
                                                                        "group cursor-pointer hover:bg-slate-50 transition-colors",
                                                                        selectedExpenses.has(expense.id) ? "bg-indigo-50/30" : ""
                                                                    )}
                                                                    onClick={() => toggleExpense(expense.id)}
                                                                >
                                                                    <td className="px-4 py-3 flex items-center justify-center">
                                                                        {selectedExpenses.has(expense.id)
                                                                            ? <CheckSquare size={15} strokeWidth={2} className="text-[#6366F1] flex-shrink-0" />
                                                                            : <Square size={15} strokeWidth={1.5} className="text-gray-300 flex-shrink-0 group-hover:text-gray-500" />
                                                                        }
                                                                    </td>
                                                                    <td className="px-4 py-3 font-mono text-[11px] text-slate-500">EXP-{expense.id.substring(0, 8).toUpperCase()}</td>
                                                                    <td className="px-4 py-3 font-medium text-slate-800">{expense.title}</td>
                                                                    <td className="px-4 py-3">
                                                                        <div className="flex items-center gap-2">
                                                                            <span className="w-5 h-5 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-[8px] font-semibold text-slate-500">EMP</span>
                                                                            <p className="font-medium text-slate-700">{expense.user.name}</p>
                                                                        </div>
                                                                    </td>
                                                                    <td className="px-4 py-3 text-right font-semibold text-slate-900">{formatAmount(expense.amount, expense.currency)}</td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        )}

                                        {/* Batch composition preview */}
                                        {(selectedExpenses.size > 0 || selectedInvoices.size > 0 || selectedRequisitions.size > 0 || selectedBudgets.size > 0) && (
 <div className="bg-white rounded-[8px] p-5" style={{border:'1px solid rgba(0,0,0,0.09)'}}>
                                                <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100">
                                                    <div className="w-1.5 h-4 bg-indigo-500 rounded-full"></div>
                                                    <p className="text-[12px] font-semibold text-slate-700 tracking-wide">Batch Composition Preview</p>
                                                </div>
                                                <div className="flex flex-wrap gap-2">
                                                    {selectedRequisitions.size > 0 && (
                                                        <span className="px-3 py-1.5 bg-indigo-50 border border-indigo-100 text-indigo-700 rounded-lg text-[11px] font-semibold">
                                                            REQ · {selectedRequisitions.size} items · KSh {requisitions.filter(r => selectedRequisitions.has(r.id)).reduce((s,r) => s+r.amount, 0).toFixed(2)}
                                                        </span>
                                                    )}
                                                    {selectedBudgets.size > 0 && (
                                                        <span className="px-3 py-1.5 bg-violet-50 border border-violet-100 text-violet-700 rounded-lg text-[11px] font-semibold">
                                                            BUD · {selectedBudgets.size} items · KSh {budgets.filter(b => selectedBudgets.has(b.id)).reduce((s,b) => s+b.totalAmount, 0).toFixed(2)}
                                                        </span>
                                                    )}
                                                    {selectedInvoices.size > 0 && (
                                                        <span className="px-3 py-1.5 bg-sky-50 border border-sky-100 text-sky-700 rounded-lg text-[11px] font-semibold">
                                                            INV · {selectedInvoices.size} items · KSh {invoices.filter(i => selectedInvoices.has(i.id)).reduce((s,i) => s+i.amount, 0).toFixed(2)}
                                                        </span>
                                                    )}
                                                    {selectedExpenses.size > 0 && (
                                                        <span className="px-3 py-1.5 bg-emerald-50 border border-emerald-100 text-emerald-700 rounded-lg text-[11px] font-semibold">
                                                            EXP · {selectedExpenses.size} items · KSh {expenses.filter(e => selectedExpenses.has(e.id)).reduce((s,e) => s+e.amount, 0).toFixed(2)}
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-[11px] text-slate-400 mt-4">These items will be processed as a unified batch.</p>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>
                    )}

                    {/* TAB: APPROVALS */}
                    {activeTab === 'approvals' && (
                        <div className="animate-fade-in space-y-4">
                            {/* Tab Header */}
                            <div className="flex items-center justify-between mb-4">
                                <div>
                                    <h3 className="text-sm font-semibold text-slate-900 tracking-wide">Pending Authorization</h3>
                                    <p className="text-[11px] font-medium text-slate-500 mt-0.5">{pendingPayments.length} Batches awaiting review</p>
                                </div>
                                <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200 shadow-inner">
                                    <button
                                        onClick={() => setViewMode('list')}
                                        className={cn(
                                            "p-1.5 rounded flex items-center justify-center transition-all",
                                            viewMode === 'list' ? "bg-white shadow-[0_1px_3px_rgb(0,0,0,0.1)] text-slate-900" : "text-slate-400 hover:text-slate-600"
                                        )}
                                        title="List View"
                                    >
                                        <PiListBullets className="text-lg" />
                                    </button>
                                    <button
                                        onClick={() => setViewMode('grid')}
                                        className={cn(
                                            "p-1.5 rounded flex items-center justify-center transition-all",
                                            viewMode === 'grid' ? "bg-white shadow-[0_1px_3px_rgb(0,0,0,0.1)] text-slate-900" : "text-slate-400 hover:text-slate-600"
                                        )}
                                        title="Grid View"
                                    >
                                        <PiGridFour className="text-lg" />
                                    </button>
                                </div>
                            </div>

                            {pendingPayments.length === 0 ? (
 <div className="bg-white rounded-[8px] p-12 text-center" style={{border:'1px solid rgba(0,0,0,0.09)'}}>
                                    <div className="w-16 h-16 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center mx-auto mb-4">
                                        <PiCheckCircle className="text-2xl text-slate-300" />
                                    </div>
                                    <h3 className="text-[13px] font-semibold text-slate-900 tracking-wide">All Caught Up</h3>
                                    <p className="text-[12px] text-slate-500 font-medium mt-1">No payments pending authorization right now.</p>
                                </div>
                            ) : viewMode === 'grid' ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {pendingPayments.map(batch => (
                                        <div key={batch.id} className="bg-white border border-slate-200 rounded-2xl shadow-sm hover:shadow-md transition-all p-5 flex flex-col group">
                                            <div className="flex justify-between items-start mb-4">
                                                <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center shadow-sm">
                                                    <PiStackSimple className="text-xl text-slate-400" />
                                                </div>
                                                <span className="px-2.5 py-1 bg-amber-50 text-amber-700 rounded-md text-[10px] font-semibold uppercase tracking-wider border border-amber-100">
                                                    Pending Auth
                                                </span>
                                            </div>

                                            <h4 className="text-xl font-mono font-semibold text-slate-900 tracking-tight">{formatAmount(batch.amount, batch.currency)}</h4>
                                            <p className="text-[11px] font-mono text-slate-400 uppercase tracking-widest mt-1 mb-4 flex items-center justify-between">
                                                BTH-{batch.id.substring(0, 8).toUpperCase()}
                                                <span className="font-sans normal-case tracking-normal">{formatDate(batch.createdAt)}</span>
                                            </p>

                                            <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 mb-6">
                                                <div className="flex items-center gap-2 mb-3">
                                                    <span className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-[8px] font-semibold text-slate-600 shadow-inner">MKR</span>
                                                    <p className="text-[12px] font-semibold text-slate-700 tracking-wide">{batch.maker.name}</p>
                                                </div>
                                                <div className="flex flex-wrap gap-1.5 mt-2 pt-3 border-t border-slate-200/60">
                                                    {[
                                                        batch._count?.invoices && { t: 'INV', c: batch._count.invoices, color: 'text-sky-700 bg-sky-50 border-sky-100' },
                                                        batch._count?.expenses && { t: 'EXP', c: batch._count.expenses, color: 'text-emerald-700 bg-emerald-50 border-emerald-100' },
                                                        batch._count?.requisitions && { t: 'REQ', c: batch._count.requisitions, color: 'text-indigo-700 bg-indigo-50 border-indigo-100' },
                                                        batch._count?.monthlyBudgets && { t: 'BUD', c: batch._count.monthlyBudgets, color: 'text-violet-700 bg-violet-50 border-violet-100' }
                                                    ].filter(Boolean).map((item: any, i) => (
                                                        <span key={i} className={`px-2 py-0.5 rounded flex items-center gap-1 border ${item.color}`}>
                                                            <span className="text-[10px] font-semibold">{item.c}</span>
                                                            <span className="text-[9px] font-medium tracking-wide">{item.t}</span>
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>

                                            <div className="mt-auto grid grid-cols-3 gap-2">
                                                <Link href={`/receipt-studio?paymentId=${batch.id}`} className="py-2 bg-[#6366F1] text-white rounded-md font-medium text-[11px] hover:bg-[#6366F1]/90 transition-all flex justify-center items-center shadow-none" title="View Detail">
                                                    View
                                                </Link>
                                                <button onClick={() => handleAuthorization(batch.id, 'REJECT')} disabled={isProcessing} className="py-2 bg-orange-500 text-white rounded-md font-medium text-[11px] hover:bg-orange-600 transition-all flex justify-center items-center shadow-none disabled:opacity-50">
                                                    Reject
                                                </button>
                                                <button onClick={() => handleAuthorization(batch.id, 'AUTHORIZE')} disabled={isProcessing} className="py-2 bg-emerald-600 text-white rounded-md font-medium text-[11px] hover:bg-emerald-700 transition-all flex justify-center items-center shadow-none disabled:opacity-50">
                                                    Authorize
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
 <div className="bg-white rounded-[8px] overflow-hidden" style={{border:'1px solid rgba(0,0,0,0.09)'}}>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left text-[12px] whitespace-nowrap min-w-[800px]">
                                            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider text-[10px] font-semibold">
                                                <tr>
                                                    <th className="px-4 py-3 w-28">Date</th>
                                                    <th className="px-4 py-3">Ref ID</th>
                                                    <th className="px-4 py-3">Originator</th>
                                                    <th className="px-4 py-3 text-right">Amount</th>
                                                    <th className="sticky right-0 bg-slate-50 pl-4 pr-4 py-3 text-right rounded-tr-xl shadow-[-8px_0_8px_-6px_rgba(0,0,0,0.04)] z-10 w-64">Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {pendingPayments.map(batch => (
                                                    <tr key={batch.id} className="hover:bg-slate-50 transition-colors group">
                                                        <td className="px-4 py-3 text-slate-500">{formatDate(batch.createdAt)}</td>
                                                        <td className="px-4 py-3 font-mono text-[11px] text-slate-500">BTH-{batch.id.substring(0, 8).toUpperCase()}</td>
                                                        <td className="px-4 py-3">
                                                            <div className="flex items-center gap-2">
                                                                <span className="w-6 h-6 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-[9px] font-semibold text-slate-500">MKR</span>
                                                                <p className="font-medium text-slate-800 tracking-wide">{batch.maker.name}</p>
                                                            </div>
                                                            <p className="text-[10px] text-slate-400 tracking-wider mt-1 ml-8">
                                                                {[batch._count?.invoices && `${batch._count.invoices} INV`, batch._count?.expenses && `${batch._count.expenses} EXP`, batch._count?.requisitions && `${batch._count.requisitions} REQ`, batch._count?.monthlyBudgets && `${batch._count.monthlyBudgets} BUD`].filter(Boolean).join(' · ')}
                                                            </p>
                                                        </td>
                                                        <td className="px-4 py-3 text-right font-mono font-semibold text-slate-900">{formatAmount(batch.amount, batch.currency)}</td>
                                                        <td className="sticky right-0 bg-white pl-4 pr-4 py-3 align-middle shadow-[-8px_0_8px_-6px_rgba(0,0,0,0.04)] z-10">
                                                            <div className="flex items-center justify-end gap-1.5 h-full">
                                                                <Link href={`/receipt-studio?paymentId=${batch.id}`} className="px-3 py-2 bg-[#6366F1] text-white rounded-md font-medium text-xs hover:bg-[#6366F1]/90 transition-all flex flex-1 items-center justify-center shadow-none" title="View Detail">View</Link>
                                                                <button onClick={() => handleAuthorization(batch.id, 'REJECT')} disabled={isProcessing} className="px-3 py-2 bg-orange-500 text-white rounded-md font-medium text-xs hover:bg-orange-600 transition-all flex flex-1 items-center justify-center shadow-none disabled:opacity-50">Reject</button>
                                                                <button onClick={() => handleAuthorization(batch.id, 'AUTHORIZE')} disabled={isProcessing} className="px-3 py-2 bg-emerald-600 text-white rounded-md font-medium text-xs hover:bg-emerald-700 transition-all flex flex-1 items-center justify-center shadow-none disabled:opacity-50">Authorize</button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* TAB: DISBURSEMENTS */}
                    {activeTab === 'disbursements' && (
                        <div className="animate-fade-in space-y-4">
                            <div className="flex items-center justify-between mb-4">
                                <div>
                                    <h3 className="text-[11px] font-semibold text-slate-900 uppercase tracking-widest">Ready for Disbursement</h3>
                                    <p className="text-[9px] font-mono text-slate-500 uppercase tracking-widest mt-1">[{authorizedPayments.length}] BATCHES AUTHORIZED</p>
                                </div>
                            </div>

                            {authorizedPayments.length === 0 ? (
 <div className="p-8 text-center border border-slate-300">
                                    <p className="font-mono text-xs font-semibold text-slate-900 tracking-widest uppercase">No Payments Ready for Payout</p>
                                </div>
                            ) : (
                                /* BANKY TABLE */
 <div className="bg-white rounded-[8px] overflow-hidden" style={{border:'1px solid rgba(0,0,0,0.09)'}}>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left text-[12px] whitespace-nowrap">
                                            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider text-[10px] font-semibold">
                                                <tr>
                                                    <th className="px-4 py-3">Date</th>
                                                    <th className="px-4 py-3">Ref ID</th>
                                                    <th className="px-4 py-3">Beneficiary</th>
                                                    <th className="px-4 py-3 text-right">Amount</th>
                                                    <th className="px-4 py-3 text-right w-32">Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {authorizedPayments.map(batch => (
                                                    <tr key={batch.id} className="hover:bg-slate-50 transition-colors group">
                                                        <td className="px-4 py-3 text-slate-500">{formatDate(batch.createdAt)}</td>
                                                        <td className="px-4 py-3 font-mono text-[11px] text-slate-500">BTH-{batch.id.substring(0, 8).toUpperCase()}</td>
                                                        <td className="px-4 py-3">
                                                            <div className="flex items-center gap-2">
                                                                <span className="w-6 h-6 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-[9px] font-semibold text-slate-500">MKR</span>
                                                                <p className="font-medium text-slate-800 tracking-wide">{batch.maker.name}</p>
                                                            </div>
                                                            <p className="text-[10px] text-slate-400 tracking-wider mt-1 ml-8">
                                                                {[batch._count?.invoices && `${batch._count.invoices} INV`, batch._count?.expenses && `${batch._count.expenses} EXP`, batch._count?.requisitions && `${batch._count.requisitions} REQ`, batch._count?.monthlyBudgets && `${batch._count.monthlyBudgets} BUD`].filter(Boolean).join(' · ')}
                                                            </p>
                                                        </td>
                                                        <td className="px-4 py-3 text-right font-semibold text-slate-900">{formatAmount(batch.amount, batch.currency)}</td>
                                                        <td className="px-4 py-3 text-right">
                                                            <div className="flex items-center justify-end gap-1.5 h-full">
                                                                {batch.status === 'FAILED' && (
                                                                    <button 
                                                                        onClick={() => {
                                                                            const lines = batch.notes?.split('\n') || [];
                                                                            const lastErrorLine = lines.find(l => l.startsWith('Errors: '));
                                                                            const errorMsg = lastErrorLine?.replace('Errors: ', '') || "Unknown disbursement error";
                                                                            setFailureDetails({ 
                                                                                details: [{ title: 'Batch Details', error: errorMsg }], 
                                                                                summary: { success: 0, failed: 1 } 
                                                                            });
                                                                            setIsFailureModalOpen(true);
                                                                        }}
                                                                        className="px-3 py-2 bg-rose-100 text-rose-700 rounded-md font-medium text-xs hover:bg-rose-200 transition-all flex items-center justify-center border border-rose-200"
                                                                    >
                                                                        Error Info
                                                                    </button>
                                                                )}
                                                                <Link href={`/receipt-studio?paymentId=${batch.id}`} className="px-3 py-2 bg-[#6366F1] text-white rounded-md font-medium text-xs hover:bg-[#6366F1]/90 transition-all flex flex-1 items-center justify-center shadow-none" title="Source Voucher">View</Link>
                                                                <button onClick={() => handleAuthorization(batch.id, 'DISBURSE')} disabled={isProcessing} className="px-3 py-2 bg-emerald-600 text-white rounded-md font-medium text-xs hover:bg-emerald-700 transition-all flex flex-1 items-center justify-center shadow-none disabled:opacity-50">Pay</button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* TAB: CLOSING */}
                    {activeTab === 'closing' && (
                        <div className="animate-fade-in space-y-4">
                            <div className="flex items-center justify-between mb-4">
                                <div>
                                    <h3 className="text-[11px] font-semibold text-slate-900 uppercase tracking-widest">Pending Reconciliation</h3>
                                    <p className="text-[9px] font-mono text-slate-500 uppercase tracking-widest mt-1">[{paidPayments.length}] BATCHES AWAITING CLOSURE</p>
                                </div>
                            </div>

                            {paidPayments.length === 0 ? (
 <div className="p-8 text-center border border-slate-300">
                                    <p className="font-mono text-xs font-semibold text-slate-900 tracking-widest uppercase">No Payments Pending Closure</p>
                                </div>
                            ) : (
                                /* BANKY TABLE */
 <div className="bg-white rounded-[8px] overflow-hidden" style={{border:'1px solid rgba(0,0,0,0.09)'}}>
                                     <div className="overflow-x-auto">
                                        <table className="w-full text-left text-[12px] whitespace-nowrap">
                                            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider text-[10px] font-semibold">
                                                <tr>
                                                    <th className="px-4 py-3">Payment Date</th>
                                                    <th className="px-4 py-3">Ref ID</th>
                                                    <th className="px-4 py-3">Beneficiary</th>
                                                    <th className="px-4 py-3 text-right">Amount</th>
                                                    <th className="px-4 py-3 text-right w-32">Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {paidPayments.map(batch => (
                                                    <tr key={batch.id} className="hover:bg-slate-50 transition-colors group">
                                                        <td className="px-4 py-3 text-slate-500">{formatDate(batch.createdAt)}</td>
                                                        <td className="px-4 py-3 font-mono text-[11px] text-slate-500">BTH-{batch.id.substring(0, 8).toUpperCase()}</td>
                                                        <td className="px-4 py-3">
                                                            <div className="flex items-center gap-2">
                                                                <span className="w-6 h-6 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-[9px] font-semibold text-slate-500">MKR</span>
                                                                <p className="font-medium text-slate-800 tracking-wide">{batch.maker.name}</p>
                                                            </div>
                                                            {batch.status === 'PARTIALLY_PAID' ? (
                                                                <p className="text-[10px] text-amber-600 tracking-wider mt-1 ml-8 font-semibold flex items-center gap-1">
                                                                    <PiInfo className="text-[12px]" />
                                                                    Partial Disbursement - Action Required
                                                                </p>
                                                            ) : (
                                                                <p className="text-[10px] text-emerald-600 tracking-wider mt-1 ml-8 font-semibold">Processed Successfully</p>
                                                            )}
                                                        </td>
                                                        <td className="px-4 py-3 text-right font-semibold text-slate-900">{formatAmount(batch.amount, batch.currency)}</td>
                                                        <td className="px-4 py-3 text-right">
                                                            <button
                                                                onClick={() => setReconcileBatch({ id: batch.id, amount: batch.amount, currency: batch.currency, expenses: batch.expenses as any, requisitions: batch.requisitions as any })}
                                                                disabled={isProcessing}
                                                                className="px-3 py-2 bg-[#6366F1] text-white rounded-md font-medium text-xs hover:bg-[#6366F1]/90 transition-all flex items-center justify-center shadow-none disabled:opacity-50 w-full"
                                                            >
                                                                Reconcile
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                     </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* TAB: HISTORY */}
                    {activeTab === 'history' && (
                        <div className="animate-fade-in space-y-4">
                            <div className="flex items-center justify-between mb-4">
                                <div>
                                    <h3 className="text-[11px] font-semibold text-slate-900 uppercase tracking-widest">Transaction History</h3>
                                    <p className="text-[9px] font-mono text-slate-500 uppercase tracking-widest mt-1">[{history.length}] TOTAL RECORDS ARCHIVED</p>
                                </div>
                            </div>

 <div className="bg-white rounded-[8px] overflow-hidden" style={{border:'1px solid rgba(0,0,0,0.09)'}}>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-[12px] whitespace-nowrap">
                                        <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider text-[10px] font-semibold">
                                            <tr>
                                                <th className="px-4 py-3">Initiator</th>
                                                <th className="px-4 py-3">Authorizer</th>
                                                <th className="px-4 py-3">Status</th>
                                                <th className="px-4 py-3 text-right">Amount</th>
                                                <th className="px-4 py-3 text-right">Date</th>
                                                <th className="px-4 py-3 text-right w-16">View</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-200">
                                            {history.length === 0 ? (
                                                <tr>
                                                    <td colSpan={6} className="px-3 py-8 text-center text-[10px] font-semibold text-slate-400 uppercase tracking-widest">
                                                        No transaction history found
                                                    </td>
                                                </tr>
                                            ) : (
                                                currentHistory.map((item: any) => (
                                                    <tr key={item.id} className="hover:bg-slate-50 transition-colors group">
                                                        <td className="px-4 py-3">
                                                            <div className="flex items-center gap-2">
                                                                <span className="w-6 h-6 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-[9px] font-semibold text-slate-500">REQ</span>
                                                                <p className="font-medium text-slate-800 tracking-wide">{item.maker?.name || 'UNKNOWN'}</p>
                                                            </div>
                                                        </td>
                                                        <td className="px-4 py-3 font-medium text-slate-700">
                                                            {item.checker?.name || 'Pending'}
                                                        </td>
                                                        <td className="px-4 py-3 font-semibold tracking-wide">
                                                            <span className={cn(
                                                                "px-2 py-1 rounded-md text-[10px]",
                                                                item.status === 'COMPLETED' || item.status === 'PAID' ? "bg-emerald-50 text-emerald-700 border border-emerald-200" :
                                                                    item.status === 'REJECTED' ? "bg-rose-50 text-rose-700 border border-rose-200" :
                                                                        "bg-slate-50 text-slate-600 border border-slate-200"
                                                            )}>
                                                                {item.status}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-3 text-right">
                                                            <p className="font-semibold text-slate-900">{formatAmount(item.amount, item.currency)}</p>
                                                        </td>
                                                        <td className="px-4 py-3 text-right text-slate-500">
                                                            {formatDate(item.createdAt)}
                                                        </td>
                                                        <td className="px-4 py-3 text-right">
                                                            <Link
                                                                href={`/receipt-studio?paymentId=${item.id}`}
                                                                className="py-2 bg-[#6366F1] text-white rounded-md font-medium text-xs hover:bg-[#6366F1]/90 transition-all shadow-none flex justify-center items-center"
                                                            >
                                                                View Log
                                                            </Link>
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                        {totalPages > 1 && (
                                            <tfoot className="border-t border-slate-100 bg-slate-50/50">
                                                <tr>
                                                    <td colSpan={6} className="px-4 py-3">
                                                        <div className="flex items-center justify-between">
                                                            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">PAGE {currentPage} OF {totalPages}</p>
                                                            <div className="flex items-center gap-2">
                                                                <button
                                                                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                                                    disabled={currentPage === 1}
                                                                    className="px-3 py-1.5 rounded-lg text-[10px] font-semibold uppercase border border-slate-200 text-slate-600 hover:bg-white hover:border-slate-300 disabled:opacity-30 transition-colors shadow-sm bg-slate-50"
                                                                >
                                                                    PREV
                                                                </button>
                                                                <button
                                                                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                                                    disabled={currentPage === totalPages}
                                                                    className="px-3 py-1.5 rounded-lg text-[10px] font-semibold uppercase border border-slate-200 text-slate-600 hover:bg-white hover:border-slate-300 disabled:opacity-30 transition-colors shadow-sm bg-slate-50"
                                                                >
                                                                    NEXT
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </td>
                                                </tr>
                                            </tfoot>
                                        )}
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}
            </div>

            {/* Confirmation Modal */}
            {mounted && confirmationModal && confirmationModal.isOpen && createPortal(
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/30" onClick={() => !isProcessing && setConfirmationModal(null)} />
                    <div className="relative bg-white rounded-[12px] w-full max-w-[420px] overflow-hidden z-[10000]"
                        style={{ border: '1px solid rgba(0,0,0,0.09)', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>

                        {/* Header */}
                        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
                            <div className="flex items-center gap-3">
                                <div className={cn(
                                    "w-8 h-8 rounded-[7px] flex items-center justify-center flex-shrink-0",
                                    confirmationModal.action === 'AUTHORIZE' ? "bg-indigo-50" :
                                    confirmationModal.action === 'DISBURSE' ? "bg-emerald-50" :
                                    confirmationModal.action === 'CLOSE' ? "bg-gray-50" : "bg-red-50"
                                )}>
                                    {confirmationModal.action === 'AUTHORIZE' && <PiCheckCircle className="text-[#6366F1] text-[15px]" />}
                                    {confirmationModal.action === 'DISBURSE' && <PiHandCoins className="text-emerald-600 text-[15px]" />}
                                    {confirmationModal.action === 'CLOSE' && <PiFileText className="text-gray-500 text-[15px]" />}
                                    {confirmationModal.action === 'REJECT' && <PiX className="text-red-500 text-[15px]" />}
                                </div>
                                <div>
                                    <h3 className="text-[14px] font-[600] text-gray-900">
                                        {confirmationModal.action === 'AUTHORIZE' ? 'Approve Payment' :
                                         confirmationModal.action === 'DISBURSE' ? 'Execute Payment' :
                                         confirmationModal.action === 'CLOSE' ? 'Close & Reconcile' : 'Reject Payment'}
                                    </h3>
                                    <p className="text-[11.5px] text-gray-400">
                                        {confirmationModal.action === 'CLOSE' ? 'Mark lifecycle as complete' : 'This action cannot be undone'}
                                    </p>
                                </div>
                            </div>
                            <button onClick={() => setConfirmationModal(null)} disabled={isProcessing}
                                className="p-1.5 rounded-[5px] hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors">
                                <PiX className="text-[15px]" />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="px-6 py-5 space-y-4">
                            {confirmationModal.action === 'DISBURSE' ? (
                                <>
                                    {/* Payment method selector */}
                                    <div>
                                        <label className="block text-[11px] font-[500] uppercase tracking-[0.07em] text-gray-400 mb-2">Payment Route</label>
                                        <div className="flex p-0.5 rounded-[7px] bg-gray-100" style={{ border: '1px solid rgba(0,0,0,0.07)' }}>
                                            <button onClick={() => setPaymentMethod('WALLET')}
                                                className={cn("flex-1 py-2 text-[11.5px] font-[600] rounded-[6px] transition-all",
                                                    paymentMethod === 'WALLET' ? "bg-white text-[#6366F1] shadow-sm" : "text-gray-500 hover:text-gray-700")}>
                                                Direct (Paystack)
                                            </button>
                                            <button onClick={() => setPaymentMethod('BRANCH_WALLET')}
                                                className={cn("flex-1 py-2 text-[11.5px] font-[600] rounded-[6px] transition-all",
                                                    paymentMethod === 'BRANCH_WALLET' ? "bg-white text-emerald-600 shadow-sm" : "text-gray-500 hover:text-gray-700")}>
                                                Branch Internal
                                            </button>
                                            <button onClick={() => setPaymentMethod('CASH')}
                                                className={cn("flex-1 py-2 text-[11.5px] font-[600] rounded-[6px] transition-all",
                                                    paymentMethod === 'CASH' ? "bg-white text-amber-600 shadow-sm" : "text-gray-500 hover:text-gray-700")}>
                                                Cash / Already Paid
                                            </button>
                                        </div>
                                        <p className="text-[11px] text-gray-400 mt-1.5">
                                            {paymentMethod === 'WALLET'
                                                ? "Sends funds directly to the recipient's personal account via Paystack."
                                                : paymentMethod === 'BRANCH_WALLET'
                                                ? "Funds the branch's local digital wallet. No external transfer."
                                                : "Payment was already made in cash or offline. Items will be marked paid immediately with no gateway transfer."}
                                        </p>
                                    </div>

                                    {/* Fee breakdown — hidden for cash */}
                                    {paymentMethod !== 'CASH' && (
                                        <div>
                                            <label className="block text-[11px] font-[500] uppercase tracking-[0.07em] text-gray-400 mb-2">Estimated Breakdown</label>
                                            <div className="rounded-[8px] overflow-hidden" style={{ border: '1px solid rgba(0,0,0,0.09)' }}>
                                                <div className="flex justify-between items-center px-4 py-2.5 text-[12px] text-gray-500" style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                                                    <span>Subtotal</span>
                                                    <span className="font-mono font-[500] text-gray-900">{formatAmount(confirmationModal.amount || 0, confirmationModal.currency)}</span>
                                                </div>
                                                <div className="flex justify-between items-center px-4 py-2.5 text-[12px] text-gray-500" style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                                                    <span>Fees ({confirmationModal.itemCount} items)</span>
                                                    <span className="font-mono text-emerald-600 font-[500]">+{formatAmount((confirmationModal.itemCount || 1) * estimatePaystackPayoutFee(confirmationModal.amount || 0, confirmationModal.currency), confirmationModal.currency)}</span>
                                                </div>
                                                <div className="flex justify-between items-center px-4 py-3 bg-gray-50/60">
                                                    <span className="text-[12px] font-[600] text-gray-700">Total</span>
                                                    <span className="font-mono text-[14px] font-[700] text-emerald-700">{formatAmount((confirmationModal.amount || 0) + ((confirmationModal.itemCount || 1) * estimatePaystackPayoutFee(confirmationModal.amount || 0, confirmationModal.currency)), confirmationModal.currency)}</span>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Cash notice */}
                                    {paymentMethod === 'CASH' && (
                                        <div className="flex items-start gap-2.5 px-3.5 py-3 rounded-[8px] bg-amber-50" style={{ border: '1px solid rgba(217,119,6,0.2)' }}>
                                            <PiInfo className="text-amber-500 text-[14px] mt-0.5 shrink-0" />
                                            <p className="text-[11.5px] text-amber-700 leading-relaxed">
                                                All items in this batch will be marked as <strong>Paid</strong> immediately.
                                                No funds will be moved from your wallet. Use this for cash payments or
                                                settlements already completed outside the system.
                                            </p>
                                        </div>
                                    )}

                                    {/* Proof of payment */}
                                    <div>
                                        <label className="block text-[11px] font-[500] uppercase tracking-[0.07em] text-gray-400 mb-2">Proof of Payment <span className="normal-case tracking-normal text-gray-300">(optional)</span></label>
                                        <input type="file" title="Proof of Payment"
                                            onChange={(e) => setSelectedFile(e.target.files ? e.target.files[0] : null)}
                                            className="block w-full text-[12px] text-gray-500 file:cursor-pointer file:mr-3 file:py-1.5 file:px-3 file:rounded-[6px] file:text-[11.5px] file:font-[500] file:bg-gray-50 file:border file:text-gray-700 hover:file:bg-gray-100 rounded-[7px] p-1 bg-white transition-colors"
                                            style={{ border: '1px solid rgba(0,0,0,0.09)' }} />
                                    </div>
                                </>
                            ) : (
                                <p className="text-[13px] text-gray-500 leading-relaxed">
                                    {confirmationModal.action === 'CLOSE'
                                        ? "This will mark the payment batch as fully reconciled. Ensure all proofs of payment have been verified."
                                        : confirmationModal.action === 'REJECT'
                                        ? "The batch will be returned to the originator. They will need to resubmit for processing."
                                        : "The payment batch will be cleared for disbursement. The originator will be notified."
                                    }
                                </p>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="flex items-center justify-end gap-3 px-6 py-4" style={{ borderTop: '1px solid rgba(0,0,0,0.07)' }}>
                            <button onClick={() => setConfirmationModal(null)} disabled={isProcessing}
                                className="px-4 py-2 text-[13px] font-[500] text-gray-500 rounded-[6px] hover:bg-gray-50 hover:text-gray-800 transition-colors"
                                style={{ border: '1px solid rgba(0,0,0,0.09)' }}>
                                Cancel
                            </button>
                            <button onClick={proceedAuthorization} disabled={isProcessing}
                                className={cn(
                                    "px-5 py-2 text-[13px] font-[600] text-white rounded-[6px] transition-colors flex items-center gap-2 disabled:opacity-50",
                                    confirmationModal.action === 'REJECT' ? "bg-red-600 hover:bg-red-700" :
                                    confirmationModal.action === 'DISBURSE' && paymentMethod === 'CASH' ? "bg-amber-500 hover:bg-amber-600" :
                                    confirmationModal.action === 'DISBURSE' ? "bg-emerald-600 hover:bg-emerald-700" :
                                    confirmationModal.action === 'AUTHORIZE' ? "bg-[#6366F1] hover:bg-indigo-700" :
                                    "bg-gray-900 hover:bg-gray-800"
                                )}>
                                {isProcessing && <PiClock className="animate-spin text-sm" />}
                                {isProcessing ? 'Processing…' :
                                    confirmationModal.action === 'AUTHORIZE' ? 'Approve' :
                                    confirmationModal.action === 'DISBURSE' ? 'Pay Now' :
                                    confirmationModal.action === 'CLOSE' ? 'Reconcile' : 'Reject'}
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* EXPEDITED BYPASS MODAL */}
            {mounted && showBypassModal && createPortal(
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/30" onClick={() => !isProcessing && setShowBypassModal(false)} />
                    <div className="relative bg-white rounded-[12px] w-[400px] overflow-hidden" style={{ border: '1px solid rgba(0,0,0,0.09)', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>

                        {/* Header */}
                        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-[7px] bg-indigo-50 flex items-center justify-center flex-shrink-0">
                                    <PiHandCoins className="text-[#6366F1] text-[15px]" />
                                </div>
                                <div>
                                    <h3 className="text-[14px] font-[600] text-gray-900">Process Batch</h3>
                                    <p className="text-[11.5px] text-gray-400">Choose how to route this payment</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowBypassModal(false)}
                                disabled={isProcessing}
                                className="p-1.5 rounded-[5px] hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"
                            >
                                <PiX className="text-[15px]" />
                            </button>
                        </div>

                        {/* Options */}
                        <div className="px-6 py-5 space-y-3">
                            <button
                                onClick={() => handleCreateBatch(false)}
                                disabled={isProcessing}
                                className="w-full group text-left px-4 py-4 rounded-[8px] bg-white hover:bg-gray-50 transition-colors disabled:opacity-50"
                                style={{ border: '1px solid rgba(0,0,0,0.09)' }}
                            >
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-[13px] font-[600] text-gray-900">Standard Workflow</p>
                                        <p className="text-[11.5px] text-gray-400 mt-0.5">Routes to authorization queue for review before payment.</p>
                                    </div>
                                    {isProcessing
                                        ? <PiClock className="animate-spin text-gray-300 text-lg flex-shrink-0" />
                                        : <div className="w-[18px] h-[18px] rounded-full flex-shrink-0 ml-4" style={{ border: '1.5px solid rgba(0,0,0,0.2)' }} />
                                    }
                                </div>
                            </button>

                            <button
                                onClick={() => handleCreateBatch(true)}
                                disabled={isProcessing}
                                className="w-full group text-left px-4 py-4 rounded-[8px] bg-emerald-50 hover:bg-emerald-100/60 transition-colors disabled:opacity-50"
                                style={{ border: '1px solid rgba(16,185,129,0.25)' }}
                            >
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-[13px] font-[600] text-emerald-900">Expedited Bypass</p>
                                        <p className="text-[11.5px] text-emerald-700/70 mt-0.5">Skips authorization. Routes directly to remittance.</p>
                                    </div>
                                    {isProcessing
                                        ? <PiClock className="animate-spin text-emerald-400 text-lg flex-shrink-0" />
                                        : <div className="w-[18px] h-[18px] rounded-full flex-shrink-0 ml-4 bg-emerald-500 flex items-center justify-center">
                                            <div className="w-[7px] h-[7px] rounded-full bg-white" />
                                          </div>
                                    }
                                </div>
                            </button>
                        </div>

                        {/* Footer */}
                        <div className="px-6 py-4 flex justify-end" style={{ borderTop: '1px solid rgba(0,0,0,0.07)' }}>
                            <button
                                onClick={() => setShowBypassModal(false)}
                                disabled={isProcessing}
                                className="px-4 py-2 text-[13px] font-[500] text-gray-500 rounded-[6px] hover:bg-gray-50 hover:text-gray-800 transition-colors"
                                style={{ border: '1px solid rgba(0,0,0,0.09)' }}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* FAILURE DETAILS MODAL */}
            {mounted && isFailureModalOpen && failureDetails && createPortal(
                <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/30" onClick={() => setIsFailureModalOpen(false)} />
                    <div className="relative bg-white rounded-[12px] w-full max-w-[480px] overflow-hidden z-[10001]"
                        style={{ border: '1px solid rgba(0,0,0,0.09)', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>

                        {/* Header */}
                        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-[7px] bg-red-50 flex items-center justify-center flex-shrink-0">
                                    <PiX className="text-red-500 text-[15px]" />
                                </div>
                                <div>
                                    <h3 className="text-[14px] font-[600] text-gray-900">Disbursement Failed</h3>
                                    <p className="text-[11.5px] text-gray-400">
                                        {failureDetails.summary.failed} item{failureDetails.summary.failed !== 1 ? 's' : ''} could not be processed
                                    </p>
                                </div>
                            </div>
                            <button onClick={() => setIsFailureModalOpen(false)}
                                className="p-1.5 rounded-[5px] hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors">
                                <PiX className="text-[15px]" />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="px-6 py-4 max-h-[55vh] overflow-y-auto space-y-2">
                            {failureDetails.details && failureDetails.details.length > 0 ? (
                                failureDetails.details.map((detail, i) => (
                                    <div key={i} className="rounded-[8px] overflow-hidden" style={{ border: '1px solid rgba(0,0,0,0.09)' }}>
                                        <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50/60" style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                                            <span className="text-[12px] font-[600] text-gray-800">{detail.title}</span>
                                            {detail.type && (
                                                <span className="text-[10px] font-[500] text-gray-400 uppercase tracking-[0.06em] px-2 py-0.5 bg-white rounded-[4px]"
                                                    style={{ border: '1px solid rgba(0,0,0,0.08)' }}>
                                                    {detail.type}
                                                </span>
                                            )}
                                        </div>
                                        <div className="px-4 py-3">
                                            <p className="text-[12px] text-red-600 leading-relaxed">{detail.error}</p>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="py-10 text-center">
                                    <p className="text-[13px] text-gray-400">No granular details available for this batch error.</p>
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="flex items-center justify-between px-6 py-4" style={{ borderTop: '1px solid rgba(0,0,0,0.07)' }}>
                            <p className="text-[11.5px] text-gray-400 max-w-[260px]">
                                Resolve recipient or balance issues before retrying disbursement.
                            </p>
                            <button onClick={() => setIsFailureModalOpen(false)}
                                className="px-4 py-2 text-[13px] font-[500] text-gray-500 rounded-[6px] hover:bg-gray-50 hover:text-gray-800 transition-colors"
                                style={{ border: '1px solid rgba(0,0,0,0.09)' }}>
                                Close
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>

        {/* eTIMS Receipt Verification Modal */}
        {mounted && reconcileBatch && (
            <ReconcileModal
                batch={reconcileBatch}
                isSystemAdmin={isSystemAdmin}
                onClose={() => setReconcileBatch(null)}
                onComplete={() => {
                    setReconcileBatch(null);
                    showToast('Payment batch reconciled successfully', 'success');
                    router.refresh();
                }}
            />
        )}
    </>);
}
