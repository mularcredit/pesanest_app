/**
 * Bank account provisioning.
 *
 * Every bank account gets its own GL sub-account in the 1100–1199 band so bank
 * balances stay separable in the trial balance. Shared by the admin API route
 * and the Transfers setup UI so the numbering rule lives in one place.
 */

import prisma from "@/lib/prisma";

export const BANK_GL_RANGE_START = 1100;
export const BANK_GL_RANGE_END = 1199;

/**
 * Lowest unused code in the bank band.
 *
 * Deliberately not "highest + 1": that walks off the end of the band into 1200
 * (Accounts Receivable) once 1199 is taken, and it also leaks codes when an
 * account is removed.
 */
export async function nextBankGlCode(tx: { account: { findMany: Function } } = prisma as any): Promise<string> {
    const taken = await tx.account.findMany({
        where: {
            code: {
                gte: String(BANK_GL_RANGE_START),
                lte: String(BANK_GL_RANGE_END),
            },
        },
        select: { code: true },
    });

    const used = new Set(taken.map((a: { code: string }) => a.code));
    for (let code = BANK_GL_RANGE_START; code <= BANK_GL_RANGE_END; code++) {
        if (!used.has(String(code))) return String(code);
    }
    throw new Error(
        `No GL codes left in the bank range ${BANK_GL_RANGE_START}–${BANK_GL_RANGE_END}`
    );
}

export type NewBankAccount = {
    name: string;
    bankName: string;
    accountNumber?: string | null;
    currency?: string | null;
};

/**
 * Creates the GL sub-account and the bank account together, so a failure can
 * never leave an orphaned GL account behind.
 */
export async function provisionBankAccount(input: NewBankAccount) {
    const name = input.name.trim();
    const bankName = input.bankName.trim();
    const accountNumber = input.accountNumber?.trim() || null;
    const currency = (input.currency || "KES").trim().toUpperCase();

    if (!name || !bankName) throw new Error("Account name and bank name are both required");

    return prisma.$transaction(async (tx) => {
        const code = await nextBankGlCode(tx as any);

        const glAccount = await tx.account.create({
            data: {
                code,
                name: `Bank — ${name}`,
                type: "ASSET",
                subtype: "BANK",
                currency,
                description: `GL sub-account for ${bankName} — ${accountNumber || "N/A"}`,
            },
        });

        return (tx as any).bankAccount.create({
            data: { name, bankName, accountNumber, currency, glAccountId: glAccount.id },
            include: { glAccount: true },
        });
    });
}
