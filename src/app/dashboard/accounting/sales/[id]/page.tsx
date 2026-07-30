import prisma from "@/lib/prisma";
import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import { SalesForm } from "@/components/accounting/SalesForm";
import Link from "next/link";
import { PiCaretLeft } from "react-icons/pi";

export default async function EditSalePage({ params }: { params: Promise<{ id: string }> }) {
    const session = await auth();
    if (!session?.user) return redirect("/login");

    const { id } = await params;

    const [sale, customers] = await Promise.all([
        prisma.sale.findUnique({
            where: { id },
            include: { items: true }
        }),
        prisma.customer.findMany({
            where: { isActive: true },
            orderBy: { name: 'asc' },
            select: { id: true, name: true, currency: true }
        })
    ]);

    if (!sale) return notFound();

    return (
        <div className="space-y-6 pb-24">
            <div>
                <Link href="/dashboard/accounting/sales"
                    className="inline-flex items-center gap-1 text-[11.5px] text-gray-400 hover:text-gray-700 transition-colors mb-3">
                    <PiCaretLeft className="text-[12px]" /> Back to sales
                </Link>
                <div className="flex items-center gap-2.5">
                    <h1 className="text-[20px] font-[600] text-gray-900 tracking-tight">Edit Invoice</h1>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-[4px] text-gray-500 bg-gray-100 tracking-wider"
                        style={{ border: '1px solid rgba(0,0,0,0.09)' }}>
                        {sale.invoiceNumber}
                    </span>
                </div>
                <p className="text-[12.5px] text-gray-400 mt-0.5">Update details for this invoice</p>
            </div>

            <SalesForm customers={customers} initialData={sale} />
        </div>
    );
}
