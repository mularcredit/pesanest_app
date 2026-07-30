import prisma from "@/lib/prisma";
import { auth } from "@/auth";
import { requirePermission } from "@/lib/access-control";
import { InvoicesClient } from "./InvoicesClient";

export const dynamic = 'force-dynamic';

export default async function InvoicesPage() {
    const session = await auth();
    requirePermission(session, ['INVOICES.VIEW', 'INVOICES.MANAGE', 'SALES.MANAGE']);

    const invoices = await prisma.invoice.findMany({
        include: {
            vendor: { select: { name: true } },
            createdBy: { select: { name: true } }
        },
        orderBy: { createdAt: 'desc' }
    });

    const serialized = invoices.map(inv => ({
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        invoiceDate: inv.invoiceDate.toISOString(),
        dueDate: inv.dueDate.toISOString(),
        amount: Number(inv.amount),
        status: inv.status,
        currency: inv.currency,
        fileUrl: inv.fileUrl,
        vendorName: inv.vendor.name,
        createdByName: inv.createdBy.name,
    }));

    return <InvoicesClient invoices={serialized} />;
}
