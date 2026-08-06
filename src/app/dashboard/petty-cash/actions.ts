"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import {
    postPettyCashReplenish,
    postPettyCashSpend,
    postPettyCashAdjustment,
    assertPostingAllowed,
    GL_CODES,
} from "@/lib/accounting/cash-movement-gl";

const PATH = "/dashboard/petty-cash";

const num = (v: any) => (v == null ? 0 : Number(v));

async function currentUser() {
    const session = await auth();
    if (!session?.user?.id) return null;
    const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { id: true, name: true, role: true, customRole: { select: { isSystem: true } } },
    });
    if (!user) return null;
    return {
        ...user,
        isAdmin: user.role === "SYSTEM_ADMIN" || !!user.customRole?.isSystem,
    };
}

async function nextVoucherNumber() {
    const seq = await (prisma as any).documentSequence.upsert({
        where: { prefix: "PCV" },
        update: { lastNumber: { increment: 1 } },
        create: { prefix: "PCV", lastNumber: 1 },
    });
    return `PCV-${String(seq.lastNumber).padStart(5, "0")}`;
}

/**
 * The petty cash float is a singleton per install — fetched or created on first
 * use, and linked to the "Petty Cash" GL account (1010) that ships in the seed.
 */
export async function getPettyCashWallet() {
    let wallet = await prisma.pettyCashWallet.findFirst({
        where: { isActive: true },
        orderBy: { createdAt: "asc" },
    });

    if (!wallet) {
        let gl = await prisma.account.findFirst({ where: { code: GL_CODES.PETTY_CASH } });
        if (!gl) {
            gl = await prisma.account.create({
                data: {
                    code: GL_CODES.PETTY_CASH,
                    name: "Petty Cash",
                    type: "ASSET",
                    subtype: "CURRENT_ASSET",
                },
            });
        }
        // The page loads several of these actions in parallel, so two callers can
        // race to create the float. glAccountId is unique — losing the race means
        // the row already exists, so read it back instead of failing the page.
        try {
            wallet = await prisma.pettyCashWallet.create({
                data: { name: "Petty Cash", glAccountId: gl.id },
            });
        } catch {
            wallet = await prisma.pettyCashWallet.findFirst({
                where: { isActive: true },
                orderBy: { createdAt: "asc" },
            });
            if (!wallet) throw new Error("Could not initialise the petty cash float");
        }
    }

    return {
        id: wallet.id,
        name: wallet.name,
        balance: num(wallet.balance),
        floatLimit: num(wallet.floatLimit),
        currency: wallet.currency,
        glAccountId: wallet.glAccountId,
    };
}

export async function getPettyCashLedger(limit = 200) {
    const wallet = await getPettyCashWallet();
    const rows = await prisma.pettyCashTransaction.findMany({
        where: { walletId: wallet.id },
        orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
        take: limit,
    });

    const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();

    return rows.map((t) => ({
        id: t.id,
        type: t.type,
        amount: num(t.amount),
        balanceAfter: num(t.balanceAfter),
        description: t.description,
        voucherNumber: t.voucherNumber,
        reference: t.reference,
        occurredAt: t.occurredAt.toISOString(),
        createdAt: t.createdAt.toISOString(),
        createdBy: t.createdBy,
        // Entered after the fact, so the running balance for this row reflects
        // the float when it was keyed in, not on the date shown.
        isBackdated: !sameDay(t.occurredAt, t.createdAt) && t.occurredAt < t.createdAt,
    }));
}

export async function getPettyCashStats() {
    const wallet = await getPettyCashWallet();
    const rows = await prisma.pettyCashTransaction.findMany({
        where: { walletId: wallet.id },
        select: { type: true, amount: true, occurredAt: true },
    });

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    // Counted by when the money moved, so a backdated entry lands in the month
    // it belongs to rather than the month it was typed in.
    const spentThisMonth = rows
        .filter((r) => r.type === "EXPENSE" && r.occurredAt >= monthStart)
        .reduce((s, r) => s + num(r.amount), 0);
    const replenishedThisMonth = rows
        .filter((r) => r.type === "REPLENISH" && r.occurredAt >= monthStart)
        .reduce((s, r) => s + num(r.amount), 0);

    const utilisation =
        wallet.floatLimit > 0
            ? Math.min(100, Math.round(((wallet.floatLimit - wallet.balance) / wallet.floatLimit) * 100))
            : 0;

    return {
        balance: wallet.balance,
        floatLimit: wallet.floatLimit,
        currency: wallet.currency,
        spentThisMonth,
        replenishedThisMonth,
        utilisation,
        txCount: rows.length,
        lowFloat: wallet.floatLimit > 0 && wallet.balance < wallet.floatLimit * 0.2,
    };
}

