/**
 * Receipt Verification Service
 *
 * Orchestrates the eTIMS receipt verification pipeline:
 *   1. Call DigiTax to verify the fiscal invoice number
 *   2. Persist the result to ReceiptVerification (upsert — supports re-verification)
 *   3. Update legacy etrVerified fields on the Expense record
 *
 * OCR stub: extractFromReceipt() is a placeholder ready to be wired up to
 * Claude Vision or Tesseract when automated extraction is required.
 */

import prisma from '@/lib/prisma';
import { DigiTaxAdapter, DigiTaxVerifyInput, VerificationStatus } from './digitax-adapter';

export interface ReceiptVerifyInput {
    expenseId: string;
    receiptUrl?: string;
    fiscalInvoiceNo: string;
    supplierPin?: string;
    supplierName?: string;
    invoiceDate?: string;
    totalAmount?: number;
    vatAmount?: number;
}

export interface ReceiptVerifyResult {
    status: VerificationStatus;
    verificationId: string;
    referenceId?: string;
    failureReason?: string;
}

export class ReceiptVerificationService {
    static async verify(input: ReceiptVerifyInput): Promise<ReceiptVerifyResult> {
        const dtInput: DigiTaxVerifyInput = {
            fiscalInvoiceNo: input.fiscalInvoiceNo,
            supplierPin: input.supplierPin,
            supplierName: input.supplierName,
            invoiceDate: input.invoiceDate,
            totalAmount: input.totalAmount,
            vatAmount: input.vatAmount,
        };

        const result = await DigiTaxAdapter.verifyInvoice(dtInput);

        const verification = await (prisma as any).receiptVerification.upsert({
            where: { expenseId: input.expenseId },
            create: {
                expenseId: input.expenseId,
                status: result.status,
                receiptUrl: input.receiptUrl ?? null,
                supplierName: result.supplierName ?? input.supplierName ?? null,
                supplierPin: result.supplierPin ?? input.supplierPin ?? null,
                fiscalInvoiceNo: input.fiscalInvoiceNo,
                invoiceDate: input.invoiceDate ?? null,
                amountVerified: result.totalAmount ?? input.totalAmount ?? null,
                vatAmountVerified: result.vatAmount ?? input.vatAmount ?? null,
                verificationRef: result.referenceId ?? null,
                verificationPayload: result.raw ?? null,
                failureReason: result.failureReason ?? null,
                verifiedAt: result.status === 'VERIFIED' ? new Date() : null,
            },
            update: {
                status: result.status,
                ...(input.receiptUrl !== undefined && { receiptUrl: input.receiptUrl }),
                supplierName: result.supplierName ?? input.supplierName ?? null,
                supplierPin: result.supplierPin ?? input.supplierPin ?? null,
                fiscalInvoiceNo: input.fiscalInvoiceNo,
                invoiceDate: input.invoiceDate ?? null,
                amountVerified: result.totalAmount ?? input.totalAmount ?? null,
                vatAmountVerified: result.vatAmount ?? input.vatAmount ?? null,
                verificationRef: result.referenceId ?? null,
                verificationPayload: result.raw ?? null,
                failureReason: result.failureReason ?? null,
                verifiedAt: result.status === 'VERIFIED' ? new Date() : null,
            },
        });

        // Mirror to legacy Expense fields so existing code that reads etrVerified still works
        if (result.status === 'VERIFIED') {
            await prisma.expense.update({
                where: { id: input.expenseId },
                data: {
                    etrVerified: true,
                    etrVerifiedAt: new Date(),
                    etrNumber: input.fiscalInvoiceNo,
                    ...(input.receiptUrl !== undefined && { receiptUrl: input.receiptUrl }),
                },
            });
        } else if (input.receiptUrl !== undefined) {
            await prisma.expense.update({
                where: { id: input.expenseId },
                data: { receiptUrl: input.receiptUrl },
            });
        }

        return {
            status: result.status,
            verificationId: verification.id,
            referenceId: result.referenceId,
            failureReason: result.failureReason,
        };
    }

    /**
     * OCR stub — wire up to Claude Vision API or Tesseract when ready.
     * Returns empty object (no fields extracted) in the current implementation.
     */
    static async extractFromReceipt(
        _fileBuffer: Buffer,
        _mimeType: string
    ): Promise<{
        fiscalInvoiceNo?: string;
        supplierPin?: string;
        supplierName?: string;
        invoiceDate?: string;
        totalAmount?: number;
        vatAmount?: number;
    }> {
        // TODO: implement with Claude Vision or Tesseract OCR
        return {};
    }
}
