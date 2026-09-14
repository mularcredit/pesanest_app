"use server";

import prisma from "@/lib/prisma";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import { AccountingEngine } from "@/lib/accounting/accounting-engine";

export async function fulfillRequisition(formData: FormData) {
    const session = await auth();
    if (!session?.user?.id) throw new Error("Unauthorized");

    const requisitionId = formData.get("requisitionId") as string;
    const receiptUrl = formData.get("receiptUrl") as string;
    const notes = formData.get("notes") as string;
    const etrNumber = (formData.get("etrNumber") as string)?.trim().toUpperCase() || null;
    const etrVerified = formData.get("etrVerified") === "true";

    if (!requisitionId || !receiptUrl) {
        throw new Error("Expense ID and Receipt URL are required");
    }

    try {
        const requisition = await prisma.requisition.findUnique({
            where: { id: requisitionId }
        });

        if (!requisition) throw new Error("Expense not found");
        if (requisition.status !== 'APPROVED') throw new Error("Only approved requisitions can be fulfilled");

        await prisma.expense.create({
            data: {
                userId: session.user.id,
                requisitionId: requisitionId,
                title: `Fulfillment: ${requisition.title}`,
                description: notes || requisition.description,
                amount: requisition.amount,
                category: requisition.category,
                expenseDate: new Date(),
                receiptUrl: receiptUrl,
                etrNumber: etrNumber || null,
                etrVerified: etrVerified,
                etrVerifiedAt: etrVerified ? new Date() : null,
                status: 'APPROVED',
                paymentMethod: 'PERSONAL_CARD',
                isReimbursable: true
            }
        });

        await prisma.requisition.update({
            where: { id: requisitionId },
            data: { status: 'FULFILLED' }
        });

        revalidatePath("/dashboard/requisitions");
        revalidatePath("/dashboard/expenses");
        revalidatePath("/dashboard/payments");
        revalidatePath("/dashboard/approvals");

        return { success: true };
    } catch (e: any) {
        console.error(e);
        return { error: e.message };
    }
}

/**
 * Attach (or replace) the receipt on an expense itself.
 *
 * Deliberately separate from fulfillRequisition: that one is a workflow step
 * which spawns a child Expense and moves the requisition to FULFILLED. This
 * just files the paperwork against the expense and leaves the status alone,
 * so a receipt can be added at any point in the lifecycle.
 */
export async function attachRequisitionReceipt(formData: FormData) {
    const session = await auth();
    if (!session?.user?.id) return { success: false, message: "Unauthorized" };

    const requisitionId = formData.get("requisitionId") as string;
    const receiptUrl = (formData.get("receiptUrl") as string)?.trim();
    const etrNumber = (formData.get("etrNumber") as string)?.trim().toUpperCase() || null;
    const etrVerified = formData.get("etrVerified") === "true";

    if (!requisitionId || !receiptUrl) {
        return { success: false, message: "Expense and receipt are both required" };
    }

    try {
        const requisition = await prisma.requisition.findUnique({
            where: { id: requisitionId },
            select: { id: true, userId: true, receiptUrl: true },
        });
        if (!requisition) return { success: false, message: "Expense not found" };

        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: { role: true, customRole: { select: { isSystem: true } } },
        });
        const isAdmin = user?.role === 'SYSTEM_ADMIN' || !!user?.customRole?.isSystem;
        // Same set the detail page treats as privileged, so the button is never
        // shown to someone the action would then reject.
        const isPrivileged = ['SYSTEM_ADMIN', 'FINANCE_APPROVER', 'FINANCE_TEAM', 'MANAGER', 'TEAM_LEADER']
            .includes(user?.role || '');
        const isOwner = requisition.userId === session.user.id;

        if (!isOwner && !isAdmin && !isPrivileged) {
            return { success: false, message: "You can only attach receipts to your own expenses" };
        }

        const replaced = !!requisition.receiptUrl;

        await prisma.requisition.update({
            where: { id: requisitionId },
            data: {
                receiptUrl,
                ...(etrNumber
                    ? { etrNumber, etrVerified, etrVerifiedAt: etrVerified ? new Date() : null }
                    : {}),
            },
        });

        await (prisma as any).auditLog.create({
            data: {
                actorId: session.user.id,
                action: replaced ? 'RECEIPT_REPLACE' : 'RECEIPT_ATTACH',
                entity: 'Requisition',
                entityId: requisitionId,
                after: { receiptUrl, etrNumber },
            },
        }).catch(() => {});

        revalidatePath("/dashboard/requisitions");
        revalidatePath(`/dashboard/requisitions/${requisitionId}`);
        return {
            success: true,
            message: replaced ? "Receipt replaced" : "Receipt attached",
        };
    } catch (e: any) {
        console.error("Failed to attach receipt:", e);
        return { success: false, message: e.message || "Failed to attach receipt" };
    }
}

