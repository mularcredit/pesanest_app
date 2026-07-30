import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { ReceiptVerificationService } from '@/lib/etims/receipt-verification-service';
import { EtimsService } from '@/lib/tax/etims';

export async function POST(req: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();
        const {
            expenseId,
            requisitionId,
            receiptUrl,
            fiscalInvoiceNo,
            supplierPin,
            supplierName,
            invoiceDate,
            totalAmount,
            vatAmount,
        } = body;

        if (!fiscalInvoiceNo) {
            return NextResponse.json({ error: 'fiscalInvoiceNo is required' }, { status: 400 });
        }

        const prisma = (await import('@/lib/prisma')).default;

        // Requisition path
        if (requisitionId) {
            const req2 = await prisma.requisition.findUnique({ where: { id: requisitionId }, select: { id: true } });
            if (!req2) return NextResponse.json({ error: 'Requisition not found' }, { status: 404 });

            const result = await EtimsService.verifyVendorReceipt(String(fiscalInvoiceNo).trim());
            await prisma.requisition.update({
                where: { id: requisitionId },
                data: {
                    etrNumber: String(fiscalInvoiceNo).trim(),
                    etrVerified: result.valid,
                    etrVerifiedAt: result.valid ? new Date() : null,
                },
            });

            return NextResponse.json({
                success: true,
                status: result.valid ? 'VERIFIED' : 'FAILED',
                referenceId: result.valid ? result.etrNumber : undefined,
                error: result.valid ? undefined : (result.error || 'ETR number not found in KRA records'),
            });
        }

        // Expense path
        if (!expenseId) {
            return NextResponse.json({ error: 'expenseId or requisitionId is required' }, { status: 400 });
        }

        const expense = await prisma.expense.findUnique({ where: { id: expenseId }, select: { id: true } });
        if (!expense) return NextResponse.json({ error: 'Expense not found' }, { status: 404 });

        const result = await ReceiptVerificationService.verify({
            expenseId,
            receiptUrl,
            fiscalInvoiceNo: String(fiscalInvoiceNo).trim(),
            supplierPin: supplierPin || undefined,
            supplierName: supplierName || undefined,
            invoiceDate: invoiceDate || undefined,
            totalAmount: totalAmount !== undefined ? parseFloat(totalAmount) : undefined,
            vatAmount: vatAmount !== undefined ? parseFloat(vatAmount) : undefined,
        });

        return NextResponse.json({ success: true, ...result });
    } catch (err: any) {
        console.error('[verify-receipt]', err);
        return NextResponse.json({ error: err.message || 'Verification failed' }, { status: 500 });
    }
}
