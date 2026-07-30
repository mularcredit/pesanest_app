import prisma from "@/lib/prisma";
import { auth } from "@/auth";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
    PiPlus,
    PiUsersThree,
    PiTrash,
    PiArrowRight,
} from "react-icons/pi";
import { cn } from "@/lib/utils";
import { DeleteEntityButton } from "@/components/dashboard/DeleteEntityButton";
import { TrashButton } from "./TrashButton";

const CARD_STYLE: React.CSSProperties = { border: '1px solid rgba(0,0,0,0.09)' };

interface PageProps {
    searchParams: Promise<{ view?: string }>
}

export default async function CustomersPage({ searchParams }: PageProps) {
    const { view } = await searchParams;
    const isTrashView = view === 'trash';

    const session = await auth();
    if (!session?.user) return redirect("/login");

    await prisma.customer.updateMany({
        where: {
            name: { in: ["Saudi Arabian Airlines", "Flyadeal", "FLY Deal"] },
            isTrashed: false
        },
        data: { isTrashed: true }
    });

    const customers = await prisma.customer.findMany({
        where: { isTrashed: isTrashView },
        orderBy: { name: 'asc' },
        include: {
            sales: { select: { totalAmount: true } },
            payments: { select: { amount: true } }
        }
    });

    const activeCount = await prisma.customer.count({ where: { isTrashed: false } });
    const trashedCount = await prisma.customer.count({ where: { isTrashed: true } });

    const formatCurrency = (amount: number) =>
        new Intl.NumberFormat('en-US', { style: 'currency', currency: 'KES' }).format(amount);

    return (
        <div className="flex -mt-[22px] -mx-[26px] -mb-[52px] min-h-[calc(100vh-64px)]">

            {/* Left Sidebar */}
            <aside className="w-[220px] shrink-0 bg-white flex flex-col sticky top-0 h-[calc(100vh-64px)] overflow-y-auto"
                style={{ borderRight: '1px solid rgba(0,0,0,0.07)' }}>
                <div className="px-5 pt-6 pb-4" style={{ borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
                    <p className="text-[10px] font-[500] uppercase tracking-widest text-gray-400">Accounting</p>
                    <h1 className="text-[13px] font-[600] text-gray-900 mt-0.5">Customers</h1>
                    <p className="text-[10px] text-gray-400 mt-1">{activeCount} active</p>
                </div>
                <nav className="flex-1 p-2 space-y-0.5">
                    <Link
                        href="/dashboard/accounting/customers"
                        className={cn(
                            "w-full flex items-center gap-2.5 px-3 py-2.5 rounded-[7px] text-[12.5px] font-[500] transition-colors",
                            !isTrashView
                                ? "bg-indigo-50 text-[#6366F1]"
                                : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"
                        )}
                    >
                        <PiUsersThree className="shrink-0 text-[14px]" />
                        <span className="flex-1 truncate">Active Customers</span>
                        {activeCount > 0 && (
                            <span
                                className={cn(
                                    "text-[10px] font-[500] px-1.5 py-0.5 rounded-[4px] min-w-[20px] text-center",
                                    !isTrashView ? "bg-[#6366F1]/10 text-[#6366F1]" : "bg-gray-100 text-gray-500"
                                )}
                                style={!isTrashView
                                    ? { border: '1px solid rgba(99,102,241,0.2)' }
                                    : { border: '1px solid rgba(0,0,0,0.07)' }}>
                                {activeCount}
                            </span>
                        )}
                    </Link>
                    <Link
                        href="/dashboard/accounting/customers?view=trash"
                        className={cn(
                            "w-full flex items-center gap-2.5 px-3 py-2.5 rounded-[7px] text-[12.5px] font-[500] transition-colors",
                            isTrashView
                                ? "bg-indigo-50 text-[#6366F1]"
                                : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"
                        )}
                    >
                        <PiTrash className="shrink-0 text-[14px]" />
                        <span className="flex-1 truncate">Trash Bin</span>
                        {trashedCount > 0 && (
                            <span
                                className={cn(
                                    "text-[10px] font-[500] px-1.5 py-0.5 rounded-[4px] min-w-[20px] text-center",
                                    isTrashView ? "bg-[#6366F1]/10 text-[#6366F1]" : "bg-gray-100 text-gray-500"
                                )}
                                style={isTrashView
                                    ? { border: '1px solid rgba(99,102,241,0.2)' }
                                    : { border: '1px solid rgba(0,0,0,0.07)' }}>
                                {trashedCount}
                            </span>
                        )}
                    </Link>
                </nav>
                <div className="p-3" style={{ borderTop: '1px solid rgba(0,0,0,0.07)' }}>
                    <Link href="/dashboard/accounting/customers/new" className="block">
                        <button className="w-full text-[12px] font-[600] px-4 py-2 rounded-[6px] bg-[#6366F1] hover:bg-indigo-600 text-white transition-colors flex items-center justify-center gap-1.5">
                            <PiPlus className="text-[13px]" />
                            New Customer
                        </button>
                    </Link>
                </div>
            </aside>

            {/* Main Content */}
            <div className="flex-1 min-w-0 p-6 pb-12">
                {customers.length === 0 ? (
                    <div className="bg-white rounded-[8px] p-16 text-center space-y-4" style={CARD_STYLE}>
                        <div className="w-14 h-14 rounded-[7px] bg-indigo-50 mx-auto flex items-center justify-center">
                            {isTrashView
                                ? <PiTrash className="text-2xl text-rose-400" />
                                : <PiUsersThree className="text-2xl text-[#6366F1]" />
                            }
                        </div>
                        <div>
                            <h3 className="text-[15px] font-[600] text-gray-900">
                                {isTrashView ? "Trash bin is empty" : "No customers yet"}
                            </h3>
                            <p className="text-[12.5px] text-gray-400 mt-1">
                                {isTrashView ? "Items moved to trash will appear here." : "Add your first customer to start tracking sales."}
                            </p>
                        </div>
                    </div>
                ) : (
                    <div className="bg-white rounded-[8px] overflow-hidden" style={CARD_STYLE}>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead style={{ borderBottom: '1px solid rgba(0,0,0,0.07)', background: '#FAFAFA' }}>
                                    <tr>
                                        <th className="px-6 py-3 text-[10.5px] font-[500] text-gray-400 uppercase tracking-[0.06em]">Customer</th>
                                        <th className="px-6 py-3 text-[10.5px] font-[500] text-gray-400 uppercase tracking-[0.06em] text-right">Invoiced</th>
                                        <th className="px-6 py-3 text-[10.5px] font-[500] text-gray-400 uppercase tracking-[0.06em] text-right">Balance</th>
                                        <th className="px-6 py-3 text-[10.5px] font-[500] text-gray-400 uppercase tracking-[0.06em] text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {customers.map((customer, idx) => {
                                        const totalInvoiced = customer.sales.reduce((sum, s) => sum + Number(s.totalAmount), 0);
                                        const totalPaid = customer.payments.reduce((sum, p) => sum + p.amount, 0);
                                        const balance = totalInvoiced - totalPaid;

                                        return (
                                            <tr key={customer.id} className="hover:bg-gray-50/60 transition-colors"
                                                style={idx < customers.length - 1 ? { borderBottom: '1px solid rgba(0,0,0,0.06)' } : {}}>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-9 h-9 rounded-[7px] bg-indigo-50 text-[#6366F1] flex items-center justify-center font-[700] text-[12px]">
                                                            {customer.name.substring(0, 2).toUpperCase()}
                                                        </div>
                                                        <div>
                                                            <Link href={`/dashboard/accounting/customers/${customer.id}`}
                                                                className="font-[600] text-gray-900 text-[13px] hover:text-[#6366F1]">
                                                                {customer.name}
                                                            </Link>
                                                            <div className="text-[11.5px] text-gray-400">
                                                                {customer.city || 'Juba'}, {customer.country || 'South Sudan'}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-right text-[13px] text-gray-600 font-[500] font-mono">
                                                    {formatCurrency(totalInvoiced)}
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <span className={cn(
                                                        "text-[13px] font-[600] font-mono",
                                                        balance > 0 ? "text-rose-600" : "text-emerald-600"
                                                    )}>
                                                        {formatCurrency(balance)}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <div className="flex justify-end items-center gap-2">
                                                        {!isTrashView ? (
                                                            <>
                                                                <Link
                                                                    href={`/dashboard/accounting/customers/${customer.id}/statement`}
                                                                    className="text-[#6366F1] hover:text-indigo-800 text-[12px] font-[600] flex items-center gap-1 mr-2"
                                                                >
                                                                    View Statement <PiArrowRight />
                                                                </Link>
                                                                <TrashButton id={customer.id} entityType="customer" />
                                                            </>
                                                        ) : (
                                                            <div className="flex items-center gap-2">
                                                                <TrashButton id={customer.id} entityType="customer" isRestore />
                                                                <DeleteEntityButton
                                                                    id={customer.id}
                                                                    entityType="customer"
                                                                    entityName={customer.name}
                                                                />
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                        <div className="px-6 py-3 flex items-center justify-between text-[11px] font-[500] text-gray-400 uppercase tracking-[0.06em]"
                            style={{ borderTop: '1px solid rgba(0,0,0,0.06)', background: '#FAFAFA' }}>
                            <span>{customers.length} {isTrashView ? 'Trashed' : 'Active'} Customers</span>
                            {isTrashView && customers.length > 0 && (
                                <span className="text-rose-400 normal-case font-[400] text-[11px]">
                                    Items in trash can be restored or permanently deleted
                                </span>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