export async function deleteRequisition(id: string) {
    const session = await auth();
    if (!session?.user?.id) return { success: false, message: "Unauthorized" };

    try {
        const requisition = await prisma.requisition.findUnique({ where: { id } });
        if (!requisition) return { success: false, message: "Expense not found" };

        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: { role: true, customRole: { select: { isSystem: true } } }
        });

        const isAdmin = user?.role === 'SYSTEM_ADMIN' || user?.customRole?.isSystem;
        if (!isAdmin) {
            return { success: false, message: "Only Global Admin can delete requisitions" };
        }

        await (prisma as any).requisition.delete({ where: { id } });

        revalidatePath("/dashboard/requisitions");
        return { success: true, message: "Expense deleted successfully" };
    } catch (e: any) {
        console.error("Failed to delete requisition:", e);
        return { success: false, message: e.message || "Failed to delete" };
    }
}

export async function updateRequisition(formData: FormData) {
    const session = await auth();
    if (!session?.user?.id) return { success: false, message: "Unauthorized" };

    const id = formData.get("id") as string;
    const title = (formData.get("title") as string)?.trim();
    const description = (formData.get("description") as string)?.trim();
    const branch = (formData.get("branch") as string)?.trim();
    const department = (formData.get("department") as string)?.trim();
    const expectedDateStr = formData.get("expectedDate") as string;
    const amountStr = formData.get("amount") as string;
    const currency = (formData.get("currency") as string)?.trim();
    const category = (formData.get("category") as string)?.trim();
    const paymentMethod = (formData.get("paymentMethod") as string)?.trim();
    const paymentReference = (formData.get("paymentReference") as string)?.trim();

    if (!id) return { success: false, message: "Missing requisition ID" };
    if (!title || title.length < 5) return { success: false, message: "Title must be at least 5 characters" };
    if (!description || description.length < 10) return { success: false, message: "Justification must be at least 10 characters" };

    try {
        const requisition = await prisma.requisition.findUnique({ where: { id } });
        if (!requisition) return { success: false, message: "Expense not found" };

        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: { role: true, customRole: { select: { isSystem: true } } }
        });
        const isAdmin = user?.role === 'SYSTEM_ADMIN' || user?.role === 'ADMIN' || user?.customRole?.isSystem;

        if (!isAdmin && requisition.userId !== session.user.id) {
            return { success: false, message: "You can only edit your own requisitions" };
        }
        if (!isAdmin && !['PENDING', 'NEEDS_INFO', 'ADJUSTMENT_REQUIRED'].includes(requisition.status)) {
            return { success: false, message: `This requisition cannot be edited (status: ${requisition.status})` };
        }

        const expectedDate = expectedDateStr ? new Date(expectedDateStr) : null;
        const amount = amountStr ? parseFloat(amountStr) : undefined;

        const isResubmitting = requisition.status === 'ADJUSTMENT_REQUIRED';

        await (prisma as any).requisition.update({
            where: { id },
            data: {
                title,
                description,
                businessJustification: description,
                branch: branch || null,
                department: department || null,
                expectedDate: expectedDate,
                ...(amount !== undefined && !isNaN(amount) ? { amount } : {}),
                ...(currency ? { currency } : {}),
                ...(category ? { category } : {}),
                ...(paymentMethod ? { paymentMethod } : {}),
                ...(paymentReference ? { paymentReference } : {}),
                // Reset status to PENDING so it re-enters the approval queue
                ...(isResubmitting ? { status: 'PENDING' } : {}),
            }
        });

        // If it was an adjustment (or is already pending but has stuck adjustment approvals), 
        // reset the approval records so they show up in the queue again.
        if (requisition.status === 'ADJUSTMENT_REQUIRED' || requisition.status === 'PENDING') {
            await prisma.approval.updateMany({
                where: { 
                    requisitionId: id,
                    status: 'ADJUSTMENT'
                },
                data: {
                    status: 'PENDING'
                }
            });
        }

        revalidatePath("/dashboard/requisitions");
        revalidatePath("/dashboard/approvals");
        return { success: true, message: "Expense updated and resubmitted for approval" };
    } catch (e: any) {
        console.error("Failed to update requisition:", e);
        return { success: false, message: e.message || "Failed to update" };
    }
}

