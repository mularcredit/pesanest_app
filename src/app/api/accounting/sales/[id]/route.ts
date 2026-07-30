
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { AccountingEngine } from "@/lib/accounting/accounting-engine";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const body = await req.json();
    const { customerId, invoiceNumber, issueDate, dueDate, status, notes, items } = body;

    if (!customerId || !items || items.length === 0) {
        return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const totalAmount = items.reduce((sum: number, item: any) => sum + (Number(item.quantity) * Number(item.unitPrice)), 0);

    try {
        const sale = await prisma.$transaction(async (tx) => {
            // 1. Update Sale
            const updatedSale = await tx.sale.update({
                where: { id },
                data: {
                    customerId,
                    invoiceNumber,
                    issueDate: new Date(issueDate),
                    dueDate: new Date(dueDate),
                    status,
                    notes,
                    totalAmount
                }
            });

            // 2. Replace Items
            await tx.saleItem.deleteMany({ where: { saleId: id } });

            await tx.saleItem.createMany({
                data: items.map((item: any) => ({
                    saleId: id,
                    description: item.description,
                    quantity: Number(item.quantity),
                    unitPrice: Number(item.unitPrice),
                    total: Number(item.quantity) * Number(item.unitPrice)
                }))
            });

            return updatedSale;
        });

        // 3. If Status is SENT, trigger ledger posting (Idempotent)
        if (sale.status === 'SENT') {
            await AccountingEngine.postSaleInvoice(sale.id);
        }

        return NextResponse.json(sale);
    } catch (error: any) {
        console.error("Error updating sale:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;

    try {
        const sale = await prisma.sale.findUnique({
            where: { id },
            include: { items: true, customer: true }
        });

        if (!sale) return NextResponse.json({ error: "Sale not found" }, { status: 404 });

        return NextResponse.json(sale);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;

    const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { role: true, customRole: { select: { isSystem: true } } }
    });

    const isAdmin = user?.role === 'SYSTEM_ADMIN' || user?.customRole?.isSystem;
    if (!isAdmin) {
        return NextResponse.json({ error: "Only System Admins can delete sales" }, { status: 403 });
    }

    try {
        await prisma.$transaction(async (tx) => {
            // 1. Clean up Journal Entries associated with this sale
            const existingEntries = await (tx as any).journalEntry.findMany({
                where: { saleId: id }
            });

            for (const entry of existingEntries) {
                await (tx as any).journalLine.deleteMany({ where: { entryId: entry.id } });
                await (tx as any).journalEntry.delete({ where: { id: entry.id } });
            }

            // 2. Delete Sale (Prisma will handle SaleItems if cascade is set, or we do it manually)
            // SaleItem in schema has onDelete: Cascade
            await tx.sale.delete({
                where: { id }
            });
        });

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error("Error deleting sale:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
