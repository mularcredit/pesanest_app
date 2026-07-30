"use client";

import { useState, useEffect, Fragment } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/ToastProvider";
import {
    PiCheckCircle, PiXCircle, PiClock, PiUser, PiCalendar,
    PiMoney, PiReceipt, PiFileText, PiBuildings, PiEye, PiX,
    PiUserSwitch, PiSpinner, PiListBullets, PiGridFour,
} from "react-icons/pi";
import { cn } from "@/lib/utils";
import Image from "next/image";
import { DelegateModal } from "@/components/workflow/DelegationEscalation";

interface User { name: string | null; email: string | null; department: string | null; }
interface Expense { id: string; title: string; amount: number; category: string; merchant: string | null; expenseDate: Date; createdAt: Date; receiptUrl: string | null; user: User; approvals?: any[]; }
interface Requisition { id: string; title: string; amount: number; category: string; businessJustification: string | null; createdAt: Date; user: User; approvals?: any[]; }
interface MonthlyBudget { id: string; month: number; year: number; branch: string; department: string; totalAmount: number; createdAt: Date; user: User; approvals?: any[]; }
interface Invoice { id: string; invoiceNumber: string; vendor: { name: string }; amount: number; currency: string; dueDate: Date; invoiceDate: Date; status: string; createdAt: Date; fileUrl: string | null; createdBy: User; approvals?: any[]; }
interface Approval { id: string; status: string; comments: string | null; createdAt: Date; expense: (Expense & { user: { name: string | null } }) | null; requisition: (Requisition & { user: { name: string | null } }) | null; monthlyBudget: (MonthlyBudget & { user: { name: string | null } }) | null; invoice: (Invoice & { createdBy: { name: string | null } }) | null; }
interface ApprovalQueueProps { expenses: Expense[]; requisitions: Requisition[]; budgets: MonthlyBudget[]; invoices: Invoice[]; history: Approval[]; }

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const MONTHS_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

const ROW_BORDER: React.CSSProperties = { borderBottom: '1px solid rgba(0,0,0,0.06)' };
const CARD_STYLE: React.CSSProperties = { border: '1px solid rgba(0,0,0,0.09)' };

function fmtDate(date: Date) {
    return new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}
function fmtCurrency(amount: number) {
    return `KES ${new Intl.NumberFormat('en-US').format(amount)}`;
}

function EmptyState({ icon: Icon, label }: { icon: any; label: string }) {
    return (
        <div className="bg-white rounded-[8px] py-20 flex flex-col items-center" style={CARD_STYLE}>
            <div className="w-10 h-10 rounded-[8px] bg-gray-50 flex items-center justify-center mb-3" style={{ border: '1px solid rgba(0,0,0,0.07)' }}>
                <Icon className="text-gray-300 text-xl" />
            </div>
            <p className="text-[13px] font-[500] text-gray-700">All caught up</p>
            <p className="text-[12px] text-gray-400 mt-0.5">No pending {label} approvals</p>
        </div>
    );
}

function ReviewRow({ approvalId, comments, setComments, processingAction, handleApproval, onCancel, prevComment, prevReviewer }: any) {
    return (
        <tr className="bg-gray-50/50">
            <td colSpan={5} className="px-5 py-4" style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                {prevComment && (
                    <div className="mb-3 px-4 py-3 rounded-[7px] bg-amber-50/60" style={{ border: '1px solid rgba(245,158,11,0.2)' }}>
                        <p className="text-[12px] text-amber-800 italic">"{prevComment}"</p>
                        <p className="text-[10.5px] text-amber-600/70 font-[500] mt-1">— {prevReviewer}</p>
                    </div>
                )}
                <div className="flex items-start gap-3">
                    <textarea
                        value={comments}
                        onChange={e => setComments(e.target.value)}
                        placeholder="Add review notes…"
                        rows={1}
                        autoFocus
                        className="flex-1 bg-white rounded-[6px] px-3 py-2.5 text-[12.5px] text-gray-900 placeholder:text-gray-300 outline-none focus:ring-1 focus:ring-[#6366F1] resize-none"
                        style={{ border: '1px solid rgba(0,0,0,0.09)' }}
                    />
                    <div className="flex items-center gap-2 shrink-0">
                        <button onClick={onCancel} className="px-3 py-2.5 text-[12px] font-[500] text-gray-500 rounded-[6px] hover:bg-gray-100 transition-colors">
                            Cancel
                        </button>
                        <button onClick={() => handleApproval(approvalId, 'REJECT')} disabled={processingAction !== null}
                            className="flex items-center gap-1.5 px-3 py-2.5 text-[12px] font-[500] text-red-600 rounded-[6px] hover:bg-red-50 transition-colors disabled:opacity-40"
                            style={{ border: '1px solid rgba(239,68,68,0.25)' }}>
                            {processingAction?.id === approvalId && processingAction?.action === 'REJECT' ? <PiSpinner className="animate-spin text-[13px]" /> : <PiXCircle className="text-[13px]" />} Reject
                        </button>
                        <button onClick={() => handleApproval(approvalId, 'ADJUST')} disabled={processingAction !== null}
                            className="flex items-center gap-1.5 px-3 py-2.5 text-[12px] font-[500] text-amber-600 rounded-[6px] hover:bg-amber-50 transition-colors disabled:opacity-40"
                            style={{ border: '1px solid rgba(245,158,11,0.25)' }}>
                            {processingAction?.id === approvalId && processingAction?.action === 'ADJUST' ? <PiSpinner className="animate-spin text-[13px]" /> : <PiClock className="text-[13px]" />} Adjust
                        </button>
                        <button onClick={() => handleApproval(approvalId, 'APPROVE')} disabled={processingAction !== null}
                            className="flex items-center gap-1.5 px-3 py-2.5 text-[12px] font-[600] text-white bg-[#6366F1] rounded-[6px] hover:bg-indigo-600 transition-colors disabled:opacity-40">
                            {processingAction?.id === approvalId && processingAction?.action === 'APPROVE' ? <PiSpinner className="animate-spin text-[13px]" /> : <PiCheckCircle className="text-[13px]" />} Approve
                        </button>
                    </div>
                </div>
            </td>
        </tr>
    );
}

