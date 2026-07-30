"use server";

import prisma from "@/lib/prisma";
import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { RequisitionItemActions } from "@/components/requisitions/RequisitionItemActions";
import { AdjustmentPanel } from "@/components/requisitions/AdjustmentPanel";
import {
    PiCaretLeft,
    PiCaretRight,
    PiCheckCircle,
    PiXCircle,
    PiClock,
    PiReceipt,
    PiArrowsClockwise,
    PiUser,
    PiBuildings,
    PiMapPin,
    PiCurrencyDollar,
    PiTag,
    PiCalendar,
    PiStorefront,
    PiCreditCard,
    PiHashStraight,
} from "react-icons/pi";

function formatCurrency(amount: number, currency: string = 'KES') {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount);
}

function StatusBadge({ status }: { status: string }) {
    const s = status.toUpperCase();
    const styles: Record<string, string> = {
        APPROVED:             "bg-emerald-50 text-emerald-700",
        PAID:                 "bg-emerald-50 text-emerald-700",
        FULFILLED:            "bg-emerald-50 text-emerald-700",
        PENDING:              "bg-amber-50 text-amber-700",
        REJECTED:             "bg-red-50 text-red-700",
        CLOSED:               "bg-gray-100 text-gray-500",
        ADJUSTMENT_REQUIRED:  "bg-orange-50 text-orange-700",
        NEEDS_INFO:           "bg-blue-50 text-blue-700",
    };
    return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[5px] text-[11.5px] font-[500] ${styles[s] ?? "bg-gray-100 text-gray-500"}`}>
            <span className={`w-[5px] h-[5px] rounded-full ${
                s === 'APPROVED' || s === 'PAID' || s === 'FULFILLED' ? 'bg-emerald-500' :
                s === 'PENDING' ? 'bg-amber-400' :
                s === 'REJECTED' ? 'bg-red-500' :
                s === 'ADJUSTMENT_REQUIRED' ? 'bg-orange-400' :
                s === 'NEEDS_INFO' ? 'bg-blue-400' : 'bg-gray-400'
            }`} />
            {status}
        </span>
    );
}

function PaymentMethodLabel({ method }: { method?: string | null }) {
    const labels: Record<string, string> = {
        MPESA_TILL: "M-Pesa Till",
        MPESA_PAYBILL: "M-Pesa Paybill",
        BANK_TRANSFER: "Bank Transfer",
        AIRTEL_MONEY: "Airtel Money",
        CASH: "Cash",
        CHEQUE: "Cheque",
    };
    if (!method) return <span className="text-gray-400">Not specified</span>;
    return <>{labels[method] ?? method}</>;
}

export default async function RequisitionDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const session = await auth();
    if (!session?.user?.id) redirect("/login");

    const req = await (prisma as any).requisition.findUnique({
        where: { id },
        include: {
            user: { select: { id: true, name: true, email: true, department: true } },
            items: { orderBy: { createdAt: "asc" } },
            approvals: {
                include: { approver: { select: { name: true, role: true } } },
                orderBy: { level: "asc" },
            },
        },
    });

    if (!req) notFound();

    const userRole = (session.user as any).role;
    const isOwner = req.userId === session.user.id;
    const isPrivileged = ["SYSTEM_ADMIN", "FINANCE_APPROVER", "FINANCE_TEAM", "MANAGER", "TEAM_LEADER"].includes(userRole);
    if (!isOwner && !isPrivileged) redirect("/dashboard/requisitions");

    const paymentMethod = req.paymentMethod ?? null;
    const paymentReference = req.paymentReference ?? null;
    const vendorMatch = req.description?.match(/\*\*Preferred Vendor:\*\* (.+)/);
    const vendorFromDesc = vendorMatch ? vendorMatch[1].split("\n")[0] : null;
    const vendor = req.vendor || vendorFromDesc;
    const justification = req.description
        ?.split("\n\n**Preferred Vendor:**")[0]
        ?.split("\n\n**Payment Method:**")[0] || "";

    const card = "bg-white rounded-[8px] overflow-hidden";
    const cardBorder = { border: '1px solid rgba(0,0,0,0.09)' };

    const infoRows = [
        { icon: PiUser,         label: 'Requested By', value: req.user.name },
        { icon: PiBuildings,    label: 'Department',   value: req.user.department || req.user.email },
        { icon: PiMapPin,       label: 'Branch',       value: req.branch || 'Global' },
        { icon: PiTag,          label: 'Category',     value: req.category || 'Uncategorised' },
        ...(vendor ? [{ icon: PiStorefront, label: 'Vendor', value: vendor }] : []),
        { icon: PiCreditCard,   label: 'Payment',      value: <PaymentMethodLabel method={paymentMethod} /> },
        ...(paymentReference ? [{ icon: PiHashStraight, label: 'Reference', value: <span className="font-mono">{paymentReference}</span> }] : []),
        ...(req.expectedDate ? [{ icon: PiCalendar, label: 'Expected', value: new Date(req.expectedDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) }] : []),
        { icon: PiCalendar,     label: 'Submitted',    value: new Date(req.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) },
    ];

    return (
        <div className="flex flex-col overflow-hidden -mt-[22px] -mx-[26px] min-h-[calc(100vh-64px)]">

            {/* Sub-header bar */}
            <div className="flex-shrink-0 h-[52px] border-b bg-white flex items-center px-7 gap-3" style={{ borderColor: 'rgba(0,0,0,0.09)' }}>
                <Link href="/dashboard/requisitions" className="flex items-center gap-1.5 text-[12.5px] text-gray-400 hover:text-gray-700 transition-colors">
                    <PiCaretLeft size={13} />
                    Requisitions
                </Link>
                <PiCaretRight className="text-gray-300 text-xs" />
                <span className="text-[12.5px] font-[500] text-gray-900 truncate max-w-[260px]">{req.title}</span>
                <div className="ml-auto flex items-center gap-2">
                    <StatusBadge status={req.status} />
                    {req.type && req.type !== "STANDARD" && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-[4px] bg-indigo-50 text-indigo-700 text-[10.5px] font-[500]">
                            {req.type.replace(/_/g, " ")}
                        </span>
                    )}
                </div>
            </div>

            {/* Main scrollable content */}
            <main className="flex-1 overflow-y-auto px-7 py-6">
                <div className="grid grid-cols-3 gap-5 items-start">

                    {/* LEFT column */}
                    <div className="space-y-4">

                        {/* Entity info card */}
                        <div className={card} style={cardBorder}>
                            <div className="px-5 py-4 flex items-center gap-2.5">
                                <div className="w-9 h-9 rounded-[7px] bg-indigo-50 flex items-center justify-center flex-shrink-0">
                                    <PiReceipt className="text-[#6366F1]" style={{ fontSize: 15 }} />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-[14px] font-[600] text-gray-900 leading-tight truncate">{req.title}</p>
                                    <p className="text-[11.5px] text-gray-400 font-mono mt-0.5">REQ-{req.id.slice(0, 8).toUpperCase()}</p>
                                </div>
                            </div>

                            <div className="border-t divide-y" style={{ borderColor: 'rgba(0,0,0,0.07)', '--tw-divide-opacity': '1' } as React.CSSProperties}>
                                {/* Amount row — highlighted */}
                                <div className="flex items-center gap-2.5 px-5 py-2.5 bg-indigo-50/40">
                                    <PiCurrencyDollar className="text-[#6366F1] flex-shrink-0 text-xs" />
                                    <div className="flex-1 flex items-center justify-between gap-2">
                                        <span className="text-[11.5px] text-gray-500">Amount</span>
                                        <span className="text-[13px] font-[700] text-[#6366F1] font-mono tabular-nums">
                                            {formatCurrency(req.amount, req.currency)}
                                        </span>
                                    </div>
                                </div>
                                {infoRows.map(({ icon: Icon, label, value }) => (
                                    <div key={label} className="flex items-start gap-2.5 px-5 py-2.5" style={{ borderColor: 'rgba(0,0,0,0.05)' }}>
                                        <Icon className="text-gray-300 flex-shrink-0 mt-[3px] text-xs" />
                                        <div className="flex-1 flex items-start justify-between gap-2">
                                            <span className="text-[11.5px] text-gray-400">{label}</span>
                                            <span className="text-[12px] font-[500] text-gray-900 text-right">{value}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Justification card */}
                        {justification && (
                            <div className={card} style={cardBorder}>
                                <div className="px-5 py-4">
                                    <h3 className="text-[12.5px] font-[600] text-gray-900 mb-3">Purpose &amp; Justification</h3>
                                    <p className="text-[12.5px] text-gray-500 leading-relaxed whitespace-pre-wrap">{justification}</p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* RIGHT: col-span-2 */}
                    <div className="col-span-2 space-y-4">

                        {/* Adjustment panel — shown to owner when status is ADJUSTMENT_REQUIRED */}
                        {isOwner && req.status === 'ADJUSTMENT_REQUIRED' && (() => {
                            const adjApproval = req.approvals.find(
                                (a: any) => a.status === 'ADJUSTMENT' && a.comments
                            ) ?? req.approvals.find((a: any) => a.status === 'ADJUSTMENT');
                            return (
                                <AdjustmentPanel
                                    requisitionId={req.id}
                                    currentAmount={req.amount}
                                    currency={req.currency}
                                    currentTitle={req.title}
                                    currentDescription={req.description || ""}
                                    adjustmentComment={{
                                        approverName: adjApproval?.approver?.name ?? "Reviewer",
                                        approverRole: adjApproval?.approver?.role ?? "Approver",
                                        comments: adjApproval?.comments ?? "",
                                        approvedAt: adjApproval?.approvedAt,
                                    }}
                                />
                            );
                        })()}

                        {/* Items table */}
                        {req.items && req.items.length > 0 && (
                            <div className={card} style={cardBorder}>
                                <div className="px-5 py-4 flex items-center justify-between border-b" style={{ borderColor: 'rgba(0,0,0,0.07)' }}>
                                    <h3 className="text-[13px] font-[600] text-gray-900">Itemised Breakdown</h3>
                                    <span className="text-[11.5px] text-gray-400">{req.items.length} {req.items.length === 1 ? "item" : "items"}</span>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left min-w-[520px]">
                                        <thead>
                                            <tr style={{ background: 'rgba(0,0,0,0.02)', borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
                                                <th className="px-5 py-3 text-[10.5px] font-[500] text-gray-400 uppercase tracking-[0.08em]">Item</th>
                                                <th className="py-3 text-[10.5px] font-[500] text-gray-400 uppercase tracking-[0.08em] w-28">Category</th>
                                                <th className="py-3 text-[10.5px] font-[500] text-gray-400 uppercase tracking-[0.08em] w-16 text-center">Qty</th>
                                                <th className="py-3 text-[10.5px] font-[500] text-gray-400 uppercase tracking-[0.08em] w-28 text-right">Unit</th>
                                                <th className="py-3 text-[10.5px] font-[500] text-gray-400 uppercase tracking-[0.08em] w-28 text-right">Total</th>
                                                <th className="pr-5 py-3 text-[10.5px] font-[500] text-gray-400 uppercase tracking-[0.08em] w-32 text-right">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y" style={{ '--tw-divide-opacity': '1', borderColor: 'rgba(0,0,0,0.05)' } as React.CSSProperties}>
                                            {req.items.map((item: any) => (
                                                <tr key={item.id} className="hover:bg-gray-50/50 transition-colors">
                                                    <td className="px-5 py-3.5">
                                                        <p className="text-[13px] font-[500] text-gray-800">{item.title}</p>
                                                        {item.description && (
                                                            <p className="text-[11px] text-gray-400 mt-0.5 leading-relaxed">{item.description}</p>
                                                        )}
                                                        {item.isRecurring && (
                                                            <span className="inline-flex items-center gap-1 mt-1.5 px-1.5 py-0.5 bg-indigo-50 text-[#6366F1] rounded-[4px] text-[9px] font-[500] uppercase tracking-[0.06em]">
                                                                <PiArrowsClockwise /> Recurring
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="py-3.5">
                                                        <span className="text-[11.5px] text-gray-500">{item.category}</span>
                                                    </td>
                                                    <td className="py-3.5 text-center text-[13px] text-gray-700 tabular-nums">{item.quantity}</td>
                                                    <td className="py-3.5 text-right font-mono text-[12.5px] text-gray-500 tabular-nums">
                                                        {formatCurrency(item.unitPrice, req.currency)}
                                                    </td>
                                                    <td className="py-3.5 text-right font-mono text-[13px] font-[600] text-gray-900 tabular-nums">
                                                        {formatCurrency(item.quantity * item.unitPrice, req.currency)}
                                                    </td>
                                                    <td className="pr-5 py-3.5 text-right">
                                                        <RequisitionItemActions
                                                            item={{
                                                                id: item.id,
                                                                title: item.title,
                                                                quantity: item.quantity,
                                                                unitPrice: item.unitPrice,
                                                                totalPrice: item.quantity * item.unitPrice,
                                                                status: item.status || 'PENDING',
                                                                category: item.category,
                                                            }}
                                                            currency={req.currency}
                                                            isPrivileged={isPrivileged}
                                                        />
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                        <tfoot>
                                            <tr style={{ borderTop: '1px solid rgba(0,0,0,0.07)', background: 'rgba(0,0,0,0.02)' }}>
                                                <td colSpan={4} className="px-5 py-3.5 text-[10.5px] font-[600] text-gray-400 uppercase tracking-[0.08em]">Total</td>
                                                <td className="py-3.5 text-right font-mono text-[14px] font-[700] text-[#6366F1] tabular-nums">
                                                    {formatCurrency(req.amount, req.currency)}
                                                </td>
                                                <td />
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                            </div>
                        )}

                        {/* Approval trail */}
                        {req.approvals && req.approvals.length > 0 && (
                            <div className={card} style={cardBorder}>
                                <div className="px-5 py-4 border-b" style={{ borderColor: 'rgba(0,0,0,0.07)' }}>
                                    <h3 className="text-[13px] font-[600] text-gray-900">Approval Trail</h3>
                                </div>
                                <div className="divide-y" style={{ '--tw-divide-opacity': '1' } as React.CSSProperties}>
                                    {req.approvals.map((approval: any) => {
                                        const s = approval.status.toUpperCase();
                                        const isApproved = s === "APPROVED";
                                        const isRejected = s === "REJECTED";
                                        const Icon = isApproved ? PiCheckCircle : isRejected ? PiXCircle : PiClock;
                                        const iconClass = isApproved ? "text-emerald-500" : isRejected ? "text-rose-500" : "text-amber-400";

                                        return (
                                            <div key={approval.id} className="px-5 py-4 flex items-start gap-3">
                                                <Icon className={`text-[18px] mt-0.5 flex-shrink-0 ${iconClass}`} />
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-start justify-between gap-4">
                                                        <div>
                                                            <p className="text-[13px] font-[500] text-gray-900">
                                                                {approval.approver?.name ?? "Pending Assignment"}
                                                                <span className="ml-2 text-[10.5px] text-gray-400 font-mono font-normal">L{approval.level}</span>
                                                            </p>
                                                            <p className="text-[11.5px] text-gray-400 mt-0.5">
                                                                {approval.approver?.role?.replace(/_/g, " ") || "Reviewer"}
                                                            </p>
                                                        </div>
                                                        <div className="text-right flex-shrink-0">
                                                            <StatusBadge status={approval.status} />
                                                            {approval.approvedAt && (
                                                                <p className="text-[10.5px] font-mono text-gray-400 mt-1.5">
                                                                    {new Date(approval.approvedAt).toLocaleString("en-US", {
                                                                        month: "numeric", day: "numeric", year: "numeric",
                                                                        hour: "numeric", minute: "2-digit",
                                                                    })}
                                                                </p>
                                                            )}
                                                        </div>
                                                    </div>
                                                    {approval.comments && (
                                                        <p className="text-[12px] text-gray-500 mt-2 italic leading-relaxed">
                                                            &ldquo;{approval.comments}&rdquo;
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}
