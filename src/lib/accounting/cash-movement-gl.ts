/**
 * GL bridge for physical cash movements: petty cash floats and inter-account
 * transfers (bank↔bank, bank→mobile, to/from paybill).
 *
 * Same contract as wallet-gl.ts — every function posts inside the caller's
 * Prisma transaction so the balance change and the journal entry are atomic.
 */

import { Prisma } from "@/generated/prisma-client";
import { findOrCreate, postGL } from "./wallet-gl";

type Tx = Prisma.TransactionClient;

// Chart-of-accounts codes. 1010 and 6100 already ship in prisma/seed-accounts.ts.
export const GL_CODES = {
    PETTY_CASH: '1010',
    CASH_ON_HAND: '1000',
    MOBILE_MONEY: '1030',
    PAYBILL_CLEARING: '1040',
    BANK_CHARGES: '6100',
    CASH_OVER_SHORT: '6110',
} as const;

/**
 * Refuse to post into books that have been closed.
 *
 * Only matters once a date can be chosen by hand — entries stamped with "now"
 * land in the open period by definition. Mirrors the check the accounting
 * engine applies to journal entries.
 */
export async function assertPostingAllowed(tx: Tx, date: Date): Promise<void> {
    const period = await (tx as any).accountingPeriod.findFirst({
        where: { startDate: { lte: date }, endDate: { gte: date } },
    });
    if (!period) return; // no period defined for that date — nothing to enforce

    if (period.isClosed) {
        throw new Error(`Accounting period "${period.name}" is closed — pick a date inside an open period.`);
    }

    const fy = await (tx as any).fiscalYear.findUnique({ where: { id: period.fiscalYearId } });
    if (fy?.isClosed) {
        throw new Error(`Fiscal year "${fy.name}" is closed — pick a date inside an open year.`);
    }
}

async function pettyCashAccount(tx: Tx, glAccountId?: string | null) {
    if (glAccountId) {
        const acct = await tx.account.findUnique({ where: { id: glAccountId } });
        if (acct) return acct;
    }
    return findOrCreate(tx, GL_CODES.PETTY_CASH, 'Petty Cash', 'ASSET', 'CURRENT_ASSET');
}

/** Resolve the GL account for one leg of a transfer. */
export async function resolveTransferLeg(
    tx: Tx,
    leg: { bankAccountId?: string | null; paybillAccountId?: string | null; kind: 'BANK' | 'MOBILE' | 'PAYBILL' }
) {
    if (leg.bankAccountId) {
        const bank = await tx.bankAccount.findUnique({
            where: { id: leg.bankAccountId },
            include: { glAccount: true },
        });
        if (bank?.glAccount) return bank.glAccount;
    }
    if (leg.paybillAccountId) {
        const paybill = await tx.paybillAccount.findUnique({
            where: { id: leg.paybillAccountId },
            include: { glAccount: true },
        });
        if (paybill?.glAccount) return paybill.glAccount;
    }
    if (leg.kind === 'MOBILE') {
        return findOrCreate(tx, GL_CODES.MOBILE_MONEY, 'Mobile Money Float', 'ASSET', 'CURRENT_ASSET');
    }
    if (leg.kind === 'PAYBILL') {
        // No saved paybill was picked — fall back to the shared clearing bucket.
        return findOrCreate(tx, GL_CODES.PAYBILL_CLEARING, 'Paybill Clearing', 'ASSET', 'CURRENT_ASSET');
    }
    return findOrCreate(tx, GL_CODES.CASH_ON_HAND, 'Cash on Hand', 'ASSET', 'CURRENT_ASSET');
}

// ── Petty cash ─────────────────────────────────────────────────────────────

/**
 * Float replenishment — cash moves from a bank/cash account into the tin.
 * Dr Petty Cash / Cr funding account
 */
