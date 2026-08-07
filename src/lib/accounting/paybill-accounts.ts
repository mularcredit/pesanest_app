/**
 * Paybill account provisioning.
 *
 * A saved paybill is one of our own M-Pesa business accounts, so — like
 * BankAccount — every one gets its own GL sub-account in the 1050–1099 band,
 * right next to the shared Paybill Clearing code (1040) it replaces once set up.
 */

import prisma from "@/lib/prisma";

export const PAYBILL_GL_RANGE_START = 1050;
export const PAYBILL_GL_RANGE_END = 1099;

export async function nextPaybillGlCode(tx: { account: { findMany: Function } } = prisma as any): Promise<string> {
    const taken = await tx.account.findMany({
        where: {
            code: {
                gte: String(PAYBILL_GL_RANGE_START),
                lte: String(PAYBILL_GL_RANGE_END),
            },
        },
        select: { code: true },
    });

    const used = new Set(taken.map((a: { code: string }) => a.code));
    for (let code = PAYBILL_GL_RANGE_START; code <= PAYBILL_GL_RANGE_END; code++) {
        if (!used.has(String(code))) return String(code);
    }
    throw new Error(
        `No GL codes left in the paybill range ${PAYBILL_GL_RANGE_START}–${PAYBILL_GL_RANGE_END}`
    );
}

export type NewPaybillAccount = {
    name: string;
    paybillNumber: string;
    accountNumber?: string | null;
};

/**
 * Creates the GL sub-account and the paybill account together, so a failure
 * can never leave an orphaned GL account behind.
 */
export async function provisionPaybillAccount(input: NewPaybillAccount) {
    const name = input.name.trim();
    const paybillNumber = input.paybillNumber.trim();
    const accountNumber = input.accountNumber?.trim() || null;

    if (!name || !paybillNumber) throw new Error("Name and paybill number are both required");

    return prisma.$transaction(async (tx) => {
        const code = await nextPaybillGlCode(tx as any);

        const glAccount = await tx.account.create({
            data: {
                code,
                name: `Paybill — ${name}`,
                type: "ASSET",
                subtype: "PAYBILL",
                description: `GL sub-account for Paybill ${paybillNumber}${accountNumber ? ` / ${accountNumber}` : ""}`,
            },
        });

        return (tx as any).paybillAccount.create({
            data: { name, paybillNumber, accountNumber, glAccountId: glAccount.id },
            include: { glAccount: true },
        });
    });
}
