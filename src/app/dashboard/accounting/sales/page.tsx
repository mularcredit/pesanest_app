import prisma from "@/lib/prisma";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
    PiTrendUp, PiClock, PiPlus, PiCheckCircle,
    PiArrowRight, PiDownloadSimple, PiInvoice,
} from "react-icons/pi";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { SalesFilter } from "@/components/dashboard/SalesFilter";
import { EtimsStatusCell } from "@/components/accounting/EtimsStatusCell";

const CARD_STYLE: React.CSSProperties = { border: '1px solid rgba(0,0,0,0.09)' };

const STATUS_META: Record<string, { cls: string; border: string }> = {
    PAID:     { cls: 'text-emerald-600 bg-emerald-50', border: 'rgba(16,185,129,0.2)' },
    DRAFT:    { cls: 'text-gray-500 bg-gray-50',       border: 'rgba(0,0,0,0.09)' },
    OVERDUE:  { cls: 'text-rose-600 bg-rose-50',       border: 'rgba(239,68,68,0.2)' },
    PENDING:  { cls: 'text-amber-600 bg-amber-50',     border: 'rgba(245,158,11,0.2)' },
    CANCELLED:{ cls: 'text-gray-400 bg-gray-50',       border: 'rgba(0,0,0,0.07)' },
};