/**
 * Moves an already-categorized (or already-posted) requisition to a different
 * GL account. If the requisition has already been paid — i.e. it has a live
 * posted journal entry — this posts a correcting reclass entry (debit the new
 * account, credit the old one) rather than editing history, so the ledger
 * stays append-only. Otherwise it just updates the account the requisition
 * will post to once paid.
 */
export async function reclassifyRequisitionAccount(requisitionId: string, newAccountId: string) {
    const session = await auth();
    if (!session?.user?.id) return { success: false, message: "Unauthorized" };

    const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { role: true, customRole: { select: { isSystem: true } } }
    });
    const isAdmin = user?.role === 'SYSTEM_ADMIN' || user?.customRole?.isSystem;
    if (!isAdmin) {
        return { success: false, message: "Only System Admins can move an expense to a different account" };
    }

    const requisition = await prisma.requisition.findUnique({ where: { id: requisitionId } });
    if (!requisition) return { success: false, message: "Expense not found" };

    const newAccount = await prisma.account.findUnique({ where: { id: newAccountId } });
    if (!newAccount) return { success: false, message: "Target account not found" };

    if ((requisition as any).accountId === newAccountId) {
        return { success: false, message: `This expense is already posted to ${newAccount.code} ${newAccount.name}` };
    }

    // If it's already been paid, there's a live journal entry debiting some
    // expense account — find it so we know what to reclass out of.
    const activeEntry = await (prisma as any).journalEntry.findFirst({
        where: { requisitionId, status: 'POSTED', reversalOfId: null },
        include: { lines: { include: { account: true } } },
        orderBy: { createdAt: 'desc' },
    });

    let oldAccountLabel = (requisition as any).accountId ? "its current account" : (requisition.category || "Uncategorized");

    if (activeEntry) {
        const expenseLine = activeEntry.lines.find((l: any) => l.debit > 0 && l.account.type === 'EXPENSE');
        if (!expenseLine) {
            return { success: false, message: "Couldn't find the expense side of this entry — it will need a manual journal reclass instead" };
        }
        const oldAccount = expenseLine.account;
        oldAccountLabel = `${oldAccount.code} ${oldAccount.name}`;

        if (oldAccount.id === newAccountId) {
            return { success: false, message: `This expense is already posted to ${newAccount.code} ${newAccount.name}` };
        }

        try {
            await AccountingEngine.postJournalEntry({
                date: new Date(),
                description: `Reclass: ${requisition.title} moved from ${oldAccount.code} ${oldAccount.name} to ${newAccount.code} ${newAccount.name}`,
                reference: `RECLASS-${requisitionId.slice(0, 8)}`,
                source: { requisitionId },
                userId: session.user.id,
                lines: [
                    { accountId: newAccount.id, debit: expenseLine.debit, credit: 0, description: `Reclass in: ${requisition.title}` },
                    { accountId: oldAccount.id, debit: 0, credit: expenseLine.debit, description: `Reclass out: ${requisition.title}` },
                ],
            });
        } catch (e: any) {
            return { success: false, message: e.message || "Failed to post the reclassification entry" };
        }
    }

    // The account-scoped list page matches a requisition to an account by
    // EITHER accountId or category name equal to the account's name — update
    // both, or this would keep showing up under the old account's list too.
    await (prisma as any).requisition.update({
        where: { id: requisitionId },
        data: { accountId: newAccountId, category: newAccount.name },
    });

    await (prisma as any).auditLog.create({
        data: {
            actorId: session.user.id,
            action: 'REQUISITION_RECLASSIFY',
            entity: 'Requisition',
            entityId: requisitionId,
            before: { account: oldAccountLabel },
            after: { account: `${newAccount.code} ${newAccount.name}` },
        },
    }).catch(() => {});

    revalidatePath("/dashboard/requisitions");
    revalidatePath(`/dashboard/requisitions/${requisitionId}`);

    return {
        success: true,
        message: activeEntry
            ? `Moved to ${newAccount.code} ${newAccount.name} — a reclassification entry was posted`
            : `Moved to ${newAccount.code} ${newAccount.name}`,
    };
}