/** Cash/bank accounts a replenishment can be drawn from. */
export async function getFundingSources() {
    const banks = await prisma.bankAccount.findMany({
        where: { isActive: true },
        select: { id: true, name: true, bankName: true, glAccountId: true },
        orderBy: { name: "asc" },
    });

    const cashAccounts = await prisma.account.findMany({
        where: {
            isActive: true,
            isArchived: false,
            type: "ASSET",
            code: { in: [GL_CODES.CASH_ON_HAND, "1001", "1020"] },
        },
        select: { id: true, code: true, name: true },
    });

    return [
        ...banks.map((b) => ({
            glAccountId: b.glAccountId,
            label: `${b.name} — ${b.bankName}`,
        })),
        ...cashAccounts.map((a) => ({
            glAccountId: a.id,
            label: `${a.name} (${a.code})`,
        })),
    ];
}

/** Expense accounts a petty cash payout can be coded to. */
export async function getExpenseAccounts() {
    const accounts = await prisma.account.findMany({
        where: { type: "EXPENSE", isActive: true, isArchived: false },
        select: { id: true, code: true, name: true },
        orderBy: { code: "asc" },
    });
    return accounts.map((a) => ({ id: a.id, label: `${a.code} — ${a.name}` }));
}

/** Expenses the requester marked as payable from petty cash. */
export async function getPettyCashExpenses() {
    const rows = await prisma.requisition.findMany({
        where: { paymentMethod: "PETTY_CASH" },
        orderBy: { createdAt: "desc" },
        take: 50,
        select: {
            id: true,
            title: true,
            amount: true,
            status: true,
            createdAt: true,
            paymentReference: true,
            user: { select: { name: true } },
        },
    });

    const settled = await prisma.pettyCashTransaction.findMany({
        where: { requisitionId: { in: rows.map((r) => r.id) } },
        select: { requisitionId: true },
    });
    const settledIds = new Set(settled.map((s) => s.requisitionId));

    return rows.map((r) => ({
        id: r.id,
        title: r.title,
        amount: num(r.amount),
        status: r.status,
        requester: r.user?.name || "—",
        voucherNumber: r.paymentReference,
        createdAt: r.createdAt.toISOString(),
        isSettled: settledIds.has(r.id),
    }));
}

export async function setFloatLimit(formData: FormData) {
    try {
        const user = await currentUser();
        if (!user) return { success: false, error: "Unauthorized" };
        if (!user.isAdmin) return { success: false, error: "Only System Admins can change the float limit" };

        const limit = Number(formData.get("floatLimit"));
        if (!Number.isFinite(limit) || limit < 0) return { success: false, error: "Enter a valid float limit" };

        const wallet = await getPettyCashWallet();
        await prisma.pettyCashWallet.update({
            where: { id: wallet.id },
            data: { floatLimit: limit },
        });

        revalidatePath(PATH);
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e?.message || "Could not update float limit" };
    }
}

/**
 * Parse a yyyy-mm-dd from a date input into a local-noon Date.
 *
 * Noon rather than midnight so a shift into UTC can't roll the entry onto the
 * previous day and land it in the wrong accounting period.
 */
function parseMovementDate(raw: string | null): { date: Date } | { error: string } {
    if (!raw || !raw.trim()) return { date: new Date() };

    const match = raw.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return { error: "Enter the date as YYYY-MM-DD" };

    const [, y, m, d] = match;
    const date = new Date(Number(y), Number(m) - 1, Number(d), 12, 0, 0, 0);
    if (Number.isNaN(date.getTime()) || date.getMonth() !== Number(m) - 1) {
        return { error: "That date doesn't exist" };
    }

    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);
    if (date > endOfToday) return { error: "The date can't be in the future" };

    if (date.getFullYear() < 2000) return { error: "That date is too far in the past" };

    return { date };
}

export async function replenishPettyCash(formData: FormData) {
    try {
        const user = await currentUser();
        if (!user) return { success: false, error: "Unauthorized" };

        const amount = Number(formData.get("amount"));
        if (!Number.isFinite(amount) || amount <= 0) return { success: false, error: "Enter a valid amount" };

        const parsed = parseMovementDate(formData.get("occurredAt") as string | null);
        if ("error" in parsed) return { success: false, error: parsed.error };
        const occurredAt = parsed.date;

        const fundingGlAccountId = (formData.get("fundingGlAccountId") as string) || null;
        const note = ((formData.get("description") as string) || "").trim();
        const wallet = await getPettyCashWallet();
        const voucher = await nextVoucherNumber();
        const description = note || `Petty cash replenishment — ${wallet.currency} ${amount.toLocaleString()}`;

        await prisma.$transaction(async (tx) => {
            await assertPostingAllowed(tx as any, occurredAt);

            const entry = await postPettyCashReplenish(tx as any, {
                amount,
                pettyCashGlAccountId: wallet.glAccountId,
                fundingGlAccountId,
                userId: user.id,
                reference: voucher,
                description,
                date: occurredAt,
            });

            const updated = await tx.pettyCashWallet.update({
                where: { id: wallet.id },
                data: { balance: { increment: amount } },
            });

            await tx.pettyCashTransaction.create({
                data: {
                    walletId: wallet.id,
                    type: "REPLENISH",
                    amount,
                    balanceAfter: updated.balance,
                    description,
                    voucherNumber: voucher,
                    journalEntryId: entry.id,
                    createdBy: user.name || user.id,
                    occurredAt,
                },
            });
        });

        revalidatePath(PATH);
        return { success: true, voucher };
    } catch (e: any) {
        return { success: false, error: e?.message || "Could not record replenishment" };
    }
}

