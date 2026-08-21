/**
 * A "reconcilable account" is anything with its own GL sub-account that a bank
 * statement can be imported and matched against — BankAccount, PaybillAccount,
 * and the corporate Wallet (only once it has a glAccountId linked — most
 * per-user wallets don't). IDs are globally unique cuids, so resolving one by
 * trying each table is safe and unambiguous, and lets the existing
 * /api/accounting/bank-accounts/[id]/... routes serve any kind without a
 * separate URL space per account type.
 */

import prisma from "@/lib/prisma";

export type ReconcilableAccount = {
    kind: 'BANK' | 'PAYBILL' | 'WALLET';
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

    const wallet = await prisma.wallet.findUnique({
        where: { id },
        select: { id: true, glAccountId: true },
    });
    if (wallet?.glAccountId) return { kind: 'WALLET', id: wallet.id, label: 'Corporate Wallet', glAccountId: wallet.glAccountId };

    return null;
}

/** Prisma where-clause fragment for "statements belonging to this account", regardless of kind. */
export function statementOwnerFilter(accountId: string) {
    return { OR: [{ bankAccountId: accountId }, { paybillAccountId: accountId }, { walletId: accountId }] };
}
