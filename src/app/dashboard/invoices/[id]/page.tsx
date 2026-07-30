import prisma from "@/lib/prisma";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
    PiArrowLeft, PiBuildings, PiCalendarBlank, PiCheckCircle,
    PiClock, PiFileText, PiPaperclip, PiReceipt, PiWarningCircle,
} from "react-icons/pi";
import { cn } from "@/lib/utils";
import { InvoiceActions } from "./InvoiceActions";
import { requirePermission } from "@/lib/access-control";

export const dynamic = 'force-dynamic';

const CARD_STYLE: React.CSSProperties = { border: '1px solid rgba(0,0,0,0.09)' };

const STATUS_META: Record<string, { label: string; cls: string; border: string; Icon: React.ElementType }> = {
    PAID:             { label: 'Paid',     cls: 'text-emerald-600 bg-emerald-50', border: 'rgba(16,185,129,0.2)',  Icon: PiCheckCircle  },
    APPROVED:         { label: 'Approved', cls: 'text-blue-600 bg-blue-50',       border: 'rgba(59,130,246,0.2)', Icon: PiCheckCircle  },
    PENDING_APPROVAL: { label: 'Pending',  cls: 'text-amber-600 bg-amber-50',     border: 'rgba(245,158,11,0.2)', Icon: PiClock        },
    REJECTED:         { label: 'Rejected', cls: 'text-rose-600 bg-rose-50',       border: 'rgba(239,68,68,0.2)',  Icon: PiWarningCircle },
    DRAFT:            { label: 'Draft',    cls: 'text-gray-500 bg-gray-100',      border: 'rgba(0,0,0,0.09)',     Icon: PiFileText     },
};

