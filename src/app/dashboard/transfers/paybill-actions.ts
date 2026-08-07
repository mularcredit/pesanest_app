"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";

const PATH = "/dashboard/transfers";

async function requireAdmin() {
    const session = await auth();
    if (!session?.user?.id) return { error: "Unauthorized" as const };
    const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { role: true, customRole: { select: { isSystem: true } } },
    });
    const isAdmin = user?.role === "SYSTEM_ADMIN" || !!user?.customRole?.isSystem;
    if (!isAdmin) return { error: "Only System Admins can manage paybill accounts" as const };
    return { userId: session.user.id };
}

export async function getPaybillAccountsDetailed() {
    const rows = await prisma.paybillAccount.findMany({
        orderBy: [{ isActive: "desc" }, { name: "asc" }],
    });

    const transferCounts = await prisma.transfer.groupBy({
        by: ["paybillAccountId"],
        _count: { _all: true },
    });
    const used = new Map(
        transferCounts
            .filter(t => t.paybillAccountId)
            .map(t => [t.paybillAccountId as string, t._count._all])
    );

    return rows.map(p => ({
        id: p.id,
        name: p.name,
        paybillNumber: p.paybillNumber,
        accountNumber: p.accountNumber,
        isActive: p.isActive,
        transfersUsed: used.get(p.id) ?? 0,
    }));
}

export async function createPaybillAccount(formData: FormData) {
    try {
        const gate = await requireAdmin();
        if ("error" in gate) return { success: false, error: gate.error };

        const name = ((formData.get("name") as string) || "").trim();
        const paybillNumber = ((formData.get("paybillNumber") as string) || "").trim();
        const accountNumber = ((formData.get("accountNumber") as string) || "").trim() || null;

        if (!name) return { success: false, error: "Give the paybill a name, e.g. \"KPLC Postpaid\"" };
        if (!paybillNumber) return { success: false, error: "Enter the paybill number" };

        const duplicate = await prisma.paybillAccount.findFirst({
            where: {
                paybillNumber,
                ...(accountNumber ? { accountNumber } : { name: { equals: name, mode: "insensitive" } }),
            },
            select: { id: true },
        });
        if (duplicate) {
            return {
                success: false,
                error: accountNumber
                    ? "That paybill number and account are already saved"
                    : "A paybill with that name already exists",
            };
        }

        const created = await prisma.paybillAccount.create({
            data: { name, paybillNumber, accountNumber },
        });

        await (prisma as any).auditLog.create({
            data: {
                actorId: gate.userId,
                action: "PAYBILL_ACCOUNT_CREATE",
                entity: "PaybillAccount",
                entityId: created.id,
                after: { name, paybillNumber, accountNumber },
            },
        }).catch(() => {});

        revalidatePath(PATH);
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e?.message || "Could not create the paybill account" };
    }
}

/**
 * Deactivate rather than delete — past transfers reference the account.
 */
export async function setPaybillAccountActive(id: string, isActive: boolean) {
    try {
        const gate = await requireAdmin();
        if ("error" in gate) return { success: false, error: gate.error };

        const existing = await prisma.paybillAccount.findUnique({ where: { id }, select: { id: true } });
        if (!existing) return { success: false, error: "Paybill account not found" };

        await prisma.paybillAccount.update({ where: { id }, data: { isActive } });

        revalidatePath(PATH);
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e?.message || "Could not update the paybill account" };
    }
}
