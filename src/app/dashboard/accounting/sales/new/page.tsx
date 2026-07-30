import prisma from "@/lib/prisma";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { SalesForm } from "@/components/accounting/SalesForm";
import Link from "next/link";
import { PiCaretLeft } from "react-icons/pi";

export default async function NewSalePage() {
    const session = await auth();
    if (!session?.user) return redirect("/login");

    const customers = await prisma.customer.findMany({
        where: { isActive: true },
        orderBy: { name: 'asc' },
        select: { id: true, name: true, currency: true }
    });

    return (
        <div className="space-y-6 pb-24">
            <div>
                <Link href="/dashboard/accounting/sales"
                    className="inline-flex items-center gap-1 text-[11.5px] text-gray-400 hover:text-gray-700 transition-colors mb-3">
                    <PiCaretLeft className="text-[12px]" /> Back to sales
                </Link>
                <h1 className="text-[20px] font-[600] text-gray-900 tracking-tight">Record New Sale</h1>
                <p className="text-[12.5px] text-gray-400 mt-0.5">Create a new invoice for a customer</p>
            </div>

            <SalesForm customers={customers} />
        </div>
    );
}
