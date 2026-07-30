
import prisma from "@/lib/prisma";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
    PiArrowLeft,
    PiFileText,
    PiReceipt,
    PiBuildings,
    PiMapPin,
    PiPhone,
    PiEnvelope,
    PiGlobe,
    PiMoney,
    PiPlus,
    PiArrowRight,
} from "react-icons/pi";
import { EditCustomerModal } from "@/components/accounting/EditCustomerModal";

const CARD_STYLE: React.CSSProperties = { border: '1px solid rgba(0,0,0,0.09)' };

const formatCurrency = (amount: number, currency = 'KES') => {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency,
    }).format(amount);
};

const SALE_STATUS_META: Record<string, { cls: string; border: string }> = {
    PAID:      { cls: 'text-emerald-600 bg-emerald-50', border: 'rgba(16,185,129,0.2)' },
    PARTIAL:   { cls: 'text-amber-600 bg-amber-50',    border: 'rgba(245,158,11,0.2)' },
    PENDING:   { cls: 'text-amber-600 bg-amber-50',    border: 'rgba(245,158,11,0.2)' },
    DRAFT:     { cls: 'text-gray-500 bg-gray-50',      border: 'rgba(0,0,0,0.09)' },
    OVERDUE:   { cls: 'text-rose-600 bg-rose-50',      border: 'rgba(239,68,68,0.2)' },
    CANCELLED: { cls: 'text-gray-400 bg-gray-50',      border: 'rgba(0,0,0,0.07)' },
};

