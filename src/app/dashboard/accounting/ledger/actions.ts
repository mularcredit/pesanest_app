"use server";

import prisma from "@/lib/prisma";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import { AccountingEngine } from "@/lib/accounting/accounting-engine";

/**
 * Same "Move to Account" correction as reclassifyRequisitionAccount, but for
 * any posted journal entry directly — not just ones tied to a requisition.
 * Entries created straight from Manual Journal Entry (no requisitionId) had
 * no safe way to be reclassified before this; the only options were editing
 * the posted entry in place (no audit trail) or fixing it by hand.
 */
export async function reclassifyJournalEntryAccount(entryId: string, newAccountId: string) {
    const session = await auth();
    if (!session?.user?.id) return { success: false, message: "Unauthorized" };

    const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { role: true, customRole: { select: { isSystem: true } } }
    });
    const isAdmin = user?.role === 'SYSTEM_ADMIN' || user?.customRole?.isSystem;
    if (!isAdmin) {
        return { success: false, message: "Only System Admins can move an entry to a different account" };
    }

    const entry = await (prisma as any).journalEntry.findUnique({
        where: { id: entryId },
        include: { lines: { include: { account: true } } },
    });
    if (!entry) return { success: false, message: "Journal entry not found" };
    if (entry.status !== 'POSTED') return { success: false, message: "Only posted entries can be reclassified" };

    const newAccount = await prisma.account.findUnique({ where: { id: newAccountId } });
    if (!newAccount) return { success: false, message: "Target account not found" };

    const expenseLine = entry.lines.find((l: any) => l.debit > 0 && (l.account.type === 'EXPENSE' || l.account.type === 'OTHER_EXPENSE'));
    if (!expenseLine) {
        return { success: false, message: "Couldn't find the expense side of this entry — it will need a manual journal reclass instead" };
    }
    const oldAccount = expenseLine.account;

    if (oldAccount.id === newAccountId) {
        return { success: false, message: `This entry is already posted to ${newAccount.code} ${newAccount.name}` };
    }

    try {
        await AccountingEngine.postJournalEntry({
            // Same date as the original entry — a reclass changes which
            // account it sits in, not when it happened.
            date: entry.date,
            description: `Reclass: ${entry.description} moved from ${oldAccount.code} ${oldAccount.name} to ${newAccount.code} ${newAccount.name}`,
            reference: `RECLASS-${entryId.slice(0, 8)}`,
            source: {},
            userId: session.user.id,
            lines: [
                { accountId: newAccount.id, debit: expenseLine.debit, credit: 0, description: `Reclass in: ${entry.description}` },
                { accountId: oldAccount.id, debit: 0, credit: expenseLine.debit, description: `Reclass out: ${entry.description}` },
            ],
        });
    } catch (e: any) {
        return { success: false, message: e.message || "Failed to post the reclassification entry" };
    }

    await (prisma as any).auditLog.create({
        data: {
            actorId: session.user.id,
            action: 'JOURNAL_ENTRY_RECLASSIFY',
            entity: 'JournalEntry',
            entityId: entryId,
            before: { account: `${oldAccount.code} ${oldAccount.name}` },
            after: { account: `${newAccount.code} ${newAccount.name}` },
        },
    }).catch(() => {});

    revalidatePath("/dashboard/accounting/ledger");

    return {
        success: true,
        message: `Moved to ${newAccount.code} ${newAccount.name} — a reclassification entry was posted`,
    };
}
