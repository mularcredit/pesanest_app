/**
 * Wallet → GL bridge helpers.
 *
 * Every function posts a journal entry INSIDE the caller's Prisma transaction
 * so the wallet balance update and the GL entry are atomic.
 *
 * Pattern: caller passes the Prisma transaction client (tx) and the relevant IDs/amounts.
 */

import { Prisma } from "@/generated/prisma-client";

type Tx = Prisma.TransactionClient;

// ── Account bootstrap helpers ──────────────────────────────────────────────

async function findOrCreate(tx: Tx, code: string, name: string, type: string, subtype?: string) {
    let acct = await tx.account.findFirst({ where: { code } });
    if (!acct) {
        acct = await tx.account.create({ data: { code, name, type, subtype } });
    }
    return acct;
}

async function nextJENumber(tx: Tx): Promise<string> {
    const seq = await (tx as any).documentSequence.upsert({
        where: { prefix: 'JE' },
        update: { lastNumber: { increment: 1 } },
        create: { prefix: 'JE', lastNumber: 1 },
    });
    return `JE-${String(seq.lastNumber).padStart(6, '0')}`;
}

async function postGL(
    tx: Tx,
    params: {
        date: Date;
        description: string;
        reference: string;
        userId?: string;
        lines: { accountId: string; debit: number; credit: number; description?: string }[];
    }
) {
    const totalDebit = params.lines.reduce((s, l) => s + l.debit, 0);
    const totalCredit = params.lines.reduce((s, l) => s + l.credit, 0);
    if (Math.abs(totalDebit - totalCredit) > 0.01) {
        throw new Error(`Wallet GL: debits (${totalDebit}) ≠ credits (${totalCredit})`);
    }

    const entryNumber = await nextJENumber(tx);

    const entry = await (tx as any).journalEntry.create({
        data: {
            entryNumber,
            date: params.date,
            description: params.description,
            reference: params.reference,
            createdBy: params.userId,
            status: 'POSTED',
            lines: {
                create: params.lines.map(l => ({
                    accountId: l.accountId,
                    debit: l.debit,
                    credit: l.credit,
                    description: l.description || params.description,
                }))
            }
        }
    });

    await (tx as any).auditLog.create({
        data: {
            actorId: params.userId,
            action: 'JOURNAL_POST',
            entity: 'JournalEntry',
            entityId: entry.id,
            after: { entryNumber, description: params.description },
        }
    });

    return entry;
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Admin virtual top-up — cash minted internally.
 * Dr Cash (wallet GL acct / 1001) / Cr Internal Equity — Wallet Funding (3100)
 */
export async function postVirtualTopup(tx: Tx, params: {
    amount: number;
    walletGlAccountId?: string | null;
    userId: string;
    reference: string;
}) {
    const cashAcct = params.walletGlAccountId
        ? await tx.account.findUnique({ where: { id: params.walletGlAccountId } })
        : await findOrCreate(tx, '1001', 'Cash — Corporate Wallet', 'ASSET', 'CASH');

    if (!cashAcct) throw new Error('Wallet GL account not found');

    const equityAcct = await findOrCreate(tx, '3100', 'Internal Equity — Wallet Funding', 'EQUITY');

    return postGL(tx, {
        date: new Date(),
        description: `Admin virtual top-up — KSh ${params.amount}`,
        reference: params.reference,
        userId: params.userId,
        lines: [
            { accountId: cashAcct.id, debit: params.amount, credit: 0, description: 'Cash received' },
            { accountId: equityAcct.id, debit: 0, credit: params.amount, description: 'Internal equity injection' },
        ],
    });
}

/**
 * Paystack top-up verified — real money received from payment gateway.
 * Dr Cash (wallet GL acct / 1001) / Cr Paystack Settlement Clearing (1003)
 */
export async function postPaystackTopup(tx: Tx, params: {
    amount: number;
    walletGlAccountId?: string | null;
    reference: string;
}) {
    const cashAcct = params.walletGlAccountId
        ? await tx.account.findUnique({ where: { id: params.walletGlAccountId } })
        : await findOrCreate(tx, '1001', 'Cash — Corporate Wallet', 'ASSET', 'CASH');

    if (!cashAcct) throw new Error('Wallet GL account not found');

    const clearingAcct = await findOrCreate(tx, '1003', 'Paystack Settlement Clearing', 'ASSET', 'CURRENT');

    return postGL(tx, {
        date: new Date(),
        description: `Paystack wallet top-up — ref ${params.reference}`,
        reference: params.reference,
        lines: [
            { accountId: cashAcct.id, debit: params.amount, credit: 0 },
            { accountId: clearingAcct.id, debit: 0, credit: params.amount },
        ],
    });
}

/**
 * HQ → Branch wallet allocation — internal cash transfer between wallets.
 * Dr Branch Cash (branchWallet GL / 1002) / Cr HQ Cash (hqWallet GL / 1001)
 */
export async function postWalletAllocation(tx: Tx, params: {
    amount: number;
    hqGlAccountId?: string | null;
    branchGlAccountId?: string | null;
    branchId: string;
    userId: string;
    reference: string;
}) {
    const hqAcct = params.hqGlAccountId
        ? await tx.account.findUnique({ where: { id: params.hqGlAccountId } })
        : await findOrCreate(tx, '1001', 'Cash — Corporate Wallet', 'ASSET', 'CASH');

    const branchAcct = params.branchGlAccountId
        ? await tx.account.findUnique({ where: { id: params.branchGlAccountId } })
        : await findOrCreate(tx, '1002', 'Cash — Branch Wallets', 'ASSET', 'CASH');

    if (!hqAcct || !branchAcct) throw new Error('Wallet GL accounts not found');

    return postGL(tx, {
        date: new Date(),
        description: `Wallet allocation to branch ${params.branchId} — KSh ${params.amount}`,
        reference: params.reference,
        userId: params.userId,
        lines: [
            { accountId: branchAcct.id, debit: params.amount, credit: 0, description: 'Branch cash received' },
            { accountId: hqAcct.id, debit: 0, credit: params.amount, description: 'HQ cash transferred out' },
        ],
    });
}
