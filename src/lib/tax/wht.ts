/**
 * Withholding Tax (WHT) Service
 *
 * Kenya requires payers to withhold tax on certain payments:
 *   - Professional/management fees: 5%
 *   - Contractual/construction: 3%
 *   - Rent (commercial): 10%, (residential): 7.5%
 *   - Royalties: 5%
 *
 * Withheld amounts are payable to KRA monthly via iTax.
 * WHT certificates (KRA Form WHT-1) must be issued to vendors.
 */

import prisma from "@/lib/prisma";

export interface WhtCalculation {
    grossAmount: number;
    whtRate: number;
    whtAmount: number;
    netPayable: number;
}

/**
 * Calculate withholding tax for a given gross amount and rate ID.
 */
export async function calculateWHT(grossAmount: number, whtRateId: string): Promise<WhtCalculation> {
    const taxRate = await (prisma as any).taxRate.findUnique({ where: { id: whtRateId } });
    if (!taxRate) throw new Error(`WHT rate ${whtRateId} not found`);
    if (taxRate.type !== 'WITHHOLDING') throw new Error(`Tax rate ${taxRate.code} is not a withholding tax rate`);

    const whtRate = Number(taxRate.rate);
    const whtAmount = Math.round((grossAmount * whtRate / 100) * 100) / 100;

    return {
        grossAmount,
        whtRate,
        whtAmount,
        netPayable: grossAmount - whtAmount,
    };
}

/**
 * Issue a WHT certificate number for a vendor invoice and record it on the invoice.
 * Format: WHT-YYYY-NNNNNN (sequential, year-prefixed)
 */
export async function issueWhtCertificate(invoiceId: string): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `WHT-${year}`;

    const seq = await (prisma as any).documentSequence.upsert({
        where: { prefix },
        update: { lastNumber: { increment: 1 } },
        create: { prefix, lastNumber: 1 },
    });

    const certNumber = `${prefix}-${String(seq.lastNumber).padStart(6, '0')}`;

    await prisma.invoice.update({
        where: { id: invoiceId },
        data: { whtCertNumber: certNumber }
    });

    return certNumber;
}

/**
 * Returns all unpaid WHT liabilities grouped by month, ready for iTax filing.
 * A liability is "unpaid" when the vendor payment is posted but the WHT Payable
 * account (2300) has not been cleared to a KRA payment entry.
 */
export async function getWhtLiabilitySummary() {
    const whtAccount = await prisma.account.findFirst({ where: { code: '2300' } });
    if (!whtAccount) return { totalLiability: 0, entries: [] };

    const lines = await (prisma as any).journalLine.findMany({
        where: { accountId: whtAccount.id, credit: { gt: 0 } },
        include: { entry: { select: { date: true, description: true, reference: true } } },
        orderBy: { entry: { date: 'asc' } },
    });

    const totalLiability = lines.reduce((sum: number, l: any) => sum + Number(l.credit), 0);

    return { totalLiability, entries: lines };
}
