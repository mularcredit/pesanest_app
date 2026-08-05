"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { postTransfer, resolveTransferLeg } from "@/lib/accounting/cash-movement-gl";
import { TRANSFER_TYPES } from "./constants";

const PATH = "/dashboard/transfers";

const num = (v: any) => (v == null ? 0 : Number(v));

async function currentUser() {
    const session = await auth();
    if (!session?.user?.id) return null;
    const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { id: true, name: true, role: true, customRole: { select: { isSystem: true } } },
    });
    if (!user) return null;
    return { ...user, isAdmin: user.role === "SYSTEM_ADMIN" || !!user.customRole?.isSystem };
}

async function nextTransferRef() {
    const seq = await (prisma as any).documentSequence.upsert({
        where: { prefix: "TRF" },
        update: { lastNumber: { increment: 1 } },
        create: { prefix: "TRF", lastNumber: 1 },
    });
    return `TRF-${String(seq.lastNumber).padStart(6, "0")}`;
}

function serialise(t: any) {
    return {
        id: t.id,
        reference: t.reference,
        type: t.type,
        status: t.status,
        amount: num(t.amount),
        charges: num(t.charges),
        currency: t.currency,
        transferDate: t.transferDate.toISOString(),
        fromLabel: t.fromBankAccount ? `${t.fromBankAccount.name} — ${t.fromBankAccount.bankName}` : t.fromLabel,
        toLabel: t.toBankAccount ? `${t.toBankAccount.name} — ${t.toBankAccount.bankName}` : t.toLabel,
        toPhone: t.toPhone,
        paybillNumber: t.paybillNumber,
        paybillAccount: t.paybillAccount,
        narration: t.narration,
        externalRef: t.externalRef,
        isPosted: !!t.journalEntryId,
        createdBy: t.createdBy,
        createdAt: t.createdAt.toISOString(),
    };
}

export async function getTransfers(filters?: { type?: string; status?: string; q?: string }) {
    const where: any = {};
    if (filters?.type && filters.type !== 'ALL') where.type = filters.type;
    if (filters?.status && filters.status !== 'ALL') where.status = filters.status;
    if (filters?.q) {
        where.OR = [
            { reference: { contains: filters.q, mode: 'insensitive' } },
            { narration: { contains: filters.q, mode: 'insensitive' } },
            { externalRef: { contains: filters.q, mode: 'insensitive' } },
            { toPhone: { contains: filters.q, mode: 'insensitive' } },
            { paybillNumber: { contains: filters.q, mode: 'insensitive' } },
            { toLabel: { contains: filters.q, mode: 'insensitive' } },
            { fromLabel: { contains: filters.q, mode: 'insensitive' } },
        ];
    }

    const rows = await prisma.transfer.findMany({
        where,
        orderBy: { transferDate: 'desc' },
        take: 300,
        include: {
            fromBankAccount: { select: { name: true, bankName: true } },
            toBankAccount: { select: { name: true, bankName: true } },
        },
    });

    return rows.map(serialise);
}

export async function getTransferStats() {
    const rows = await prisma.transfer.findMany({
        select: { type: true, status: true, amount: true, charges: true, transferDate: true },
    });

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const completed = rows.filter(r => r.status === 'COMPLETED');
    const byType: Record<string, { count: number; volume: number }> = {};
    for (const t of TRANSFER_TYPES) byType[t.value] = { count: 0, volume: 0 };
    for (const r of completed) {
        if (!byType[r.type]) byType[r.type] = { count: 0, volume: 0 };
        byType[r.type].count += 1;
        byType[r.type].volume += num(r.amount);
    }

    return {
        totalVolume: completed.reduce((s, r) => s + num(r.amount), 0),
        monthVolume: completed
            .filter(r => r.transferDate >= monthStart)
            .reduce((s, r) => s + num(r.amount), 0),
        totalCharges: completed.reduce((s, r) => s + num(r.charges), 0),
        count: rows.length,
        pendingCount: rows.filter(r => r.status === 'PENDING').length,
        failedCount: rows.filter(r => r.status === 'FAILED').length,
        byType,
    };
}