export async function recordPettyCashSpend(formData: FormData) {
    try {
        const user = await currentUser();
        if (!user) return { success: false, error: "Unauthorized" };

        const amount = Number(formData.get("amount"));
        if (!Number.isFinite(amount) || amount <= 0) return { success: false, error: "Enter a valid amount" };

        const description = ((formData.get("description") as string) || "").trim();
        if (!description) return { success: false, error: "Describe what the cash was spent on" };

        const expenseGlAccountId = (formData.get("expenseGlAccountId") as string) || null;
        const requisitionId = ((formData.get("requisitionId") as string) || "").trim() || null;

        const wallet = await getPettyCashWallet();
        if (amount > wallet.balance) {
            return {
                success: false,
                error: `Only ${wallet.currency} ${wallet.balance.toLocaleString()} left in the float`,
            };
        }

        const voucher = await nextVoucherNumber();

        await prisma.$transaction(async (tx) => {
            const entry = await postPettyCashSpend(tx as any, {
                amount,
                expenseGlAccountId,
                pettyCashGlAccountId: wallet.glAccountId,
                userId: user.id,
                reference: voucher,
                description,
            });

            const updated = await tx.pettyCashWallet.update({
                where: { id: wallet.id },
                data: { balance: { decrement: amount } },
            });

            await tx.pettyCashTransaction.create({
                data: {
                    walletId: wallet.id,
                    type: "EXPENSE",
                    amount,
                    balanceAfter: updated.balance,
                    description,
                    voucherNumber: voucher,
                    requisitionId,
                    journalEntryId: entry.id,
                    createdBy: user.name || user.id,
                },
            });

            // Stamp the voucher on the expense, but never overwrite a reference
            // the requester already entered themselves.
            if (requisitionId) {
                const req = await tx.requisition.findUnique({
                    where: { id: requisitionId },
                    select: { paymentReference: true },
                });
                if (!req?.paymentReference?.trim()) {
                    await tx.requisition.update({
                        where: { id: requisitionId },
                        data: { paymentReference: voucher },
                    });
                }
            }
        });

        revalidatePath(PATH);
        revalidatePath("/dashboard/requisitions");
        return { success: true, voucher };
    } catch (e: any) {
        return { success: false, error: e?.message || "Could not record payout" };
    }
}

/**
 * Reconciliation: the custodian counts the tin and enters what is actually
 * there. The difference is posted to Cash Over & Short.
 */
export async function reconcilePettyCash(formData: FormData) {
    try {
        const user = await currentUser();
        if (!user) return { success: false, error: "Unauthorized" };

        const counted = Number(formData.get("countedAmount"));
        if (!Number.isFinite(counted) || counted < 0) return { success: false, error: "Enter the amount counted" };

        const wallet = await getPettyCashWallet();
        const delta = Number((counted - wallet.balance).toFixed(2));
        if (delta === 0) return { success: false, error: "Counted amount already matches the ledger" };

        const note = ((formData.get("description") as string) || "").trim();
        const voucher = await nextVoucherNumber();
        const description =
            note ||
            `Petty cash count adjustment — ${delta < 0 ? "shortage" : "overage"} of ${wallet.currency} ${Math.abs(delta).toLocaleString()}`;

        await prisma.$transaction(async (tx) => {
            const entry = await postPettyCashAdjustment(tx as any, {
                delta,
                pettyCashGlAccountId: wallet.glAccountId,
                userId: user.id,
                reference: voucher,
                description,
            });

            const updated = await tx.pettyCashWallet.update({
                where: { id: wallet.id },
                data: { balance: counted },
            });

            await tx.pettyCashTransaction.create({
                data: {
                    walletId: wallet.id,
                    type: "ADJUSTMENT",
                    amount: Math.abs(delta),
                    balanceAfter: updated.balance,
                    description,
                    voucherNumber: voucher,
                    journalEntryId: entry.id,
                    createdBy: user.name || user.id,
                },
            });
        });

        revalidatePath(PATH);
        return { success: true, voucher, delta };
    } catch (e: any) {
        return { success: false, error: e?.message || "Could not reconcile float" };
    }
}
