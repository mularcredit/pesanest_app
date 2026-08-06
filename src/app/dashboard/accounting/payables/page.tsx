import prisma from "@/lib/prisma";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import {
    PiInvoice, PiClock, PiCheckCircle, PiWarning, PiCalendar
} from "react-icons/pi";
import { PayableInvoiceCard } from "@/components/accounting/PayableInvoiceCard";
import { PayablesLedger } from "@/components/accounting/PayablesLedger";
import { PayablesHeaderActions } from "@/components/accounting/PayablesHeaderActions";

const CARD_STYLE: React.CSSProperties = { border: '1px solid rgba(0,0,0,0.09)' };

export default async function AccountsPayablePage() {
    const session = await auth();
    if (!session?.user) return redirect("/login");

    const invoicesRaw = await prisma.invoice.findMany({
        include: { vendor: true },
        orderBy: { dueDate: 'asc' }
    });

    const invoices = invoicesRaw.map(inv => ({
        ...inv,
        amount: Number(inv.amount),
        taxAmount: Number(inv.taxAmount)
    }));

    const vendors = await prisma.vendor.findMany({
        where: { isActive: true },
        select: { id: true, name: true },
        orderBy: { name: 'asc' }
    });

    // Outstanding = still owed and actionable here. DRAFT hasn't been submitted yet
    // and REJECTED needs resubmission elsewhere, so neither belongs on this ledger.
    const outstanding = invoices.filter(i => ['APPROVED', 'PENDING_APPROVAL'].includes(i.status));

    const totalPayable = outstanding.reduce((sum, inv) => sum + inv.amount, 0);

    const overdue = outstanding.filter(i => new Date(i.dueDate) < new Date());

    const dueThisWeek = outstanding.filter(i => {
        const due = new Date(i.dueDate);
        const weekFromNow = new Date();
        weekFromNow.setDate(weekFromNow.getDate() + 7);
        return due <= weekFromNow && due >= new Date();
    });

    const pending = outstanding.filter(i => i.status === 'PENDING_APPROVAL');

    const fmt = (n: number) => `KES ${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    const stats = [
        {
            label: 'Total Outstanding',
            value: fmt(totalPayable),
            sub: `${outstanding.length} invoices`,
            iconCls: 'text-[#6366F1] bg-indigo-50',
            icon: PiInvoice,
        },
        {
            label: 'Overdue',
            value: overdue.length.toString(),
            sub: overdue.length > 0 ? fmt(overdue.reduce((s, i) => s + i.amount, 0)) : 'None overdue',
            iconCls: 'text-rose-600 bg-rose-50',
            icon: PiWarning,
        },
        {
            label: 'Due This Week',
            value: dueThisWeek.length.toString(),
            sub: dueThisWeek.length > 0 ? fmt(dueThisWeek.reduce((s, i) => s + i.amount, 0)) : 'Nothing due',
            iconCls: 'text-amber-600 bg-amber-50',
            icon: PiClock,
        },
        {
            label: 'Pending Approval',
            value: pending.length.toString(),
            sub: 'Awaiting review',
            iconCls: 'text-blue-600 bg-blue-50',
            icon: PiCheckCircle,
        },
    ];

    return (
        <div className="space-y-6 pb-24">
            {/* Header */}
            <div className="flex items-start justify-between">
                <div>
                    <h1 className="text-[20px] font-[600] text-gray-900 tracking-tight">Accounts Payable</h1>
                    <p className="text-[12.5px] text-gray-400 mt-0.5">Vendor invoices and payment obligations</p>
                </div>
                <PayablesHeaderActions vendors={vendors} />
            </div>

            {/* Summary Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {stats.map(s => {
                    const Icon = s.icon;
                    return (
                        <div key={s.label} className="bg-white rounded-[8px] px-5 py-4" style={CARD_STYLE}>
                            <div className="flex items-center justify-between mb-3">
                                <div className={`w-8 h-8 rounded-[7px] flex items-center justify-center ${s.iconCls}`}>
                                    <Icon className="text-[15px]" />
                                </div>
                                <span className="text-[10px] font-[500] text-gray-400 uppercase tracking-[0.06em]">
                                    {s.label}
                                </span>
                            </div>
                            <p className="text-[22px] font-[600] text-gray-900 tracking-tight tabular-nums">{s.value}</p>
                            <p className="text-[11.5px] text-gray-400 mt-0.5">{s.sub}</p>
                        </div>
                    );
                })}
            </div>

            {/* Overdue Invoices */}
            {overdue.length > 0 && (
                <div className="bg-white rounded-[8px] overflow-hidden" style={CARD_STYLE}>
                    <div className="px-5 py-4 flex items-center gap-3"
                        style={{ borderBottom: '1px solid rgba(0,0,0,0.07)', background: 'rgba(254,242,242,0.5)' }}>
                        <div className="w-7 h-7 rounded-[7px] bg-rose-50 flex items-center justify-center shrink-0"
                            style={{ border: '1px solid rgba(239,68,68,0.2)' }}>
                            <PiWarning className="text-rose-500 text-[14px]" />
                        </div>
                        <h2 className="text-[13px] font-[600] text-gray-900">Overdue Invoices</h2>
                        <span className="text-[10px] font-[600] px-2 py-0.5 rounded-[4px] text-rose-600 bg-rose-50 ml-1"
                            style={{ border: '1px solid rgba(239,68,68,0.2)' }}>
                            {overdue.length}
                        </span>
                    </div>
                    <div className="p-4 space-y-2">
                        {overdue.slice(0, 5).map(invoice => (
                            <PayableInvoiceCard key={invoice.id} invoice={invoice} variant="overdue" />
                        ))}
                        {overdue.length > 5 && (
                            <p className="text-[11.5px] text-gray-400 text-center pt-2">
                                +{overdue.length - 5} more overdue invoices
                            </p>
                        )}
                    </div>
                </div>
            )}

            {/* Due This Week */}
            {dueThisWeek.length > 0 && (
                <div className="bg-white rounded-[8px] overflow-hidden" style={CARD_STYLE}>
                    <div className="px-5 py-4 flex items-center gap-3"
                        style={{ borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
                        <div className="w-7 h-7 rounded-[7px] bg-amber-50 flex items-center justify-center shrink-0"
                            style={{ border: '1px solid rgba(245,158,11,0.2)' }}>
                            <PiCalendar className="text-amber-500 text-[14px]" />
                        </div>
                        <h2 className="text-[13px] font-[600] text-gray-900">Due This Week</h2>
                        <span className="text-[10px] font-[600] px-2 py-0.5 rounded-[4px] text-amber-600 bg-amber-50 ml-1"
                            style={{ border: '1px solid rgba(245,158,11,0.2)' }}>
                            {dueThisWeek.length}
                        </span>
                    </div>
                    <div className="p-4 space-y-2">
                        {dueThisWeek.map(invoice => (
                            <PayableInvoiceCard key={invoice.id} invoice={invoice} variant="upcoming" />
                        ))}
                    </div>
                </div>
            )}

            {/* Empty state when no urgent items */}
            {overdue.length === 0 && dueThisWeek.length === 0 && outstanding.length === 0 && (
                <div className="bg-white rounded-[8px] py-16 flex flex-col items-center" style={CARD_STYLE}>
                    <div className="w-10 h-10 rounded-[8px] bg-emerald-50 flex items-center justify-center mb-3"
                        style={{ border: '1px solid rgba(16,185,129,0.2)' }}>
                        <PiCheckCircle className="text-emerald-500 text-[20px]" />
                    </div>
                    <p className="text-[13px] font-[500] text-gray-700 mb-0.5">All caught up</p>
                    <p className="text-[12px] text-gray-400">No outstanding payables</p>
                </div>
            )}

            {/* Full ledger — every outstanding invoice, regardless of due date */}
            {outstanding.length > 0 && (
                <div>
                    <h2 className="text-[13px] font-[600] text-gray-900 mb-3">All Payables</h2>
                    <PayablesLedger invoices={outstanding} />
                </div>
            )}
        </div>
    );
}