export async function getBankAccounts() {
    const banks = await prisma.bankAccount.findMany({
        where: { isActive: true },
        select: { id: true, name: true, bankName: true, currency: true },
        orderBy: { name: 'asc' },
    });
    return banks.map(b => ({ id: b.id, label: `${b.name} — ${b.bankName}`, currency: b.currency }));
}

/**
 * Which legs of each transfer type map onto a GL account we can post to.
 * A leg that is an outside party (a customer paying our paybill, a payee's
 * phone) has no GL account of ours, so those transfers are recorded for
 * monitoring only and left unposted.
 */
function glPlan(type: string, fromBankAccountId?: string | null, toBankAccountId?: string | null) {
    switch (type) {
        case 'BANK_TO_BANK':
            return fromBankAccountId && toBankAccountId
                ? { from: { bankAccountId: fromBankAccountId, kind: 'BANK' as const }, to: { bankAccountId: toBankAccountId, kind: 'BANK' as const } }
                : null;
        case 'BANK_TO_MOBILE':
            return fromBankAccountId
                ? { from: { bankAccountId: fromBankAccountId, kind: 'BANK' as const }, to: { bankAccountId: null, kind: 'MOBILE' as const } }
                : null;
        case 'TO_PAYBILL':
            return fromBankAccountId
                ? { from: { bankAccountId: fromBankAccountId, kind: 'BANK' as const }, to: { bankAccountId: null, kind: 'PAYBILL' as const } }
                : null;
        case 'FROM_PAYBILL':
            return toBankAccountId
                ? { from: { bankAccountId: null, kind: 'PAYBILL' as const }, to: { bankAccountId: toBankAccountId, kind: 'BANK' as const } }
                : null;
        default:
            return null;
    }
}

export async function createTransfer(formData: FormData) {
    try {
        const user = await currentUser();
        if (!user) return { success: false, error: "Unauthorized" };

        const type = (formData.get("type") as string) || "";
        if (!TRANSFER_TYPES.some(t => t.value === type)) return { success: false, error: "Pick a transfer type" };

        const amount = Number(formData.get("amount"));
        if (!Number.isFinite(amount) || amount <= 0) return { success: false, error: "Enter a valid amount" };

        const charges = Number(formData.get("charges") || 0);
        if (!Number.isFinite(charges) || charges < 0) return { success: false, error: "Charges must be zero or more" };

        const dateStr = (formData.get("transferDate") as string) || "";
        const transferDate = dateStr ? new Date(dateStr) : new Date();
        if (Number.isNaN(transferDate.getTime())) return { success: false, error: "Enter a valid date" };

        const status = ((formData.get("status") as string) || "COMPLETED").toUpperCase();
        const fromBankAccountId = ((formData.get("fromBankAccountId") as string) || "").trim() || null;
        const toBankAccountId = ((formData.get("toBankAccountId") as string) || "").trim() || null;
        const toPhone = ((formData.get("toPhone") as string) || "").trim() || null;
        const paybillNumber = ((formData.get("paybillNumber") as string) || "").trim() || null;
        const paybillAccount = ((formData.get("paybillAccount") as string) || "").trim() || null;
        const fromLabel = ((formData.get("fromLabel") as string) || "").trim() || null;
        const toLabel = ((formData.get("toLabel") as string) || "").trim() || null;
        const narration = ((formData.get("narration") as string) || "").trim() || null;
        const externalRef = ((formData.get("externalRef") as string) || "").trim() || null;
        const currency = ((formData.get("currency") as string) || "KES").trim();

        // Per-type minimum detail so a row is always identifiable later.
        if (type === 'BANK_TO_BANK' && !fromBankAccountId && !fromLabel)
            return { success: false, error: "Choose the source bank account" };
        if (type === 'BANK_TO_BANK' && !toBankAccountId && !toLabel)
            return { success: false, error: "Choose the destination bank account" };
        if (type === 'BANK_TO_MOBILE' && !toPhone)
            return { success: false, error: "Enter the destination mobile number" };
        if ((type === 'TO_PAYBILL' || type === 'FROM_PAYBILL') && !paybillNumber)
            return { success: false, error: "Enter the paybill number" };

        if (fromBankAccountId && fromBankAccountId === toBankAccountId)
            return { success: false, error: "Source and destination cannot be the same account" };

        const reference = await nextTransferRef();
        const plan = status === 'COMPLETED' ? glPlan(type, fromBankAccountId, toBankAccountId) : null;
        const description = narration || `${type.replace(/_/g, ' ').toLowerCase()} — ${currency} ${amount.toLocaleString()}`;

        const created = await prisma.$transaction(async (tx) => {
            let journalEntryId: string | null = null;

            if (plan) {
                const fromAcct = await resolveTransferLeg(tx as any, plan.from);
                const toAcct = await resolveTransferLeg(tx as any, plan.to);
                if (fromAcct.id === toAcct.id) {
                    throw new Error("Source and destination map to the same GL account");
                }
                const entry = await postTransfer(tx as any, {
                    amount,
                    charges,
                    fromAccountId: fromAcct.id,
                    toAccountId: toAcct.id,
                    userId: user.id,
                    reference,
                    description,
                });
                journalEntryId = entry.id;
            }

            return tx.transfer.create({
                data: {
                    reference, type, status, amount, charges, currency, transferDate,
                    fromBankAccountId, toBankAccountId, fromLabel, toLabel,
                    toPhone, paybillNumber, paybillAccount, narration, externalRef,
                    journalEntryId,
                    createdBy: user.name || user.id,
                },
            });
        });

        revalidatePath(PATH);
        return { success: true, reference: created.reference, posted: !!created.journalEntryId };
    } catch (e: any) {
        return { success: false, error: e?.message || "Could not record transfer" };
    }
}