const COST_OF_SALES_SUB_ACCOUNTS = ['Wifi Equipment', 'Starlink', 'Software and Subscriptions'];

async function nextAccountCode(): Promise<string> {
    const accounts = await prisma.account.findMany({ select: { code: true } });
    const maxCode = accounts.reduce((max, a) => {
        const n = parseInt(a.code, 10);
        return !isNaN(n) && n > max ? n : max;
    }, 0);
    return String(maxCode + 1);
}

/**
 * Returns the Cost of Sales account and its sub-accounts (Wifi Equipment,
 * Starlink), creating any that are missing. These are the quick-pick targets
 * for the "Move to account" action. All share subtype COST_OF_SALES, which is
 * what the P&L's own lookup groups by (see income-statement report) — the
 * parent/child link is only for chart-of-accounts display, not required for
 * them to roll up into Cost of Sales.
 */
export async function getCostOfSalesAccounts() {
    let parent = await prisma.account.findFirst({ where: { type: 'EXPENSE', subtype: 'COST_OF_SALES', parentId: null } });
    if (!parent) {
        parent = await prisma.account.create({
            data: {
                code: await nextAccountCode(),
                name: 'Cost of Sales',
                type: 'EXPENSE',
                subtype: 'COST_OF_SALES',
                description: 'Direct costs attributable to goods or services sold',
            },
        });
    }

    const children = await prisma.account.findMany({ where: { parentId: parent.id }, orderBy: { code: 'asc' } });
    for (const name of COST_OF_SALES_SUB_ACCOUNTS) {
        if (children.some(c => c.name.toLowerCase() === name.toLowerCase())) continue;
        const created = await prisma.account.create({
            data: {
                code: await nextAccountCode(),
                name,
                type: 'EXPENSE',
                subtype: 'COST_OF_SALES',
                parentId: parent.id,
            },
        });
        children.push(created);
    }

    return { parent, children: children.sort((a, b) => a.code.localeCompare(b.code)) };
}

export async function createItemPaymentBatch(itemId: string) {
    const session = await auth();
    if (!session?.user?.id) return { success: false, message: "Unauthorized" };

    try {
        // Only privileged roles can initiate payment
        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: { role: true, customRole: { select: { isSystem: true } } }
        });

        const isPrivileged = [
            'SYSTEM_ADMIN', 'FINANCE_APPROVER', 'FINANCE_TEAM', 'MANAGER', 'TEAM_LEADER'
        ].includes(user?.role || '') || user?.customRole?.isSystem;

        if (!isPrivileged) {
            return { success: false, message: "Only finance/admin roles can initiate item payments" };
        }

        // Fetch the item and its parent requisition
        const item = await (prisma as any).requisitionItem.findUnique({
            where: { id: itemId },
            include: { requisition: true }
        });

        if (!item) return { success: false, message: "Item not found" };
        if (item.status !== 'APPROVED' && item.status !== 'PENDING') {
            return { success: false, message: `Item cannot be paid (current status: ${item.status})` };
        }

        const req = item.requisition;
        const itemTotal = item.quantity * item.unitPrice;

        // Create a Payment record linked to the parent requisition
        // Amount = this specific item's total only
        const payment = await prisma.payment.create({
            data: {
                amount: itemTotal,
                currency: req.currency || 'KES',
                status: 'PENDING_AUTHORIZATION',
                makerId: session.user.id,
                method: 'BANK_TRANSFER',
                notes: `Item payment: "${item.title}" (Item ID: ${item.id.slice(0, 8)}) from requisition: ${req.title}`,
                requisitions: {
                    connect: { id: req.id }
                }
            }
        });

        revalidatePath("/dashboard/payments");
        revalidatePath("/dashboard/requisitions");

        return { success: true, paymentId: payment.id, message: "Payment batch created for item" };
    } catch (e: any) {
        console.error("Failed to create item payment batch:", e);
        return { success: false, message: e.message || "Failed to create payment" };
    }
}
