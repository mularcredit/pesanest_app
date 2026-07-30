
import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";
import { AccountingEngine } from "@/lib/accounting/accounting-engine";
import { EtimsService } from "@/lib/tax/etims";

export async function POST(req: Request) {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();

    if (!body.customerId || !body.items || body.items.length === 0) {
        return NextResponse.json({ error: "Customer and Line Items are required" }, { status: 400 });
    }

    try {
        // 1. Resolve tax rate if provided
        let taxRate = null;
        if (body.taxRateId) {
            taxRate = await (prisma as any).taxRate.findUnique({ where: { id: body.taxRateId } });
            if (!taxRate) return NextResponse.json({ error: "Tax rate not found" }, { status: 400 });
            if (!taxRate.isActive) return NextResponse.json({ error: "Tax rate is inactive" }, { status: 400 });
        }

        // 2. Calculate amounts
        const subtotal = body.items.reduce(
            (sum: number, item: any) => sum + (item.quantity * item.unitPrice),
            0
        );
        const taxAmount = taxRate ? Math.round(subtotal * (taxRate.rate / 100) * 100) / 100 : 0;
        const totalAmount = subtotal + taxAmount;

        // 3. Generate invoice number if missing
        let invoiceNumber = body.invoiceNumber;
        if (!invoiceNumber) {
            const seq = await (prisma as any).documentSequence.upsert({
                where: { prefix: 'INV' },
                update: { lastNumber: { increment: 1 } },
                create: { prefix: 'INV', lastNumber: 1 },
            });
            const year = new Date().getFullYear();
            invoiceNumber = `INV-${year}-${String(seq.lastNumber).padStart(4, '0')}`;
        }

        // 4. Create Sale record
        const sale = await prisma.sale.create({
            data: {
                customerId: body.customerId,
                invoiceNumber,
                issueDate: new Date(body.issueDate),
                dueDate: new Date(body.dueDate),
                subtotal,
                taxAmount,
                totalAmount,
                taxRateId: taxRate?.id || null,
                currency: body.currency || 'KES',
                status: body.status || 'DRAFT',
                notes: body.notes,
                etimsStatus: taxAmount > 0 ? 'PENDING' : 'NOT_REQUIRED',
                items: {
                    create: body.items.map((item: any) => ({
                        description: item.description,
                        quantity: item.quantity,
                        unitPrice: item.unitPrice,
                        total: item.quantity * item.unitPrice
                    }))
                }
            }
        });

        // 5. If status is SENT, post to GL and submit to eTIMS
        if (sale.status === 'SENT') {
            await AccountingEngine.postSaleInvoice(sale.id, session.user.id!);

            if (taxAmount > 0) {
                const etimsResult = await EtimsService.submitInvoice(sale.id);
                if (!etimsResult.success) {
                    // Log the failure but don't abort — the GL entry is already posted
                    console.error(`[eTIMS] Submission failed for ${sale.invoiceNumber}: ${etimsResult.error}`);
                }
            }
        }

        return NextResponse.json(sale);

    } catch (error: any) {
        console.error("Error creating sale:", error);
        if (error.code === 'P2002') {
            return NextResponse.json({ error: "Invoice Number already exists" }, { status: 409 });
        }
        return NextResponse.json({ error: error.message || "Failed to create sale" }, { status: 500 });
    }
}
