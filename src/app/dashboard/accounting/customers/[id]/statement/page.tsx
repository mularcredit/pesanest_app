
import prisma from "@/lib/prisma";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
    PiArrowLeft,
    PiTable,
} from "react-icons/pi";
import { format } from "date-fns";
import { StatementFilterForm } from "@/components/accounting/StatementFilterForm";
import { RecordPaymentButton } from "@/components/accounting/RecordPaymentButton";
import { CreateCreditNoteButton } from "@/components/accounting/CreateCreditNoteButton";
import { ClickableReferenceCell } from "./ClickableReferenceCell";

const CARD_STYLE: React.CSSProperties = { border: '1px solid rgba(0,0,0,0.09)' };

const formatCurrency = (amount: number, currency = 'KES') => {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency,
    }).format(amount);
};

export default async function CustomerStatementPage({
    params,
    searchParams
}: {
    params: Promise<{ id: string }>,
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
    const session = await auth();
    if (!session?.user) return redirect("/login");

    const { id } = await params;
    const query = await searchParams;

    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);

    const startDateStr = (query?.from as string) || firstDay.toISOString().split('T')[0];
    const endDateStr = (query?.to as string) || now.toISOString().split('T')[0];

    const startDate = new Date(startDateStr);
    const endDate = new Date(endDateStr);
    const endDateInclusive = new Date(endDate);
    endDateInclusive.setHours(23, 59, 59, 999);

    const prevSales = await prisma.sale.aggregate({
        where: { customerId: id, issueDate: { lt: startDate } },
        _sum: { totalAmount: true }
    });

    const prevPayments = await prisma.customerPayment.aggregate({
        where: { customerId: id, paymentDate: { lt: startDate } },
        _sum: { amount: true }
    });

    const prevCreditNotes = await prisma.creditNote.aggregate({
        where: { customerId: id, createdAt: { lt: startDate }, status: { not: 'VOIDED' } },
        _sum: { amount: true }
    });

    const openingBalance = Number(prevSales._sum.totalAmount || 0) - Number(prevPayments._sum.amount || 0) - Number(prevCreditNotes._sum.amount || 0);

    const customer = await prisma.customer.findUnique({
        where: { id },
        include: {
            sales: {
                where: { issueDate: { gte: startDate, lte: endDateInclusive } },
                orderBy: { issueDate: 'asc' },
                select: {
                    id: true, invoiceNumber: true, issueDate: true,
                    totalAmount: true, status: true, invoiceUrl: true, items: true
                }
            },
            payments: {
                where: { paymentDate: { gte: startDate, lte: endDateInclusive } },
                orderBy: { paymentDate: 'asc' },
                select: {
                    id: true, amount: true, currency: true,
                    paymentDate: true, method: true,
                    reference: true, saleId: true, invoiceUrl: true
                }
            },
            creditNotes: {
                where: {
                    createdAt: { gte: startDate, lte: endDateInclusive },
                    status: { not: 'VOIDED' }
                },
                orderBy: { createdAt: 'asc' },
                select: {
                    id: true, cnNumber: true, createdAt: true,
                    amount: true, reason: true, status: true, invoiceUrl: true
                }
            }
        }
    });

    if (!customer) return redirect("/dashboard/accounting/customers");

    const unpaidSalesRaw = await prisma.sale.findMany({
        where: { customerId: id, status: { not: 'PAID' } },
        orderBy: { issueDate: 'desc' },
        select: { id: true, invoiceNumber: true, totalAmount: true, issueDate: true, status: true }
    });
    const unpaidSales = unpaidSalesRaw.map(s => ({ ...s, totalAmount: Number(s.totalAmount) }));

    const periodInvoiced = customer.sales.reduce((sum: number, sale: any) => sum + Number(sale.totalAmount), 0);
    const periodPaid = customer.payments.reduce((sum: number, payment: any) => sum + payment.amount, 0);
    const periodCreditNotes = customer.creditNotes.reduce((sum: number, cn: any) => sum + cn.amount, 0);
    const endingBalance = openingBalance + periodInvoiced - periodPaid - periodCreditNotes;

    const transactions = [
        ...customer.sales.map((s: any) => ({
            id: s.id, date: s.issueDate, type: 'INVOICE',
            reference: s.invoiceNumber, description: 'Sales Invoice',
            debit: s.totalAmount, credit: 0, invoiceUrl: s.invoiceUrl || null
        })),
        ...customer.payments.map((p: any) => ({
            id: p.id, date: p.paymentDate, type: 'PAYMENT',
            reference: p.reference || 'PAYMENT',
            description: `Payment via ${p.method.replace('_', ' ')}`,
            debit: 0, credit: p.amount,
            saleId: p.saleId || null, invoiceUrl: p.invoiceUrl || null
        })),
        ...customer.creditNotes.map((cn: any) => ({
            id: cn.id, date: cn.createdAt, type: 'CREDIT_NOTE',
            reference: cn.cnNumber,
            description: `Credit Note - ${cn.reason}`,
            debit: 0, credit: cn.amount, invoiceUrl: cn.invoiceUrl || null
        }))
    ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    let runningBalance = openingBalance;
    const statementRows = transactions.map(t => {
        runningBalance += t.debit - t.credit;
        return { ...t, balance: runningBalance };
    });

    return (
        <div className="space-y-6 pb-20 w-full">
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-6 pb-5"
                style={{ borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
                <div className="flex items-center gap-4">
                    <Link
                        href="/dashboard/accounting/customers"
                        className="p-2 rounded-[6px] bg-white hover:bg-gray-50 text-gray-400 hover:text-gray-700 transition-colors"
                        style={CARD_STYLE}
                    >
                        <PiArrowLeft className="text-[16px]" />
                    </Link>
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <span className="px-2 py-0.5 text-[10px] font-[500] rounded-[4px] text-[#6366F1] bg-indigo-50"
                                style={{ border: '1px solid rgba(99,102,241,0.2)' }}>
                                Transaction history
                            </span>
                        </div>
                        <h1 className="text-[22px] font-[600] text-gray-900 tracking-tight">{customer.name}</h1>
                        <p className="text-[11.5px] text-gray-400 font-[500] mt-0.5">
                            {startDate.toLocaleDateString()} – {endDate.toLocaleDateString()}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <CreateCreditNoteButton
                        customerId={id}
                        customerName={customer.name}
                        currency={customer.currency}
                        sales={unpaidSales}
                    />
                    <RecordPaymentButton
                        customerId={id}
                        customerName={customer.name}
                        currency={customer.currency}
                        unpaidSales={unpaidSales}
                    />
                </div>
            </div>

            {/* Filter */}
            <div>
                <StatementFilterForm />
            </div>

            <div className="space-y-5">
                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="bg-white rounded-[8px] p-5" style={CARD_STYLE}>
                        <p className="text-[10px] font-[500] text-gray-400 uppercase tracking-[0.06em] mb-2">Opening balance</p>
                        <p className="text-[18px] font-[600] text-gray-900 font-mono">{formatCurrency(openingBalance, customer.currency)}</p>
                    </div>
                    <div className="bg-white rounded-[8px] p-5" style={CARD_STYLE}>
                        <p className="text-[10px] font-[500] text-gray-400 uppercase tracking-[0.06em] mb-2">Total invoiced</p>
                        <p className="text-[18px] font-[600] text-gray-900 font-mono">{formatCurrency(periodInvoiced, customer.currency)}</p>
                    </div>
                    <div className="bg-white rounded-[8px] p-5" style={CARD_STYLE}>
                        <p className="text-[10px] font-[500] text-emerald-500 uppercase tracking-[0.06em] mb-2">Total received</p>
                        <p className="text-[18px] font-[600] text-emerald-600 font-mono">{formatCurrency(periodPaid, customer.currency)}</p>
                    </div>
                    <div className="rounded-[8px] p-5 text-white" style={{ background: '#5e48b8' }}>
                        <p className="text-[10px] font-[500] opacity-80 uppercase tracking-[0.06em] mb-2">Ending balance</p>
                        <p className="text-[18px] font-[600] font-mono">{formatCurrency(endingBalance, customer.currency)}</p>
                    </div>
                </div>

                {/* Transactions Table */}
                <div className="bg-white rounded-[8px] overflow-hidden" style={CARD_STYLE}>
                    <div className="px-5 py-4 flex items-center justify-between"
                        style={{ borderBottom: '1px solid rgba(0,0,0,0.07)', background: '#FAFAFA' }}>
                        <h3 className="text-[13px] font-[600] text-gray-900 flex items-center gap-1.5">
                            <PiTable className="text-[#6366F1]" />
                            Transactions
                        </h3>
                        <span className="text-[11.5px] text-gray-400 font-[500]">{statementRows.length} activities</span>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead style={{ borderBottom: '1px solid rgba(0,0,0,0.07)', background: '#FAFAFA' }}>
                                <tr>
                                    <th className="py-3 px-5 text-left font-[500] text-gray-400 text-[10.5px] uppercase tracking-[0.06em]">Date</th>
                                    <th className="py-3 px-5 text-left font-[500] text-gray-400 text-[10.5px] uppercase tracking-[0.06em]">Reference</th>
                                    <th className="py-3 px-5 text-left font-[500] text-gray-400 text-[10.5px] uppercase tracking-[0.06em]">Description</th>
                                    <th className="py-3 px-5 text-right font-[500] text-gray-400 text-[10.5px] uppercase tracking-[0.06em]">Debit</th>
                                    <th className="py-3 px-5 text-right font-[500] text-gray-400 text-[10.5px] uppercase tracking-[0.06em]">Credit</th>
                                    <th className="py-3 px-5 text-right font-[500] text-gray-400 text-[10.5px] uppercase tracking-[0.06em]">Running balance</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr style={statementRows.length > 0 ? { borderBottom: '1px solid rgba(0,0,0,0.06)' } : {}}>
                                    <td className="py-3.5 px-5" colSpan={3}>
                                        <span className="text-[12px] font-[500] text-gray-400 italic">Opening balance</span>
                                    </td>
                                    <td className="py-3.5 px-5 text-right font-mono text-[12.5px] text-gray-400" colSpan={3}>
                                        {formatCurrency(openingBalance, customer.currency)}
                                    </td>
                                </tr>
                                {statementRows.map((row, idx) => (
                                    <tr
                                        key={`${row.type}-${row.id}`}
                                        className="hover:bg-indigo-50/30 transition-colors"
                                        style={idx < statementRows.length - 1 ? { borderBottom: '1px solid rgba(0,0,0,0.06)' } : {}}
                                    >
                                        <td className="py-3.5 px-5 text-[12.5px] text-gray-500 whitespace-nowrap">
                                            {format(new Date(row.date), "dd MMM yyyy")}
                                        </td>
                                        <td className="py-3.5 px-5">
                                            <ClickableReferenceCell
                                                type={row.type as 'INVOICE' | 'PAYMENT' | 'CREDIT_NOTE'}
                                                id={row.id}
                                                reference={row.reference}
                                                saleId={(row as any).saleId}
                                                invoiceUrl={(row as any).invoiceUrl}
                                                date={row.date}
                                                description={row.description}
                                                amount={row.debit > 0 ? row.debit : row.credit}
                                                currency={customer.currency}
                                            />
                                        </td>
                                        <td className="py-3.5 px-5 text-[12.5px] text-gray-600 font-[500]">
                                            {row.description}
                                        </td>
                                        <td className="py-3.5 px-5 text-right font-mono font-[600] text-[13px] text-gray-900">
                                            {row.debit > 0 ? formatCurrency(row.debit, customer.currency) : "—"}
                                        </td>
                                        <td className="py-3.5 px-5 text-right font-mono font-[600] text-[13px] text-emerald-600">
                                            {row.credit > 0 ? formatCurrency(row.credit, customer.currency) : "—"}
                                        </td>
                                        <td className="py-3.5 px-5 text-right font-mono font-[600] text-[13px] text-gray-900">
                                            {formatCurrency(row.balance, customer.currency)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}