function TableShell({ cols, children }: { cols: string[]; children: React.ReactNode }) {
    return (
        <div className="bg-white rounded-[8px] overflow-hidden" style={CARD_STYLE}>
            <div className="overflow-x-auto">
                <table className="w-full min-w-[700px]">
                    <thead>
                        <tr className="bg-gray-50/60" style={{ borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
                            {cols.map(c => (
                                <th key={c} className="px-5 py-2.5 text-left text-[10.5px] font-[500] uppercase tracking-[0.08em] text-gray-400 whitespace-nowrap">{c}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>{children}</tbody>
                </table>
            </div>
        </div>
    );
}

function UserCell({ name, sub }: { name: string | null; sub?: string | null }) {
    const initials = (name || 'U').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
    return (
        <div className="flex items-center gap-2.5">
            <div className="w-[26px] h-[26px] rounded-full bg-indigo-50 flex items-center justify-center text-[9px] font-[600] text-[#6366F1] shrink-0">
                {initials}
            </div>
            <div>
                <p className="text-[12.5px] font-[500] text-gray-900">{name || 'Unknown'}</p>
                {sub && <p className="text-[11px] text-gray-400">{sub}</p>}
            </div>
        </div>
    );
}

function ActionCell({ id, approvalId, selectedItem, setSelectedItem, setComments, setDelegateData, delegateTitle }: any) {
    const isOpen = selectedItem === id;
    return (
        <div className="flex items-center justify-end gap-1.5">
            <button onClick={() => { setSelectedItem(isOpen ? null : id); setComments(""); }}
                className={cn("px-3 py-1.5 rounded-[6px] text-[11.5px] font-[500] transition-colors",
                    isOpen ? "bg-gray-100 text-gray-700" : "text-gray-500 hover:bg-gray-50 hover:text-gray-800")}
                style={{ border: '1px solid rgba(0,0,0,0.09)' }}>
                {isOpen ? 'Close' : 'Review'}
            </button>
            <button onClick={() => setDelegateData({ id: approvalId, title: delegateTitle })}
                className="p-1.5 rounded-[6px] text-gray-400 hover:text-[#6366F1] hover:bg-indigo-50 transition-colors"
                style={{ border: '1px solid rgba(0,0,0,0.09)' }} title="Delegate">
                <PiUserSwitch className="text-[15px]" />
            </button>
        </div>
    );
}

function GridCard({ title, sub, amount, meta, badge, actions }: { title: string; sub: string; amount: number; meta: React.ReactNode; badge?: string; actions: React.ReactNode }) {
    return (
        <div className="bg-white rounded-[8px] flex flex-col" style={CARD_STYLE}>
            <div className="flex items-start justify-between px-4 py-3.5" style={{ borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
                <div>
                    <p className="text-[13px] font-[500] text-gray-900 leading-tight line-clamp-1">{title}</p>
                    <p className="text-[11.5px] text-gray-400 mt-0.5">{sub}</p>
                </div>
                {badge && (
                    <span className="text-[10px] font-[500] text-amber-600 bg-amber-50 px-2 py-0.5 rounded-[4px] shrink-0 ml-2"
                        style={{ border: '1px solid rgba(245,158,11,0.2)' }}>{badge}</span>
                )}
            </div>
            <div className="px-4 py-4 flex-1">
                <p className="text-[20px] font-[600] text-gray-900 tabular-nums tracking-tight">{fmtCurrency(amount)}</p>
                <div className="mt-3 space-y-1.5">{meta}</div>
            </div>
            <div className="px-4 py-3" style={{ borderTop: '1px solid rgba(0,0,0,0.07)' }}>
                {actions}
            </div>
        </div>
    );
}

function MetaRow({ icon: Icon, text }: { icon: any; text: string }) {
    return (
        <p className="flex items-center gap-1.5 text-[11.5px] text-gray-500">
            <Icon className="text-gray-300 text-[13px] shrink-0" />{text}
        </p>
    );
}

function GridActions({ id, approvalId, selectedItem, setSelectedItem, comments, setComments, processingAction, handleApproval, setDelegateData, delegateTitle, extraButton }: any) {
    const isOpen = selectedItem === id;
    if (isOpen) {
        return (
            <div className="space-y-2.5">
                <textarea value={comments} onChange={e => setComments(e.target.value)}
                    placeholder="Add review notes…" rows={2} autoFocus
                    className="w-full bg-white rounded-[6px] px-3 py-2 text-[12px] text-gray-900 placeholder:text-gray-300 outline-none focus:ring-1 focus:ring-[#6366F1] resize-none"
                    style={{ border: '1px solid rgba(0,0,0,0.09)' }} />
                <div className="grid grid-cols-3 gap-1.5">
                    <button onClick={() => handleApproval(approvalId, 'APPROVE')} disabled={processingAction !== null}
                        className="py-2 text-[11.5px] font-[600] text-white bg-[#6366F1] rounded-[6px] hover:bg-indigo-600 flex items-center justify-center gap-1 disabled:opacity-40">
                        {processingAction?.id === approvalId && processingAction?.action === 'APPROVE' ? <PiSpinner className="animate-spin" /> : <PiCheckCircle />} Approve
                    </button>
                    <button onClick={() => handleApproval(approvalId, 'ADJUST')} disabled={processingAction !== null}
                        className="py-2 text-[11.5px] font-[500] text-amber-600 bg-white rounded-[6px] hover:bg-amber-50 flex items-center justify-center gap-1 disabled:opacity-40"
                        style={{ border: '1px solid rgba(245,158,11,0.25)' }}>
                        {processingAction?.id === approvalId && processingAction?.action === 'ADJUST' ? <PiSpinner className="animate-spin" /> : <PiClock />} Adjust
                    </button>
                    <button onClick={() => handleApproval(approvalId, 'REJECT')} disabled={processingAction !== null}
                        className="py-2 text-[11.5px] font-[500] text-red-600 bg-white rounded-[6px] hover:bg-red-50 flex items-center justify-center gap-1 disabled:opacity-40"
                        style={{ border: '1px solid rgba(239,68,68,0.25)' }}>
                        {processingAction?.id === approvalId && processingAction?.action === 'REJECT' ? <PiSpinner className="animate-spin" /> : <PiXCircle />} Reject
                    </button>
                </div>
                <button onClick={() => { setSelectedItem(null); setComments(""); }}
                    className="w-full text-center text-[11.5px] text-gray-400 hover:text-gray-600 py-0.5">Cancel</button>
            </div>
        );
    }
    return (
        <div className="flex gap-2">
            {extraButton}
            <button onClick={() => setSelectedItem(id)}
                className="flex-1 py-2 text-[12px] font-[500] text-gray-600 rounded-[6px] hover:bg-gray-50 transition-colors"
                style={{ border: '1px solid rgba(0,0,0,0.09)' }}>Review</button>
            <button onClick={() => setDelegateData({ id: approvalId, title: delegateTitle })}
                className="px-2.5 py-2 text-gray-400 hover:text-[#6366F1] hover:bg-indigo-50 rounded-[6px] transition-colors"
                style={{ border: '1px solid rgba(0,0,0,0.09)' }} title="Delegate">
                <PiUserSwitch className="text-[15px]" />
            </button>
        </div>
    );
}

export function ApprovalQueue({ expenses, requisitions, budgets = [], invoices = [], history }: ApprovalQueueProps) {
    const { showToast } = useToast();
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<'expenses' | 'requisitions' | 'budgets' | 'invoices' | 'history'>('expenses');
    const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
    const [selectedItem, setSelectedItem] = useState<string | null>(null);
    const [comments, setComments] = useState("");
    const [processingAction, setProcessingAction] = useState<{ id: string; action: string } | null>(null);
    const [showReceipt, setShowReceipt] = useState<string | null>(null);
    const [delegateData, setDelegateData] = useState<{ id: string; title: string } | null>(null);

    useEffect(() => { setSelectedItem(null); setComments(""); }, [activeTab]);

    useEffect(() => {
        if (expenses.length > 0) setActiveTab('expenses');
        else if (requisitions.length > 0) setActiveTab('requisitions');
        else if (budgets.length > 0) setActiveTab('budgets');
        else if (invoices.length > 0) setActiveTab('invoices');
    }, []);

    const handleApproval = async (approvalId: string, action: 'APPROVE' | 'REJECT' | 'ADJUST') => {
        setProcessingAction({ id: approvalId, action });
        try {
            const res = await fetch(`/api/approvals/${approvalId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ decision: action === 'APPROVE' ? 'APPROVED' : action === 'REJECT' ? 'REJECTED' : 'ADJUSTMENT', comments: comments || undefined })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed');
            showToast(data.message || `${action.toLowerCase()}d`, action === 'APPROVE' ? 'success' : 'info');
            setSelectedItem(null); setComments(""); router.refresh();
        } catch (e: any) {
            showToast(e.message || 'Failed to process approval', 'error');
        } finally {
            setProcessingAction(null);
        }
    };

    const navItems = [
        { id: 'expenses' as const,     label: 'Expenses',      count: expenses.length,     icon: PiReceipt },
        { id: 'requisitions' as const, label: 'Expenses',  count: requisitions.length, icon: PiFileText },
        { id: 'budgets' as const,      label: 'Budgets',       count: budgets.length,      icon: PiMoney },
        { id: 'invoices' as const,     label: 'Invoices',      count: invoices.length,     icon: PiBuildings },
        { id: 'history' as const,      label: 'History',       count: history.length,      icon: PiListBullets },
    ];

    const totalPending = expenses.length + requisitions.length + budgets.length + invoices.length;

    return (
        <div className="flex -mt-[22px] -mx-[26px] -mb-[52px] min-h-[calc(100vh-64px)]">

            {/* ── SIDEBAR ── */}
            <aside className="w-[200px] shrink-0 bg-white flex flex-col sticky top-0 h-[calc(100vh-64px)] overflow-y-auto"
                style={{ borderRight: '1px solid rgba(0,0,0,0.07)' }}>
                <div className="px-5 pt-5 pb-4" style={{ borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
                    <p className="text-[10px] font-[600] uppercase tracking-[0.08em] text-gray-400">Approvals</p>
                    <h1 className="text-[14px] font-[600] text-gray-900 mt-0.5">Review Queue</h1>
                    {totalPending > 0 && (
                        <p className="text-[22px] font-[600] text-[#6366F1] mt-1 tabular-nums leading-none">
                            {totalPending} <span className="text-[10px] font-[500] text-gray-400 uppercase tracking-[0.06em]">pending</span>
                        </p>
                    )}
                </div>
                <nav className="py-1.5">
                    {navItems.map(item => {
                        const isActive = activeTab === item.id;
                        const Icon = item.icon;
                        return (
                            <button key={item.id} onClick={() => setActiveTab(item.id)}
                                className={cn(
                                    "w-full flex items-center gap-2.5 px-3 py-2.5 rounded-[7px] mx-1.5 my-0.5 text-[13px] font-[500] transition-all text-left",
                                    isActive ? "bg-indigo-50 text-[#6366F1]" : "text-gray-500 hover:bg-gray-50 hover:text-gray-800"
                                )} style={{ width: 'calc(100% - 12px)' }}>
                                <Icon className="shrink-0 text-[15px]" />
                                <span className="flex-1 truncate">{item.label}</span>
                                {(item.count ?? 0) > 0 && (
                                    <span className={cn(
                                        "text-[10px] font-[600] px-1.5 py-0.5 rounded-full min-w-[18px] text-center",
                                        isActive ? "bg-[#6366F1]/15 text-[#6366F1]" : "bg-gray-100 text-gray-500"
                                    )}>{item.count}</span>
                                )}
                            </button>
                        );
                    })}
                </nav>
            </aside>

            {/* ── MAIN CONTENT ── */}
            <div className="flex-1 min-w-0 px-7 py-6">

                {/* Toolbar */}
                {activeTab !== 'history' && (
                    <div className="flex items-center justify-between mb-5">
                        <div>
                            <h2 className="text-[14px] font-[600] text-gray-900 capitalize">{activeTab}</h2>
                            <p className="text-[12px] text-gray-400">
                                {activeTab === 'expenses' ? expenses.length :
                                 activeTab === 'requisitions' ? requisitions.length :
                                 activeTab === 'budgets' ? budgets.length :
                                 invoices.length} pending review
                            </p>
                        </div>
                        <div className="flex items-center rounded-[6px] overflow-hidden" style={{ border: '1px solid rgba(0,0,0,0.09)' }}>
                            <button onClick={() => setViewMode('list')}
                                className={cn("px-2.5 py-1.5 transition-colors", viewMode === 'list' ? "bg-indigo-50 text-[#6366F1]" : "bg-white text-gray-400 hover:bg-gray-50")}>
                                <PiListBullets className="text-[14px]" />
                            </button>
                            <button onClick={() => setViewMode('grid')}
                                className={cn("px-2.5 py-1.5 transition-colors", viewMode === 'grid' ? "bg-indigo-50 text-[#6366F1]" : "bg-white text-gray-400 hover:bg-gray-50")}
                                style={{ borderLeft: '1px solid rgba(0,0,0,0.09)' }}>
                                <PiGridFour className="text-[14px]" />
                            </button>
                        </div>
                    </div>
                )}

                {/* ── EXPENSES ── */}
                {activeTab === 'expenses' && (
                    expenses.length === 0 ? <EmptyState icon={PiReceipt} label="expense" /> :
                    viewMode === 'grid' ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                            {expenses.map(exp => (
                                <GridCard key={exp.id}
                                    title={exp.title} sub={exp.user.name || 'Unknown'}
                                    amount={exp.amount} badge="Pending"
                                    meta={<>
                                        <MetaRow icon={PiBuildings} text={exp.user.department || 'N/A'} />
                                        <MetaRow icon={PiCalendar} text={fmtDate(exp.expenseDate)} />
                                        {exp.merchant && <MetaRow icon={PiUser} text={exp.merchant} />}
                                    </>}
                                    actions={
                                        <GridActions id={exp.id} approvalId={(exp as any).approvalId}
                                            selectedItem={selectedItem} setSelectedItem={setSelectedItem}
                                            comments={comments} setComments={setComments}
                                            processingAction={processingAction} handleApproval={handleApproval}
                                            setDelegateData={setDelegateData} delegateTitle={exp.title}
                                            extraButton={exp.receiptUrl && (
                                                <button onClick={() => setShowReceipt(exp.receiptUrl)}
                                                    className="px-2.5 py-2 text-[#6366F1] hover:bg-indigo-50 rounded-[6px] transition-colors"
                                                    style={{ border: '1px solid rgba(0,0,0,0.09)' }}>
                                                    <PiEye className="text-[15px]" />
                                                </button>
                                            )}
                                        />
                                    }
                                />
                            ))}
                        </div>
                    ) : (
                        <TableShell cols={['Date', 'Title / Category', 'Originator', 'Amount', 'Actions']}>
                            {expenses.map(exp => (
                                <Fragment key={exp.id}>
                                    <tr className="hover:bg-gray-50/60 transition-colors group" style={ROW_BORDER}>
                                        <td className="px-5 py-3.5 text-[12px] text-gray-400 whitespace-nowrap">{fmtDate(exp.createdAt)}</td>
                                        <td className="px-5 py-3.5">
                                            <p className="text-[13px] font-[500] text-gray-900">{exp.title}</p>
                                            <div className="flex items-center gap-2 mt-0.5">
                                                <p className="text-[11.5px] text-gray-400">{exp.category}</p>
                                                {exp.receiptUrl && (
                                                    <button onClick={() => setShowReceipt(exp.receiptUrl)}
                                                        className="flex items-center gap-0.5 text-[10.5px] text-[#6366F1] hover:underline">
                                                        <PiEye className="text-[11px]" /> receipt
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-5 py-3.5"><UserCell name={exp.user.name} sub={exp.user.department} /></td>
                                        <td className="px-5 py-3.5 text-[13px] font-[500] text-gray-900 tabular-nums font-mono whitespace-nowrap">{fmtCurrency(exp.amount)}</td>
                                        <td className="px-5 py-3.5">
                                            <ActionCell id={exp.id} approvalId={(exp as any).approvalId}
                                                selectedItem={selectedItem} setSelectedItem={setSelectedItem}
                                                setComments={setComments} setDelegateData={setDelegateData}
                                                delegateTitle={exp.title} />
                                        </td>
                                    </tr>
                                    {selectedItem === exp.id && (
                                        <ReviewRow approvalId={(exp as any).approvalId}
                                            comments={comments} setComments={setComments}
                                            processingAction={processingAction} handleApproval={handleApproval}
                                            onCancel={() => { setSelectedItem(null); setComments(""); }}
                                            prevComment={exp.approvals?.[0]?.comments}
                                            prevReviewer={exp.approvals?.[0]?.approver?.name} />
                                    )}
                                </Fragment>
                            ))}
                        </TableShell>
                    )
                )}

                {/* ── REQUISITIONS ── */}
                {activeTab === 'requisitions' && (
                    requisitions.length === 0 ? <EmptyState icon={PiFileText} label="expense" /> :
                    viewMode === 'grid' ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                            {requisitions.map(req => (
                                <GridCard key={req.id}
                                    title={req.title} sub={req.user.name || 'Unknown'}
                                    amount={req.amount} badge="Pending"
                                    meta={<>
                                        <MetaRow icon={PiCalendar} text={fmtDate(req.createdAt)} />
                                        {req.businessJustification && (
                                            <p className="text-[11.5px] text-gray-400 italic line-clamp-2 mt-1">"{req.businessJustification}"</p>
                                        )}
                                    </>}
                                    actions={
                                        <GridActions id={req.id} approvalId={(req as any).approvalId}
                                            selectedItem={selectedItem} setSelectedItem={setSelectedItem}
                                            comments={comments} setComments={setComments}
                                            processingAction={processingAction} handleApproval={handleApproval}
                                            setDelegateData={setDelegateData} delegateTitle={req.title} />
                                    }
                                />
                            ))}
                        </div>
                    ) : (
                        <TableShell cols={['Date', 'Title / Category', 'Originator', 'Amount', 'Actions']}>
                            {requisitions.map(req => (
                                <Fragment key={req.id}>
                                    <tr className="hover:bg-gray-50/60 transition-colors" style={ROW_BORDER}>
                                        <td className="px-5 py-3.5 text-[12px] text-gray-400 whitespace-nowrap">{fmtDate(req.createdAt)}</td>
                                        <td className="px-5 py-3.5">
                                            <p className="text-[13px] font-[500] text-gray-900">{req.title}</p>
                                            <p className="text-[11.5px] text-gray-400 mt-0.5">{req.category}</p>
                                        </td>
                                        <td className="px-5 py-3.5"><UserCell name={req.user.name} sub={req.user.department} /></td>
                                        <td className="px-5 py-3.5 text-[13px] font-[500] text-gray-900 tabular-nums font-mono whitespace-nowrap">{fmtCurrency(req.amount)}</td>
                                        <td className="px-5 py-3.5">
                                            <ActionCell id={req.id} approvalId={(req as any).approvalId}
                                                selectedItem={selectedItem} setSelectedItem={setSelectedItem}
                                                setComments={setComments} setDelegateData={setDelegateData}
                                                delegateTitle={req.title} />
                                        </td>
                                    </tr>
                                    {selectedItem === req.id && (
                                        <ReviewRow approvalId={(req as any).approvalId}
                                            comments={comments} setComments={setComments}
                                            processingAction={processingAction} handleApproval={handleApproval}
                                            onCancel={() => { setSelectedItem(null); setComments(""); }}
                                            prevComment={req.approvals?.[0]?.comments}
                                            prevReviewer={req.approvals?.[0]?.approver?.name} />
                                    )}
                                </Fragment>
                            ))}
                        </TableShell>
                    )
                )}

                {/* ── BUDGETS ── */}
                {activeTab === 'budgets' && (
                    budgets.length === 0 ? <EmptyState icon={PiMoney} label="budget" /> :
                    viewMode === 'grid' ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                            {budgets.map(b => {
                                const title = `${MONTHS[b.month - 1]} ${b.year} Budget`;
                                return (
                                    <GridCard key={b.id}
                                        title={title} sub={b.user.name || 'Unknown'}
                                        amount={b.totalAmount} badge="Pending"
                                        meta={<>
                                            <MetaRow icon={PiBuildings} text={`${b.branch} · ${b.department}`} />
                                            <MetaRow icon={PiCalendar} text={fmtDate(b.createdAt)} />
                                        </>}
                                        actions={
                                            <GridActions id={b.id} approvalId={(b as any).approvalId}
                                                selectedItem={selectedItem} setSelectedItem={setSelectedItem}
                                                comments={comments} setComments={setComments}
                                                processingAction={processingAction} handleApproval={handleApproval}
                                                setDelegateData={setDelegateData} delegateTitle={title} />
                                        }
                                    />
                                );
                            })}
                        </div>
                    ) : (
                        <TableShell cols={['Date', 'Period / Plan', 'Originator', 'Amount', 'Actions']}>
                            {budgets.map(b => {
                                const title = `${MONTHS_SHORT[b.month - 1]} ${b.year} Budget`;
                                return (
                                    <Fragment key={b.id}>
                                        <tr className="hover:bg-gray-50/60 transition-colors" style={ROW_BORDER}>
                                            <td className="px-5 py-3.5 text-[12px] text-gray-400 whitespace-nowrap">{fmtDate(b.createdAt)}</td>
                                            <td className="px-5 py-3.5">
                                                <p className="text-[13px] font-[500] text-gray-900">{title}</p>
                                                <p className="text-[11.5px] text-gray-400 mt-0.5">{b.branch} · {b.department}</p>
                                            </td>
                                            <td className="px-5 py-3.5"><UserCell name={b.user.name} sub={b.branch} /></td>
                                            <td className="px-5 py-3.5 text-[13px] font-[500] text-gray-900 tabular-nums font-mono whitespace-nowrap">{fmtCurrency(b.totalAmount)}</td>
                                            <td className="px-5 py-3.5">
                                                <ActionCell id={b.id} approvalId={(b as any).approvalId}
                                                    selectedItem={selectedItem} setSelectedItem={setSelectedItem}
                                                    setComments={setComments} setDelegateData={setDelegateData}
                                                    delegateTitle={title} />
                                            </td>
                                        </tr>
                                        {selectedItem === b.id && (
                                            <ReviewRow approvalId={(b as any).approvalId}
                                                comments={comments} setComments={setComments}
                                                processingAction={processingAction} handleApproval={handleApproval}
                                                onCancel={() => { setSelectedItem(null); setComments(""); }}
                                                prevComment={b.approvals?.[0]?.comments}
                                                prevReviewer={b.approvals?.[0]?.approver?.name} />
                                        )}
                                    </Fragment>
                                );
                            })}
                        </TableShell>
                    )
                )}

                {/* ── INVOICES ── */}
                {activeTab === 'invoices' && (
                    invoices.length === 0 ? <EmptyState icon={PiBuildings} label="invoice" /> :
                    viewMode === 'grid' ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                            {invoices.map(inv => (
                                <GridCard key={inv.id}
                                    title={inv.vendor.name} sub={`Inv. ${inv.invoiceNumber}`}
                                    amount={inv.amount} badge="Pending"
                                    meta={<>
                                        <MetaRow icon={PiCalendar} text={`Due ${fmtDate(inv.dueDate)}`} />
                                        <MetaRow icon={PiUser} text={inv.createdBy.name || 'Unknown'} />
                                    </>}
                                    actions={
                                        <GridActions id={inv.id} approvalId={(inv as any).approvalId}
                                            selectedItem={selectedItem} setSelectedItem={setSelectedItem}
                                            comments={comments} setComments={setComments}
                                            processingAction={processingAction} handleApproval={handleApproval}
                                            setDelegateData={setDelegateData} delegateTitle={inv.vendor.name}
                                            extraButton={inv.fileUrl && (
                                                <button onClick={() => window.open(inv.fileUrl!, '_blank')}
                                                    className="px-2.5 py-2 text-[#6366F1] hover:bg-indigo-50 rounded-[6px] transition-colors"
                                                    style={{ border: '1px solid rgba(0,0,0,0.09)' }}>
                                                    <PiEye className="text-[15px]" />
                                                </button>
                                            )}
                                        />
                                    }
                                />
                            ))}
                        </div>
                    ) : (
                        <TableShell cols={['Due Date', 'Invoice / Vendor', 'Originator', 'Amount', 'Actions']}>
                            {invoices.map(inv => (
                                <Fragment key={inv.id}>
                                    <tr className="hover:bg-gray-50/60 transition-colors" style={ROW_BORDER}>
                                        <td className="px-5 py-3.5 text-[12px] text-gray-400 whitespace-nowrap">{fmtDate(inv.dueDate)}</td>
                                        <td className="px-5 py-3.5">
                                            <p className="text-[13px] font-[500] text-gray-900">{inv.invoiceNumber}</p>
                                            <div className="flex items-center gap-2 mt-0.5">
                                                <p className="text-[11.5px] text-gray-400">{inv.vendor.name}</p>
                                                {inv.fileUrl && (
                                                    <button onClick={() => window.open(inv.fileUrl!, '_blank')}
                                                        className="flex items-center gap-0.5 text-[10.5px] text-[#6366F1] hover:underline">
                                                        <PiEye className="text-[11px]" /> file
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-5 py-3.5"><UserCell name={inv.createdBy.name} /></td>
                                        <td className="px-5 py-3.5 text-[13px] font-[500] text-gray-900 tabular-nums font-mono whitespace-nowrap">{fmtCurrency(inv.amount)}</td>
                                        <td className="px-5 py-3.5">
                                            <ActionCell id={inv.id} approvalId={(inv as any).approvalId}
                                                selectedItem={selectedItem} setSelectedItem={setSelectedItem}
                                                setComments={setComments} setDelegateData={setDelegateData}
                                                delegateTitle={inv.vendor.name} />
                                        </td>
                                    </tr>
                                    {selectedItem === inv.id && (
                                        <ReviewRow approvalId={(inv as any).approvalId}
                                            comments={comments} setComments={setComments}
                                            processingAction={processingAction} handleApproval={handleApproval}
                                            onCancel={() => { setSelectedItem(null); setComments(""); }}
                                            prevComment={inv.approvals?.[0]?.comments}
                                            prevReviewer={inv.approvals?.[0]?.approver?.name} />
                                    )}
                                </Fragment>
                            ))}
                        </TableShell>
                    )
                )}

                {/* ── HISTORY ── */}
                {activeTab === 'history' && (
                    <div>
                        <h2 className="text-[14px] font-[600] text-gray-900 mb-5">Approval History</h2>
                        {history.length === 0 ? (
                            <EmptyState icon={PiListBullets} label="history" />
                        ) : (
                            <div className="bg-white rounded-[8px] overflow-hidden" style={CARD_STYLE}>
                                {history.map((a, idx) => {
                                    const itemTitle = a.expense?.title || a.requisition?.title ||
                                        (a.monthlyBudget && `${MONTHS[a.monthlyBudget.month - 1]} ${a.monthlyBudget.year} Budget`) ||
                                        (a.invoice && `Invoice ${a.invoice.invoiceNumber}`) || 'Deleted item';
                                    const type = a.expense ? 'Expense' : a.requisition ? 'Requisition' : a.monthlyBudget ? 'Budget' : 'Invoice';
                                    return (
                                        <div key={a.id} className="flex items-center justify-between px-5 py-3.5 hover:bg-gray-50/60 transition-colors"
                                            style={idx < history.length - 1 ? ROW_BORDER : {}}>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-[13px] font-[500] text-gray-900 truncate">{itemTitle}</p>
                                                <div className="flex items-center gap-2 mt-0.5">
                                                    <span className="text-[11px] text-gray-400">{type}</span>
                                                    <span className="text-gray-200">·</span>
                                                    <span className="text-[11px] text-gray-400">{fmtDate(a.createdAt)}</span>
                                                    {a.comments && <span className="text-[11px] text-gray-500 italic truncate max-w-[200px]">"{a.comments}"</span>}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3 shrink-0 ml-4">
                                                {a.expense?.receiptUrl && (
                                                    <button onClick={() => setShowReceipt(a.expense!.receiptUrl)}
                                                        className="flex items-center gap-1 text-[11.5px] text-[#6366F1] hover:underline">
                                                        <PiEye className="text-[13px]" /> View
                                                    </button>
                                                )}
                                                <span className={cn(
                                                    "text-[10.5px] font-[500] px-2 py-0.5 rounded-[4px]",
                                                    a.status === 'APPROVED' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                                                )} style={{ border: a.status === 'APPROVED' ? '1px solid rgba(16,185,129,0.2)' : '1px solid rgba(239,68,68,0.2)' }}>
                                                    {a.status === 'APPROVED' ? 'Approved' : 'Rejected'}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* ── RECEIPT MODAL ── */}
            {showReceipt && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/30" onClick={() => setShowReceipt(null)} />
                    <div className="relative bg-white rounded-[12px] w-full max-w-lg overflow-hidden z-10"
                        style={{ border: '1px solid rgba(0,0,0,0.09)', boxShadow: '0 20px 60px rgba(0,0,0,0.18)' }}>
                        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
                            <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-[7px] bg-indigo-50 flex items-center justify-center">
                                    <PiReceipt className="text-[#6366F1] text-[15px]" />
                                </div>
                                <div>
                                    <h3 className="text-[14px] font-[600] text-gray-900">Expense Evidence</h3>
                                    <p className="text-[11.5px] text-gray-400">Supporting document</p>
                                </div>
                            </div>
                            <button onClick={() => setShowReceipt(null)}
                                className="p-1.5 rounded-[5px] hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors">
                                <PiX className="text-[15px]" />
                            </button>
                        </div>
                        <div className="p-5">
                            <div className="relative aspect-[3/4] w-full rounded-[8px] overflow-hidden bg-gray-50"
                                style={{ border: '1px solid rgba(0,0,0,0.07)' }}>
                                <Image src={showReceipt} alt="Receipt" fill className="object-contain p-4" unoptimized />
                            </div>
                        </div>
                        <div className="flex items-center justify-between px-5 py-4" style={{ borderTop: '1px solid rgba(0,0,0,0.07)' }}>
                            <p className="text-[11.5px] text-gray-400 truncate max-w-[60%]">
                                {showReceipt.split('/').pop()}
                            </p>
                            <button onClick={() => window.open(showReceipt, '_blank')}
                                className="text-[12.5px] font-[500] text-[#6366F1] hover:text-indigo-700 transition-colors">
                                Open original →
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── DELEGATE MODAL ── */}
            {delegateData && (
                <DelegateModal approvalId={delegateData.id} itemTitle={delegateData.title}
                    onClose={() => setDelegateData(null)}
                    onSuccess={() => { showToast("Approval delegated", "success"); router.refresh(); }} />
            )}
        </div>
    );
}