export async function updateTransferStatus(id: string, status: string) {
    try {
        const user = await currentUser();
        if (!user) return { success: false, error: "Unauthorized" };

        const allowed = ['PENDING', 'COMPLETED', 'FAILED', 'REVERSED'];
        if (!allowed.includes(status)) return { success: false, error: "Unknown status" };

        const existing = await prisma.transfer.findUnique({ where: { id } });
        if (!existing) return { success: false, error: "Transfer not found" };

        // Completing a previously pending transfer posts it to the ledger now.
        if (status === 'COMPLETED' && !existing.journalEntryId) {
            const plan = glPlan(existing.type, existing.fromBankAccountId, existing.toBankAccountId);
            if (plan) {
                await prisma.$transaction(async (tx) => {
                    const fromAcct = await resolveTransferLeg(tx as any, plan.from);
                    const toAcct = await resolveTransferLeg(tx as any, plan.to);
                    const entry = await postTransfer(tx as any, {
                        amount: num(existing.amount),
                        charges: num(existing.charges),
                        fromAccountId: fromAcct.id,
                        toAccountId: toAcct.id,
                        userId: user.id,
                        reference: existing.reference,
                        description: existing.narration || `Transfer ${existing.reference}`,
                    });
                    await tx.transfer.update({
                        where: { id },
                        data: { status, journalEntryId: entry.id },
                    });
                });
                revalidatePath(PATH);
                return { success: true };
            }
        }

        await prisma.transfer.update({ where: { id }, data: { status } });
        revalidatePath(PATH);
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e?.message || "Could not update transfer" };
    }
}

export async function deleteTransfer(id: string) {
    try {
        const user = await currentUser();
        if (!user) return { success: false, error: "Unauthorized" };
        if (!user.isAdmin) return { success: false, error: "Only System Admins can delete transfers" };

        const existing = await prisma.transfer.findUnique({ where: { id } });
        if (!existing) return { success: false, error: "Transfer not found" };
        if (existing.journalEntryId) {
            return {
                success: false,
                error: "This transfer is posted to the ledger — mark it Reversed instead of deleting it",
            };
        }

        await prisma.transfer.delete({ where: { id } });
        revalidatePath(PATH);
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e?.message || "Could not delete transfer" };
    }
}