export default async function SalesPage({
    searchParams
}: {
    searchParams: Promise<{ query?: string; status?: string; customerId?: string; dateRange?: string }>
}) {
    const session = await auth();
    if (!session?.user) return redirect("/login");

    const params = await searchParams;
    const query = params.query || "";
    const status = (params.status || "ALL").toUpperCase();
    const customerId = params.customerId || "ALL";
    const dateRange = params.dateRange || "ALL";

    const where: any = {};

    if (status !== 'ALL') where.status = status;
    if (customerId !== 'ALL') where.customerId = customerId;

    if (dateRange !== 'ALL') {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
        const startOfYear = new Date(now.getFullYear(), 0, 1);
        const startOfLast3Months = new Date(now.getFullYear(), now.getMonth() - 2, 1);

        switch (dateRange) {
            case 'THIS_MONTH':    where.issueDate = { gte: startOfMonth }; break;
            case 'LAST_MONTH':    where.issueDate = { gte: startOfLastMonth, lte: endOfLastMonth }; break;
            case 'LAST_3_MONTHS': where.issueDate = { gte: startOfLast3Months }; break;
            case 'THIS_YEAR':     where.issueDate = { gte: startOfYear }; break;
        }
    }

    if (query) {
        where.OR = [
            { invoiceNumber: { contains: query, mode: 'insensitive' } },
            ...(customerId === 'ALL' ? [{ customer: { name: { contains: query, mode: 'insensitive' } } }] : [])
        ];
    }

    const [sales, customers] = await Promise.all([
        prisma.sale.findMany({
            where,
            orderBy: { issueDate: 'desc' },
            include: { customer: true }
        }),
        prisma.customer.findMany({
            where: { isActive: true },
            select: { id: true, name: true },
            orderBy: { name: 'asc' }
        })
    ]);

    const totalRevenue = sales
        .filter((s: any) => s.status !== 'DRAFT' && s.status !== 'CANCELLED')
        .reduce((acc: number, s: any) => acc + s.totalAmount, 0);

    const outstandingAmount = sales
        .filter((s: any) => s.status !== 'PAID' && s.status !== 'DRAFT' && s.status !== 'CANCELLED')
        .reduce((acc: number, s: any) => acc + s.totalAmount, 0);

    const paidCount = sales.filter((s: any) => s.status === 'PAID').length;
    const paymentRate = sales.length > 0 ? (paidCount / sales.length) * 100 : 0;

    return (
        <div className="space-y-6 pb-24">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-[20px] font-[600] text-gray-900 tracking-tight">Sales & Income</h1>
                    <p className="text-[12.5px] text-gray-400 mt-0.5">
                        Manage invoices, track revenue, and monitor collection
                    </p>
                </div>
                <div className="flex gap-2">
                    <button className="flex items-center gap-1.5 px-4 py-2 rounded-[6px] text-[12.5px] font-[500] text-gray-600 bg-white hover:bg-gray-50 transition-colors"
                        style={CARD_STYLE}>
                        <PiDownloadSimple className="text-[14px]" /> Export
                    </button>
                    <Link href="/dashboard/accounting/sales/new"
                        className="flex items-center gap-1.5 px-4 py-2 rounded-[6px] text-[12.5px] font-[500] text-white bg-[#6366F1] hover:bg-indigo-600 transition-colors">
                        <PiPlus className="text-[14px]" /> Record Sale
                    </Link>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <StatsCard
                    title="Total Revenue"
                    value={`KES ${totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
                    trend="All time"
                    trendUp={true}
                    icon={PiTrendUp}
                    color="emerald"
                    lastMonthLabel="Aggregated sales volume"
                />
                <StatsCard
                    title="Outstanding"
                    value={`KES ${outstandingAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
                    trend={outstandingAmount === 0 ? "Cleared" : "Unpaid"}
                    trendUp={outstandingAmount === 0}
                    icon={PiClock}
                    color="amber"
                    lastMonthLabel="Pending collection"
                />
                <StatsCard
                    title="Payment Rate"
                    value={`${paymentRate.toFixed(1)}%`}
                    trend={paymentRate >= 80 ? "Healthy" : "Needs attention"}
                    trendUp={paymentRate >= 80}
                    icon={PiCheckCircle}
                    color="blue"
                    lastMonthLabel="Invoices captured as paid"
                />
            </div>

            <SalesFilter customers={customers} />

            {/* Sales Table */}
            <div className="bg-white rounded-[8px] overflow-hidden" style={CARD_STYLE}>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead style={{ borderBottom: '1px solid rgba(0,0,0,0.07)', background: '#FAFAFA' }}>
                            <tr>
                                {['Status', 'Invoice #', 'Date', 'Customer', 'Amount', 'eTIMS', ''].map((h, i) => (
                                    <th key={i}
                                        className={`px-5 py-3 text-[10.5px] font-[500] text-gray-400 uppercase tracking-[0.06em] ${i === 4 ? 'text-right' : i === 6 ? 'text-right' : 'text-left'}`}>
                                        {h}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {sales.map((sale: any, idx: number) => {
                                const meta = STATUS_META[sale.status] || STATUS_META['PENDING'];
                                return (
                                    <tr key={sale.id}
                                        className="hover:bg-gray-50/60 transition-colors group cursor-pointer"
                                        style={idx < sales.length - 1 ? { borderBottom: '1px solid rgba(0,0,0,0.06)' } : {}}>
                                        <td className="px-5 py-3.5">
                                            <span className={cn('text-[10px] font-[500] px-2 py-0.5 rounded-[4px] uppercase tracking-wider', meta.cls)}
                                                style={{ border: `1px solid ${meta.border}` }}>
                                                {sale.status}
                                            </span>
                                        </td>
                                        <td className="px-5 py-3.5 font-mono text-[12px] font-[600] text-gray-400 group-hover:text-[#6366F1] transition-colors">
                                            <Link href={`/dashboard/accounting/sales/${sale.id}`} className="hover:underline">
                                                {sale.invoiceNumber}
                                            </Link>
                                        </td>
                                        <td className="px-5 py-3.5 text-[12.5px] text-gray-500">
                                            {format(new Date(sale.issueDate), "dd MMM yyyy")}
                                        </td>
                                        <td className="px-5 py-3.5 text-[13px] font-[500] text-gray-900">
                                            {sale.customer.name}
                                        </td>
                                        <td className="px-5 py-3.5 text-right font-mono text-[13px] font-[600] text-gray-900 tabular-nums">
                                            KES {sale.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                        </td>
                                        <td className="px-5 py-3.5">
                                            <EtimsStatusCell
                                                saleId={sale.id}
                                                etimsStatus={sale.etimsStatus || 'PENDING'}
                                                etimsInvoiceNumber={sale.etimsInvoiceNumber}
                                                taxAmount={Number(sale.taxAmount)}
                                            />
                                        </td>
                                        <td className="px-5 py-3.5 text-right">
                                            <Link href={`/dashboard/accounting/sales/${sale.id}`} className="inline-block p-1.5 -m-1.5">
                                                <PiArrowRight className="text-gray-300 group-hover:text-[#6366F1] text-[16px] transition-colors" />
                                            </Link>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                    {sales.length === 0 && (
                        <div className="py-16 flex flex-col items-center">
                            <div className="w-9 h-9 rounded-[8px] bg-gray-50 flex items-center justify-center mb-3"
                                style={{ border: '1px solid rgba(0,0,0,0.07)' }}>
                                <PiInvoice className="text-gray-300 text-[16px]" />
                            </div>
                            <p className="text-[13px] font-[500] text-gray-500">No sales records found</p>
                            <p className="text-[12px] text-gray-400 mt-0.5">Try adjusting your filters</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