function fmtAmt(amount: number, currency: string) {
    return `${currency} ${amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
}

export default async function InvoiceDetailsPage(props: { params: Promise<{ id: string }> }) {
    const params = await props.params;
    const session = await auth();
    requirePermission(session, ['INVOICES.VIEW', 'INVOICES.MANAGE', 'SALES.MANAGE']);

    const invoice = await prisma.invoice.findUnique({
        where: { id: params.id },
        include: {
            vendor: true,
            createdBy: { select: { name: true, email: true, department: true } },
            items: true,
            approvals: {
                include: { approver: { select: { name: true } } },
                orderBy: { createdAt: 'desc' }
            }
        }
    });

    if (!invoice) return redirect("/dashboard/invoices");

    const meta     = STATUS_META[invoice.status] ?? STATUS_META.DRAFT;
    const overdue  = !['PAID','REJECTED','DRAFT'].includes(invoice.status) && invoice.dueDate < new Date();
    const currency = invoice.currency;

    return (
        <div className="space-y-6 pb-24">
            {/* Header */}
            <div className="flex items-start gap-3">
                <Link href="/dashboard/invoices"
                    className="p-1.5 rounded-[6px] text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors mt-0.5 shrink-0"
                    style={{ border: '1px solid rgba(0,0,0,0.09)' }}>
                    <PiArrowLeft className="text-[15px]" />
                </Link>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 flex-wrap">
                        <h1 className="text-[20px] font-[600] text-gray-900 tracking-tight">
                            Invoice #{invoice.invoiceNumber}
                        </h1>
                        <span className={cn('inline-flex items-center gap-1 text-[11px] font-[500] px-2.5 py-0.5 rounded-[4px]', meta.cls)}
                            style={{ border: `1px solid ${meta.border}` }}>
                            <meta.Icon className="text-[12px]" />
                            {meta.label}
                        </span>
                    </div>
                    <p className="text-[13px] text-gray-400 mt-1 flex items-center gap-1.5">
                        <PiBuildings className="text-[13px]" /> {invoice.vendor.name}
                    </p>
                </div>
                <InvoiceActions id={invoice.id} invoiceNumber={invoice.invoiceNumber} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                {/* ── Main content ── */}
                <div className="lg:col-span-2 space-y-5">

                    {/* Details card */}
                    <div className="bg-white rounded-[8px] px-5 py-5" style={CARD_STYLE}>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
                            <div>
                                <p className="text-[10.5px] font-[500] uppercase tracking-[0.07em] text-gray-400 mb-1">Invoice Date</p>
                                <p className="text-[13px] font-[500] text-gray-900 flex items-center gap-1.5">
                                    <PiCalendarBlank className="text-gray-300 text-[13px]" />
                                    {invoice.invoiceDate.toLocaleDateString()}
                                </p>
                            </div>
                            <div>
                                <p className="text-[10.5px] font-[500] uppercase tracking-[0.07em] text-gray-400 mb-1">Due Date</p>
                                <p className={cn('text-[13px] font-[500] flex items-center gap-1.5', overdue ? 'text-rose-500' : 'text-gray-900')}>
                                    <PiCalendarBlank className="text-[13px] opacity-60" />
                                    {invoice.dueDate.toLocaleDateString()}
                                </p>
                                {overdue && <p className="text-[10.5px] text-rose-400 mt-0.5">Overdue</p>}
                            </div>
                            <div>
                                <p className="text-[10.5px] font-[500] uppercase tracking-[0.07em] text-gray-400 mb-1">Total Amount</p>
                                <p className="text-[20px] font-[700] text-gray-900 tabular-nums">
                                    {fmtAmt(Number(invoice.amount), currency)}
                                </p>
                            </div>
                            <div>
                                <p className="text-[10.5px] font-[500] uppercase tracking-[0.07em] text-gray-400 mb-1">Currency</p>
                                <p className="text-[13px] font-[600] text-gray-900">{currency}</p>
                            </div>
                        </div>

                        {invoice.description && (
                            <div className="mt-5 pt-5" style={{ borderTop: '1px solid rgba(0,0,0,0.07)' }}>
                                <p className="text-[10.5px] font-[500] uppercase tracking-[0.07em] text-gray-400 mb-2">Description</p>
                                <p className="text-[13px] text-gray-600 bg-gray-50/60 px-4 py-3 rounded-[6px]"
                                    style={{ border: '1px solid rgba(0,0,0,0.07)' }}>
                                    {invoice.description}
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Line items table */}
                    <div className="bg-white rounded-[8px] overflow-hidden" style={CARD_STYLE}>
                        <div className="flex items-center gap-3 px-5 py-4" style={{ borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
                            <PiReceipt className="text-emerald-500 text-[15px]" />
                            <h3 className="text-[13.5px] font-[600] text-gray-900">Line Items</h3>
                        </div>
                        <table className="w-full">
                            <thead>
                                <tr className="bg-gray-50/60" style={{ borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
                                    {['Description', 'Category', 'Qty', 'Unit Price', 'Total'].map((h, i) => (
                                        <th key={h} className={cn(
                                            'px-5 py-2.5 text-[10.5px] font-[500] uppercase tracking-[0.08em] text-gray-400',
                                            i >= 2 ? 'text-right' : 'text-left'
                                        )}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {invoice.items.map((item, idx) => (
                                    <tr key={item.id} className="hover:bg-gray-50/60 transition-colors"
                                        style={idx < invoice.items.length - 1 ? { borderBottom: '1px solid rgba(0,0,0,0.06)' } : {}}>
                                        <td className="px-5 py-3.5 text-[13px] font-[500] text-gray-900">{item.description}</td>
                                        <td className="px-5 py-3.5 text-[12.5px] text-gray-400">{item.category || '—'}</td>
                                        <td className="px-5 py-3.5 text-right font-mono text-[12.5px] text-gray-500 tabular-nums">{item.quantity}</td>
                                        <td className="px-5 py-3.5 text-right font-mono text-[12.5px] text-gray-500 tabular-nums">{fmtAmt(Number(item.unitPrice), currency)}</td>
                                        <td className="px-5 py-3.5 text-right font-mono text-[13px] font-[600] text-gray-900 tabular-nums">{fmtAmt(Number(item.total), currency)}</td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot style={{ borderTop: '1px solid rgba(0,0,0,0.07)' }}>
                                <tr className="bg-gray-50/60">
                                    <td colSpan={4} className="px-5 py-3.5 text-right text-[11px] font-[600] uppercase tracking-[0.07em] text-gray-400">
                                        Total Amount
                                    </td>
                                    <td className="px-5 py-3.5 text-right text-[16px] font-[700] text-emerald-600 tabular-nums">
                                        {fmtAmt(Number(invoice.amount), currency)}
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>

                {/* ── Sidebar ── */}
                <div className="space-y-4">

                    {/* Attachment card */}
                    {invoice.fileUrl ? (
                        <div className="bg-white rounded-[8px] overflow-hidden" style={CARD_STYLE}>
                            <div className="flex items-center gap-2.5 px-5 py-4" style={{ borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
                                <PiPaperclip className="text-emerald-500 text-[14px]" />
                                <h3 className="text-[13px] font-[600] text-gray-900">Attachment</h3>
                            </div>
                            <div className="px-5 py-5 text-center">
                                <div className="w-12 h-12 mx-auto bg-gray-50 rounded-[8px] flex items-center justify-center mb-3"
                                    style={{ border: '1px solid rgba(0,0,0,0.07)' }}>
                                    <PiFileText className="text-gray-300 text-xl" />
                                </div>
                                <p className="text-[13px] font-[500] text-gray-700 mb-3">Invoice Document</p>
                                <a href={invoice.fileUrl} target="_blank" rel="noopener noreferrer"
                                    className="inline-flex items-center gap-2 px-4 py-2 rounded-[6px] text-[12.5px] font-[500] text-gray-600 hover:bg-gray-50 transition-colors"
                                    style={{ border: '1px solid rgba(0,0,0,0.09)' }}>
                                    <PiPaperclip className="text-[13px]" /> View File
                                </a>
                            </div>
                        </div>
                    ) : (
                        <div className="bg-white rounded-[8px] px-5 py-6 text-center" style={CARD_STYLE}>
                            <div className="w-10 h-10 mx-auto bg-gray-50 rounded-[8px] flex items-center justify-center mb-2"
                                style={{ border: '1px solid rgba(0,0,0,0.07)' }}>
                                <PiPaperclip className="text-gray-200 text-[18px]" />
                            </div>
                            <p className="text-[12.5px] text-gray-400">No attachment</p>
                        </div>
                    )}

                    {/* Voucher shortcut */}
                    {['APPROVED','PAID'].includes(invoice.status) && (
                        <Link href={`/receipt-studio?invoiceId=${invoice.id}`}
                            className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-[6px] text-[12.5px] font-[500] text-gray-600 hover:bg-gray-50 transition-colors"
                            style={{ border: '1px solid rgba(0,0,0,0.09)' }}>
                            <PiFileText className="text-[14px]" /> View Voucher
                        </Link>
                    )}

                    {/* Info card */}
                    <div className="bg-white rounded-[8px] px-5 py-4 space-y-4" style={CARD_STYLE}>
                        <p className="text-[11px] font-[600] uppercase tracking-[0.07em] text-gray-400"
                            style={{ borderBottom: '1px solid rgba(0,0,0,0.07)', paddingBottom: '10px' }}>
                            Information
                        </p>
                        <div>
                            <p className="text-[10.5px] font-[500] uppercase tracking-[0.07em] text-gray-400 mb-1">Created by</p>
                            <p className="text-[13px] font-[500] text-gray-900">{invoice.createdBy.name}</p>
                            {invoice.createdBy.email && <p className="text-[11.5px] text-gray-400">{invoice.createdBy.email}</p>}
                            {invoice.createdBy.department && <p className="text-[11.5px] text-gray-400 capitalize">{invoice.createdBy.department.toLowerCase()}</p>}
                        </div>
                        <div>
                            <p className="text-[10.5px] font-[500] uppercase tracking-[0.07em] text-gray-400 mb-1">Record ID</p>
                            <p className="text-[11px] font-mono text-gray-400 break-all">{invoice.id}</p>
                        </div>
                    </div>

                    {/* Approval history */}
                    {invoice.approvals.length > 0 && (
                        <div className="bg-white rounded-[8px] overflow-hidden" style={CARD_STYLE}>
                            <div className="flex items-center gap-2.5 px-5 py-4" style={{ borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
                                <PiCheckCircle className="text-emerald-500 text-[14px]" />
                                <h3 className="text-[13px] font-[600] text-gray-900">Approval History</h3>
                            </div>
                            <div>
                                {invoice.approvals.map((approval, idx) => (
                                    <div key={approval.id} className="px-5 py-4"
                                        style={idx < invoice.approvals.length - 1 ? { borderBottom: '1px solid rgba(0,0,0,0.06)' } : {}}>
                                        <div className="flex justify-between items-start mb-1.5">
                                            <span className="text-[12.5px] font-[500] text-gray-900">{approval.approver.name}</span>
                                            <span className="text-[10.5px] text-gray-400">{new Date(approval.createdAt).toLocaleDateString()}</span>
                                        </div>
                                        <span className={cn(
                                            'inline-flex text-[10px] font-[500] px-1.5 py-0.5 rounded-[3px]',
                                            approval.status === 'APPROVED' ? 'text-emerald-600 bg-emerald-50' : 'text-rose-600 bg-rose-50'
                                        )}>
                                            {approval.status}
                                        </span>
                                        {approval.comments && (
                                            <p className="text-[11.5px] text-gray-400 italic mt-1.5">"{approval.comments}"</p>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
