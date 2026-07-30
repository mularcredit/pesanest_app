import prisma from "@/lib/prisma";
import { auth } from "@/auth";
import Link from "next/link";
import { PiArrowLeft } from "react-icons/pi";
import { InvoiceForm } from "./InvoiceForm";
import { requirePermission } from "@/lib/access-control";

export default async function NewInvoicePage() {
    const session = await auth();
    requirePermission(session, ['INVOICES.CREATE', 'INVOICES.MANAGE', 'SALES.MANAGE']);

    const vendors = await prisma.vendor.findMany({
        where: { isActive: true },
        select: { id: true, name: true },
        orderBy: { name: 'asc' }
    });

    return (
        <div className="space-y-6 pb-24">
            <div className="flex items-center gap-3">
                <Link href="/dashboard/invoices"
                    className="p-1.5 rounded-[6px] text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors"
                    style={{ border: '1px solid rgba(0,0,0,0.09)' }}>
                    <PiArrowLeft className="text-[15px]" />
                </Link>
                <div>
                    <h1 className="text-[20px] font-[600] text-gray-900 tracking-tight">Record Invoice</h1>
                    <p className="text-[12.5px] text-gray-400 mt-0.5">Enter details from a vendor invoice</p>
                </div>
            </div>
            <InvoiceForm vendors={vendors} />
        </div>
    );
}
