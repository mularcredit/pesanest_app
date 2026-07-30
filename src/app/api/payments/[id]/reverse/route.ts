/**
 * POST /api/payments/[id]/reverse
 *
 * Reverses a disbursed payment batch. Requires SYSTEM_ADMIN.
 * Only PAID, PARTIALLY_PAID, or CLOSED payments can be reversed.
 *
 * Steps:
 *  1. Find all JournalEntry rows where paymentId = id (or linked via
 *     expenses/invoices/requisitions linked to this payment).
 *  2. Call AccountingEngine.createReversal on each non-reversal entry.
 *  3. Reopen linked expenses → APPROVED, invoices → APPROVED, requisitions → APPROVED.
 *  4. Set payment.status = REVERSED.
 *  5. Audit log.
 *
 * Body: { reason: string }
 */

import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { AccountingEngine } from "@/lib/accounting/accounting-engine";
import { NextResponse } from "next/server";

export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
    const params = await props.params;
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { role: true, customRole: { select: { isSystem: true } } }
    });
    if (user?.role !== 'SYSTEM_ADMIN' && !user?.customRole?.isSystem) {
        return NextResponse.json({ error: "Only System Admins can reverse payments" }, { status: 403 });
    }

    const { reason } = await req.json();
    if (!reason?.trim()) {
        return NextResponse.json({ error: "A reason is required for payment reversal" }, { status: 400 });
    }

    const payment = await (prisma as any).payment.findUnique({
        where: { id: params.id },
        include: {
            expenses: { select: { id: true } },
            invoices: { select: { id: true } },
            requisitions: { select: { id: true } },
            monthlyBudgets: { select: { id: true } }
        }
    });

    if (!payment) return NextResponse.json({ error: "Payment not found" }, { status: 404 });

    const reversibleStatuses = ['PAID', 'PARTIALLY_PAID', 'CLOSED'];
    if (!reversibleStatuses.includes(payment.status)) {
        return NextResponse.json({
            error: `Cannot reverse a payment with status "${payment.status}". Only PAID, PARTIALLY_PAID, or CLOSED payments can be reversed.`
        }, { status: 400 });
    }

    // Collect all journal entries linked to this payment directly or via linked items
    const expenseIds = payment.expenses.map((e: any) => e.id);
    const invoiceIds = payment.invoices.map((i: any) => i.id);
    const requisitionIds = payment.requisitions.map((r: any) => r.id);

    const journalEntries = await prisma.journalEntry.findMany({
        where: {
            OR: [
                { paymentId: params.id },
                ...(expenseIds.length ? [{ expenseId: { in: expenseIds } }] : []),
                ...(invoiceIds.length ? [{ invoiceId: { in: invoiceIds } }] : []),
                ...(requisitionIds.length ? [{ requisitionId: { in: requisitionIds } }] : [])
            ],
            // Only reverse original entries; skip entries that are already reversals
            reversalOfId: null,
            status: 'POSTED'
        }
    });

    if (!journalEntries.length) {
        return NextResponse.json({ error: "No posted journal entries found for this payment" }, { status: 422 });
    }

    const reversalIds: string[] = [];
    const reversalErrors: string[] = [];

    for (const entry of journalEntries) {
        try {
            const reversal = await AccountingEngine.createReversal(
                entry.id,
                session.user.id,
                `Payment reversal: ${reason}`
            );
            reversalIds.push(reversal.id);
        } catch (err: any) {
            reversalErrors.push(`Entry ${entry.entryNumber || entry.id}: ${err.message}`);
        }
    }

    if (reversalErrors.length > 0 && reversalIds.length === 0) {
        return NextResponse.json({ error: "All reversals failed", details: reversalErrors }, { status: 500 });
    }

    // Reopen linked items so they re-enter the payables queue
    await prisma.$transaction(async (tx) => {
        if (expenseIds.length) {
            await tx.expense.updateMany({
                where: { id: { in: expenseIds } },
                data: { status: 'APPROVED', paymentId: null, paidAt: null }
            });
        }
        if (invoiceIds.length) {
            await tx.invoice.updateMany({
                where: { id: { in: invoiceIds } },
                data: { status: 'APPROVED', paymentStatus: 'UNPAID', paymentId: null, paidAt: null }
            });
        }
        if (requisitionIds.length) {
            await (tx as any).requisition.updateMany({
                where: { id: { in: requisitionIds } },
                data: { status: 'APPROVED', paymentId: null }
            });
        }

        await (tx as any).payment.update({
            where: { id: params.id },
            data: {
                status: 'REVERSED',
                notes: `${payment.notes || ''}\n[REVERSED] ${reason}`.trim()
            }
        });
    });

    await (prisma as any).auditLog.create({
        data: {
            actorId: session.user.id,
            action: 'PAYMENT_REVERSE',
            entity: 'Payment',
            entityId: params.id,
            before: { status: payment.status },
            after: {
                status: 'REVERSED',
                reason,
                reversalEntries: reversalIds,
                partialErrors: reversalErrors
            }
        }
    });

    return NextResponse.json({
        success: true,
        reversalCount: reversalIds.length,
        warnings: reversalErrors.length ? reversalErrors : undefined
    });
}
