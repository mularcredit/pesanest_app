"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { provisionBankAccount } from "@/lib/accounting/bank-accounts";

const PATH = "/dashboard/transfers";

async function requireAdmin() {
    const session = await auth();
    if (!session?.user?.id) return { error: "Unauthorized" as const };
    const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { role: true, customRole: { select: { isSystem: true } } },
    });
    const isAdmin = user?.role === "SYSTEM_ADMIN" || !!user?.customRole?.isSystem;
    if (!isAdmin) return { error: "Only System Admins can manage bank accounts" as const };
    return { userId: session.user.id };
}

export async function getBankAccountsDetailed() {
    const rows = await prisma.bankAccount.findMany({
        include: { glAccount: { select: { code: true, name: true } } },
        orderBy: [{ isActive: "desc" }, { name: "asc" }],
    });

    const transferCounts = await prisma.transfer.groupBy({
        by: ["fromBankAccountId"],
        _count: { _all: true },
    });
    const usedFrom = new Map(
        transferCounts
            .filter(t => t.fromBankAccountId)
            .map(t => [t.fromBankAccountId as string, t._count._all])
    );

    return rows.map(b => ({
        id: b.id,
        name: b.name,
        bankName: b.bankName,
        accountNumber: b.accountNumber,
        currency: b.currency,
        isActive: b.isActive,
        glCode: b.glAccount?.code ?? null,
        glName: b.glAccount?.name ?? null,
        transfersOut: usedFrom.get(b.id) ?? 0,
    }));
}

export async function createBankAccount(formData: FormData) {
    try {
        const gate = await requireAdmin();
        if ("error" in gate) return { success: false, error: gate.error };

        const name = ((formData.get("name") as string) || "").trim();
        const bankName = ((formData.get("bankName") as string) || "").trim();
        const accountNumber = ((formData.get("accountNumber") as string) || "").trim() || null;
        const currency = ((formData.get("currency") as string) || "KES").trim().toUpperCase();

        if (!name) return { success: false, error: "Give the account a name, e.g. \"Main Operating\"" };
        if (!bankName) return { success: false, error: "Enter the bank's name" };

        const duplicate = await prisma.bankAccount.findFirst({
            where: {
                bankName: { equals: bankName, mode: "insensitive" },
                ...(accountNumber ? { accountNumber } : { name: { equals: name, mode: "insensitive" } }),
            },
            select: { id: true },
        });
        if (duplicate) {
            return {
                success: false,
                error: accountNumber
                    ? "That account number is already set up for this bank"
                    : "An account with that name already exists for this bank",
            };
        }

        const created = await provisionBankAccount({ name, bankName, accountNumber, currency });

        await (prisma as any).auditLog.create({
            data: {
                actorId: gate.userId,
                action: "BANK_ACCOUNT_CREATE",
                entity: "BankAccount",
                entityId: created.id,
                after: { name, bankName, accountNumber, glCode: created.glAccount?.code },
            },
        }).catch(() => {});

        revalidatePath(PATH);
        return { success: true, glCode: created.glAccount?.code as string | undefined };
    } catch (e: any) {
        return { success: false, error: e?.message || "Could not create the bank account" };
    }
}

/**
 * Deactivate rather than delete — transfers and statements reference the account,
 * and its GL sub-account may already carry postings.
 */
export async function setBankAccountActive(id: string, isActive: boolean) {
    try {
        const gate = await requireAdmin();
        if ("error" in gate) return { success: false, error: gate.error };

        const existing = await prisma.bankAccount.findUnique({ where: { id }, select: { id: true } });
        if (!existing) return { success: false, error: "Bank account not found" };

        await prisma.bankAccount.update({ where: { id }, data: { isActive } });

        revalidatePath(PATH);
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e?.message || "Could not update the bank account" };
    }
}
