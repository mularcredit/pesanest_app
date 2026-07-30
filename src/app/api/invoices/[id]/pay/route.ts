import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/auth";
import { AccountingEngine } from "@/lib/accounting/accounting-engine";

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();
        const { amount, paymentDate, method, reference, notes } = body;

        // Fetch the invoice
        const invoice = await prisma.invoice.findUnique({
            where: { id }, // Use awaited id
            include: { vendor: true }
        });

        if (!invoice) {
            return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
        }

        // Check if amount exceeds invoice amount
        if (amount > invoice.amount) {
            return NextResponse.json(
                { error: "Payment amount exceeds invoice balance" },
                { status: 400 }
            );
        }

        // Create payment record
        const payment = await prisma.payment.create({
            data: {
                amount,
                method,
                reference: reference || `PAY-${Date.now()}`,
                notes,
                status: 'PAID',
                makerId: session.user.id,
                processedAt: new Date(paymentDate),
                invoices: {
                    connect: { id }
                }
            }
        });

        // Update invoice status
        const isFullyPaid = amount >= invoice.amount;
        await prisma.invoice.update({
            where: { id },
            data: {
                status: isFullyPaid ? 'PAID' : invoice.status,
                paymentStatus: isFullyPaid ? 'PAID' : 'PARTIAL',
                paidAt: isFullyPaid ? new Date(paymentDate) : null,
                paymentId: payment.id
            }
        });

        // ✨ NEW: Auto-post to General Ledger
        try {
            await AccountingEngine.postVendorPayment(id, amount);
            console.log(`✅ Posted vendor payment for Invoice ${invoice.invoiceNumber} to GL`);
        } catch (glError) {
            console.error(`❌ Failed to post vendor payment to GL:`, glError);
            // Don't fail the payment if GL posting fails - accountant can post manually
        }

        return NextResponse.json({
            success: true,
            payment
        });

    } catch (error) {
        console.error("Payment error:", error);
        return NextResponse.json(
            { error: "Failed to process payment" },
            { status: 500 }
        );
    }
}