export async function postPettyCashReplenish(tx: Tx, params: {
    amount: number;
    pettyCashGlAccountId?: string | null;
    fundingGlAccountId?: string | null;
    userId?: string;
    reference: string;
    description?: string;
    /** Date the cash actually moved. Defaults to now; backdated for historical entries. */
    date?: Date;
}) {
    const petty = await pettyCashAccount(tx, params.pettyCashGlAccountId);
    const funding = params.fundingGlAccountId
        ? await tx.account.findUnique({ where: { id: params.fundingGlAccountId } })
        : await findOrCreate(tx, GL_CODES.CASH_ON_HAND, 'Cash on Hand', 'ASSET', 'CURRENT_ASSET');

    if (!funding) throw new Error('Funding account not found');

    return postGL(tx, {
        date: params.date ?? new Date(),
        description: params.description || `Petty cash replenishment — KSh ${params.amount}`,
        reference: params.reference,
        userId: params.userId,
        lines: [
            { accountId: petty.id, debit: params.amount, credit: 0, description: 'Petty cash float increased' },
            { accountId: funding.id, debit: 0, credit: params.amount, description: 'Cash transferred to petty cash' },
        ],
    });
}

/**
 * Petty cash payout against an expense.
 * Dr Expense account / Cr Petty Cash
 */
export async function postPettyCashSpend(tx: Tx, params: {
    amount: number;
    expenseGlAccountId?: string | null;
    pettyCashGlAccountId?: string | null;
    userId?: string;
    reference: string;
    description: string;
}) {
    const petty = await pettyCashAccount(tx, params.pettyCashGlAccountId);
    const expense = params.expenseGlAccountId
        ? await tx.account.findUnique({ where: { id: params.expenseGlAccountId } })
        : await findOrCreate(tx, '6040', 'Office Supplies', 'EXPENSE', 'OPERATING_EXPENSE');

    if (!expense) throw new Error('Expense account not found');

    return postGL(tx, {
        date: new Date(),
        description: params.description,
        reference: params.reference,
        userId: params.userId,
        lines: [
            { accountId: expense.id, debit: params.amount, credit: 0, description: params.description },
            { accountId: petty.id, debit: 0, credit: params.amount, description: 'Paid from petty cash' },
        ],
    });
}

/**
 * Reconciliation adjustment. A shortage (delta < 0) writes the loss to
 * Cash Over & Short; an overage (delta > 0) credits it back.
 */
export async function postPettyCashAdjustment(tx: Tx, params: {
    delta: number;
    pettyCashGlAccountId?: string | null;
    userId?: string;
    reference: string;
    description: string;
}) {
    const petty = await pettyCashAccount(tx, params.pettyCashGlAccountId);
    const overShort = await findOrCreate(tx, GL_CODES.CASH_OVER_SHORT, 'Cash Over & Short', 'EXPENSE', 'OPERATING_EXPENSE');
    const magnitude = Math.abs(params.delta);

    const lines = params.delta < 0
        ? [
            { accountId: overShort.id, debit: magnitude, credit: 0, description: 'Petty cash shortage' },
            { accountId: petty.id, debit: 0, credit: magnitude, description: 'Float written down' },
        ]
        : [
            { accountId: petty.id, debit: magnitude, credit: 0, description: 'Float written up' },
            { accountId: overShort.id, debit: 0, credit: magnitude, description: 'Petty cash overage' },
        ];

    return postGL(tx, {
        date: new Date(),
        description: params.description,
        reference: params.reference,
        userId: params.userId,
        lines,
    });
}

// ── Transfers ──────────────────────────────────────────────────────────────

/**
 * Cash moved between two accounts, with any bank charge expensed separately.
 * Dr destination + Dr charges / Cr source (source is debited for the full
 * amount leaving the account, i.e. amount + charges).
 */
export async function postTransfer(tx: Tx, params: {
    amount: number;
    charges?: number;
    fromAccountId: string;
    toAccountId: string;
    userId?: string;
    reference: string;
    description: string;
}) {
    const charges = params.charges || 0;

    const lines = [
        { accountId: params.toAccountId, debit: params.amount, credit: 0, description: 'Funds received' },
        { accountId: params.fromAccountId, debit: 0, credit: params.amount + charges, description: 'Funds sent' },
    ];

    if (charges > 0) {
        const chargeAcct = await findOrCreate(tx, GL_CODES.BANK_CHARGES, 'Bank Charges', 'EXPENSE', 'OPERATING_EXPENSE');
        lines.push({ accountId: chargeAcct.id, debit: charges, credit: 0, description: 'Transfer charges' });
    }

    return postGL(tx, {
        date: new Date(),
        description: params.description,
        reference: params.reference,
        userId: params.userId,
        lines,
    });
}