export default async function CustomerDetailsPage({
    params
}: {
    params: Promise<{ id: string }>
}) {
    const session = await auth();
    if (!session?.user) return redirect("/login");

    const { id } = await params;

    const customer = await prisma.customer.findUnique({
        where: { id },
        include: {
            sales: {
                orderBy: { issueDate: 'desc' },
                take: 5
            },
            payments: {
                orderBy: { paymentDate: 'desc' },
                take: 5
            }
        }
    });

    if (!customer) return redirect("/dashboard/accounting/customers");

    const totalSalesAgg = await prisma.sale.aggregate({
        where: { customerId: id },
        _sum: { totalAmount: true }
    });
    const totalPaymentsAgg = await prisma.customerPayment.aggregate({
        where: { customerId: id },
        _sum: { amount: true }
    });

    const totalInvoiced = Number(totalSalesAgg._sum.totalAmount || 0);
    const totalPaid = Number(totalPaymentsAgg._sum.amount || 0);
    const balance = totalInvoiced - totalPaid;

    return (
        <div className="space-y-6 pb-12">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Link
                        href="/dashboard/accounting/customers"
                        className="p-2 rounded-[6px] bg-white hover:bg-gray-50 text-gray-400 hover:text-gray-700 transition-colors"
                        style={CARD_STYLE}
                    >
                        <PiArrowLeft className="text-[16px]" />
                    </Link>
                    <div>
                        <div className="flex items-center gap-2.5">
                            <h1 className="text-[20px] font-[600] text-gray-900 tracking-tight">{customer.name}</h1>
                            <span
                                className={`text-[10px] font-[500] px-2 py-0.5 rounded-[4px] ${customer.isActive ? 'text-emerald-600 bg-emerald-50' : 'text-gray-400 bg-gray-50'}`}
                                style={{ border: customer.isActive ? '1px solid rgba(16,185,129,0.2)' : '1px solid rgba(0,0,0,0.09)' }}>
                                {customer.isActive ? "Active" : "Inactive"}
                            </span>
                        </div>
                        <p className="text-[12px] text-gray-400 flex items-center gap-1.5 mt-0.5">
                            <PiBuildings className="text-[13px]" />
                            {customer.city || 'No City'}, {customer.country || 'South Sudan'}
                        </p>
                    </div>
                </div>

                <div className="flex gap-2">
                    <Link
                        href={`/dashboard/accounting/sales/new?customerId=${id}`}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-[6px] text-[12.5px] font-[500] text-gray-600 bg-white hover:bg-gray-50 transition-colors"
                        style={CARD_STYLE}>
                        <PiPlus className="text-[13px]" /> Create Invoice
                    </Link>
                    <Link
                        href={`/dashboard/accounting/customers/${id}/statement`}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-[6px] text-[12.5px] font-[600] text-white bg-[#6366F1] hover:bg-indigo-600 transition-colors">
                        <PiArrowRight className="text-[13px]" /> View Statement
                    </Link>
                </div>
            </div>

            {/* Main Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Column */}
                <div className="space-y-4">
                    {/* Financial Summary */}
                    <div className="bg-white rounded-[8px] p-5 space-y-4" style={CARD_STYLE}>
                        <h3 className="text-[10.5px] font-[600] text-gray-400 uppercase tracking-[0.07em] flex items-center gap-1.5">
                            <PiMoney className="text-[14px] text-[#6366F1]" />
                            Financial Overview
                        </h3>

                        <div className="space-y-3">
                            <div className="p-4 rounded-[8px]" style={{ background: '#FAFAFA', border: '1px solid rgba(0,0,0,0.06)' }}>
                                <span className="text-[10.5px] font-[500] text-gray-400 uppercase tracking-[0.06em]">Outstanding Balance</span>
                                <div className={`text-[22px] font-[600] font-mono mt-1 ${balance > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                                    {formatCurrency(balance, customer.currency)}
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="p-3 rounded-[8px]" style={{ background: '#FAFAFA', border: '1px solid rgba(0,0,0,0.06)' }}>
                                    <span className="text-[10px] font-[500] text-gray-400 uppercase tracking-[0.06em]">Total Billed</span>
                                    <div className="text-[15px] font-[600] text-gray-900 font-mono mt-1">
                                        {formatCurrency(totalInvoiced, customer.currency)}
                                    </div>
                                </div>
                                <div className="p-3 rounded-[8px]" style={{ background: '#FAFAFA', border: '1px solid rgba(0,0,0,0.06)' }}>
                                    <span className="text-[10px] font-[500] text-gray-400 uppercase tracking-[0.06em]">Total Paid</span>
                                    <div className="text-[15px] font-[600] text-emerald-600 font-mono mt-1">
                                        {formatCurrency(totalPaid, customer.currency)}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Contact Info */}
                    <div className="bg-white rounded-[8px] p-5" style={CARD_STYLE}>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-[10.5px] font-[600] text-gray-400 uppercase tracking-[0.07em] flex items-center gap-1.5">
                                <PiBuildings className="text-[14px] text-[#6366F1]" />
                                Contact Details
                            </h3>
                            <EditCustomerModal customer={customer} />
                        </div>

                        <div className="space-y-3">
                            <div className="flex items-start gap-2.5">
                                <PiMapPin className="text-[14px] text-gray-400 mt-0.5 shrink-0" />
                                <div>
                                    <span className="block text-[12.5px] text-gray-900 font-[500]">Address</span>
                                    <span className="text-[12px] text-gray-400">
                                        {customer.address || "No address provided"}
                                        {(customer.city || customer.country) && (
                                            <><br />{customer.city} {customer.country}</>
                                        )}
                                    </span>
                                </div>
                            </div>

                            <div className="flex items-start gap-2.5">
                                <PiPhone className="text-[14px] text-gray-400 mt-0.5 shrink-0" />
                                <div>
                                    <span className="block text-[12.5px] text-gray-900 font-[500]">Phone</span>
                                    <span className="text-[12px] text-gray-400">{customer.phone || "N/A"}</span>
                                </div>
                            </div>

                            <div className="flex items-start gap-2.5">
                                <PiEnvelope className="text-[14px] text-gray-400 mt-0.5 shrink-0" />
                                <div>
                                    <span className="block text-[12.5px] text-gray-900 font-[500]">Email</span>
                                    <span className="text-[12px] text-gray-400">{customer.email || "N/A"}</span>
                                </div>
                            </div>

                            <div className="flex items-start gap-2.5">
                                <PiGlobe className="text-[14px] text-gray-400 mt-0.5 shrink-0" />
                                <div>
                                    <span className="block text-[12.5px] text-gray-900 font-[500]">Contact Person</span>
                                    <span className="text-[12px] text-gray-400">{customer.contactPerson || "N/A"}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Column: Activities */}
                <div className="lg:col-span-2 space-y-4">
                    {/* Recent Invoices */}
                    <div className="bg-white rounded-[8px] overflow-hidden" style={CARD_STYLE}>
                        <div className="px-5 py-4 flex items-center justify-between"
                            style={{ borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
                            <h3 className="text-[13px] font-[600] text-gray-900 flex items-center gap-1.5">
                                <PiFileText className="text-[#6366F1]" />
                                Recent Invoices
                            </h3>
                            <Link href={`/dashboard/accounting/customers/${id}/statement`}
                                className="text-[11.5px] text-[#6366F1] hover:underline font-[500]">
                                View All
                            </Link>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead style={{ borderBottom: '1px solid rgba(0,0,0,0.07)', background: '#FAFAFA' }}>
                                    <tr>
                                        <th className="px-5 py-3 text-[10.5px] font-[500] text-gray-400 uppercase tracking-[0.06em]">Date</th>
                                        <th className="px-5 py-3 text-[10.5px] font-[500] text-gray-400 uppercase tracking-[0.06em]">Invoice #</th>
                                        <th className="px-5 py-3 text-[10.5px] font-[500] text-gray-400 uppercase tracking-[0.06em] text-right">Amount</th>
                                        <th className="px-5 py-3 text-[10.5px] font-[500] text-gray-400 uppercase tracking-[0.06em]">Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {customer.sales.length === 0 ? (
                                        <tr>
                                            <td colSpan={4} className="px-5 py-8 text-center text-[12.5px] text-gray-400 italic">
                                                No invoices yet
                                            </td>
                                        </tr>
                                    ) : (
                                        customer.sales.map((sale, idx) => {
                                            const sMeta = SALE_STATUS_META[sale.status] || SALE_STATUS_META['PENDING'];
                                            return (
                                                <tr key={sale.id} className="hover:bg-gray-50/60 transition-colors"
                                                    style={idx < customer.sales.length - 1 ? { borderBottom: '1px solid rgba(0,0,0,0.06)' } : {}}>
                                                    <td className="px-5 py-3.5 text-[12.5px] text-gray-500">
                                                        {new Date(sale.issueDate).toLocaleDateString()}
                                                    </td>
                                                    <td className="px-5 py-3.5 font-mono font-[500] text-[12px] text-gray-900">
                                                        {sale.invoiceNumber}
                                                    </td>
                                                    <td className="px-5 py-3.5 text-right font-mono font-[600] text-[13px] text-gray-900">
                                                        {formatCurrency(Number(sale.totalAmount), sale.currency)}
                                                    </td>
                                                    <td className="px-5 py-3.5">
                                                        <span className={`text-[10px] font-[500] px-2 py-0.5 rounded-[4px] uppercase ${sMeta.cls}`}
                                                            style={{ border: `1px solid ${sMeta.border}` }}>
                                                            {sale.status}
                                                        </span>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Recent Payments */}
                    <div className="bg-white rounded-[8px] overflow-hidden" style={CARD_STYLE}>
                        <div className="px-5 py-4 flex items-center justify-between"
                            style={{ borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
                            <h3 className="text-[13px] font-[600] text-gray-900 flex items-center gap-1.5">
                                <PiReceipt className="text-[#6366F1]" />
                                Recent Payments
                            </h3>
                            <Link href={`/dashboard/accounting/customers/${id}/statement`}
                                className="text-[11.5px] text-[#6366F1] hover:underline font-[500]">
                                View History
                            </Link>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead style={{ borderBottom: '1px solid rgba(0,0,0,0.07)', background: '#FAFAFA' }}>
                                    <tr>
                                        <th className="px-5 py-3 text-[10.5px] font-[500] text-gray-400 uppercase tracking-[0.06em]">Date</th>
                                        <th className="px-5 py-3 text-[10.5px] font-[500] text-gray-400 uppercase tracking-[0.06em]">Reference</th>
                                        <th className="px-5 py-3 text-[10.5px] font-[500] text-gray-400 uppercase tracking-[0.06em]">Method</th>
                                        <th className="px-5 py-3 text-[10.5px] font-[500] text-gray-400 uppercase tracking-[0.06em] text-right">Amount</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {customer.payments.length === 0 ? (
                                        <tr>
                                            <td colSpan={4} className="px-5 py-8 text-center text-[12.5px] text-gray-400 italic">
                                                No payments found
                                            </td>
                                        </tr>
                                    ) : (
                                        customer.payments.map((payment, idx) => (
                                            <tr key={payment.id} className="hover:bg-gray-50/60 transition-colors"
                                                style={idx < customer.payments.length - 1 ? { borderBottom: '1px solid rgba(0,0,0,0.06)' } : {}}>
                                                <td className="px-5 py-3.5 text-[12.5px] text-gray-500">
                                                    {new Date(payment.paymentDate).toLocaleDateString()}
                                                </td>
                                                <td className="px-5 py-3.5 text-gray-500 font-mono text-[11.5px]">
                                                    {payment.reference || '-'}
                                                </td>
                                                <td className="px-5 py-3.5 text-[12.5px] text-gray-500 capitalize">
                                                    {payment.method.replace('_', ' ').toLowerCase()}
                                                </td>
                                                <td className="px-5 py-3.5 text-right font-mono font-[600] text-[13px] text-emerald-600">
                                                    {formatCurrency(payment.amount, payment.currency)}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
