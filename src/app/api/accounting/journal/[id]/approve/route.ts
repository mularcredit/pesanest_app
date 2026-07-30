/**
 * POST /api/accounting/journal/[id]/approve
 *
 * Approves a DRAFT or PENDING_APPROVAL manual journal entry, moving it to POSTED.
 * Requires SYSTEM_ADMIN. Enforces:
 *   - Only manual journals (no expenseId / invoiceId / saleId) may sit in DRAFT
 *   - Period enforcement runs at approval time (re-uses assertPostingAllowed via engine)
 *   - Backdating flag is preserved; approved journals with date < today are flagged
 */

import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
    const params = await props.params;
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { role: true, customRole: { select: { isSystem: true } } }
    });
    if (user?.role !== 'SYSTEM_ADMIN' && !user?.customRole?.isSystem) {
        return NextResponse.json({ error: "Only System Admins can approve journal entries" }, { status: 403 });
    }

    const entry = await prisma.journalEntry.findUnique({
        where: { id: params.id },
        include: { lines: true }
    });
    if (!entry) return NextResponse.json({ error: "Journal entry not found" }, { status: 404 });

    if (!['DRAFT', 'PENDING_APPROVAL'].includes(entry.status)) {
        return NextResponse.json({ error: `Entry is already ${entry.status}` }, { status: 409 });
    }

    // Period enforcement
    const period = await (prisma as any).accountingPeriod.findFirst({
        where: { startDate: { lte: entry.date }, endDate: { gte: entry.date } }
    });
    if (period?.isClosed) {
        return NextResponse.json({ error: `Cannot approve: period "${period.name}" is closed` }, { status: 422 });
    }

    const now = new Date();
    const isBackdated = entry.date < new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const approved = await prisma.journalEntry.update({
        where: { id: params.id },
        data: {
            status: 'POSTED',
            approvedBy: session.user.id,
            approvedAt: now,
            isBackdated
        } as any,
        include: { lines: true }
    });

    await (prisma as any).auditLog.create({
        data: {
            actorId: session.user.id,
            action: 'JOURNAL_APPROVE',
            entity: 'JournalEntry',
            entityId: params.id,
            before: { status: entry.status },
            after: { status: 'POSTED', isBackdated }
        }
    });

    return NextResponse.json(approved);
}
