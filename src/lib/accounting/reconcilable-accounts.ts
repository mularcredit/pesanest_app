/**
 * A "reconcilable account" is anything with its own GL sub-account that a bank
 * statement can be imported and matched against — currently BankAccount and
 * PaybillAccount. IDs are globally unique cuids, so resolving one by trying
 * both tables is safe and unambiguous, and lets the existing
 * /api/accounting/bank-accounts/[id]/... routes serve either kind without a
 * separate URL space per account type.
 */

import prisma from "@/lib/prisma";

export type ReconcilableAccount = {
    kind: 'BANK' | 'PAYBILL';
    id: string;
    label: string;
    glAccountId: string;
};

export async function resolveReconcilableAccount(id: string): Promise<ReconcilableAccount | null> {
    const bank = await prisma.bankAccount.findUnique({
        where: { id },
        select: { id: true, name: true, bankName: true, glAccountId: true },
    });
    if (bank) return { kind: 'BANK', id: bank.id, label: `${bank.name} — ${bank.bankName}`, glAccountId: bank.glAccountId };

    const paybill = await prisma.paybillAccount.findUnique({
        where: { id },
        select: { id: true, name: true, paybillNumber: true, glAccountId: true },
    });
    if (paybill) return { kind: 'PAYBILL', id: paybill.id, label: `${paybill.name} — ${paybill.paybillNumber}`, glAccountId: paybill.glAccountId };

    return null;
}

/** Prisma where-clause fragment for "statements belonging to this account", regardless of kind. */
export function statementOwnerFilter(accountId: string) {
    return { OR: [{ bankAccountId: accountId }, { paybillAccountId: accountId }] };
}
