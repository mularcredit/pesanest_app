
import { auth } from "@/auth";
import { AccountingEngine } from "@/lib/accounting/accounting-engine";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function POST(req: Request) {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();

    // Manual journal reversal: POST with { action: 'REVERSE', entryId, reason }
    if (body.action === 'REVERSE') {
        const { entryId, reason } = body;
        if (!entryId || !reason?.trim()) {
            return NextResponse.json({ error: "entryId and reason are required" }, { status: 400 });
        }

        // Only admins may reverse posted entries
        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: { role: true, customRole: { select: { isSystem: true } } }
        });
        const isAdmin = user?.role === 'SYSTEM_ADMIN' || user?.customRole?.isSystem;
        if (!isAdmin) {
            return NextResponse.json({ error: "Only System Admins can reverse journal entries" }, { status: 403 });
        }

        try {
            const reversal = await AccountingEngine.createReversal(entryId, session.user.id!, reason);
            return NextResponse.json(reversal);
        } catch (error: any) {
            return NextResponse.json({ error: error.message }, { status: 400 });
        }
    }

    // Void a posted entry: POST with { action: 'VOID', entryId, reason }
    if (body.action === 'VOID') {
        const { entryId, reason } = body;
        if (!entryId || !reason?.trim()) {
            return NextResponse.json({ error: "entryId and reason are required" }, { status: 400 });
        }

        // Only admins may void posted entries
        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: { role: true, customRole: { select: { isSystem: true } } }
        });
        const isAdmin = user?.role === 'SYSTEM_ADMIN' || user?.customRole?.isSystem;
        if (!isAdmin) {
            return NextResponse.json({ error: "Only System Admins can void journal entries" }, { status: 403 });
        }

        try {
            const reversal = await AccountingEngine.voidJournalEntry(entryId, session.user.id!, reason);
            return NextResponse.json(reversal);
        } catch (error: any) {
            return NextResponse.json({ error: error.message }, { status: 400 });
        }
    }

    // Manual journal entry creation
    try {
        const lines = body.lines;
        const asDraft = body.status === 'DRAFT';
        const entryDate = new Date(body.date);
        const now = new Date();
        const isBackdated = entryDate < new Date(now.getFullYear(), now.getMonth(), now.getDate());

        if (asDraft) {
            // Validate balance before saving as draft
            const totalDebit = lines.reduce((s: number, l: any) => s + Number(l.debit || 0), 0);
            const totalCredit = lines.reduce((s: number, l: any) => s + Number(l.credit || 0), 0);
            if (Math.abs(totalDebit - totalCredit) > 0.001) {
                return NextResponse.json({ error: `Journal does not balance: debits ${totalDebit} ≠ credits ${totalCredit}` }, { status: 400 });
            }

            const draft = await prisma.journalEntry.create({
                data: {
                    date: entryDate,
                    description: body.description,
                    reference: body.reference || null,
                    status: 'DRAFT',
                    createdBy: session.user.id,
                    isBackdated,
                    lines: {
                        create: lines.map((l: any) => ({
                            accountId: l.accountId,
                            description: l.description || null,
                            debit: Number(l.debit || 0),
                            credit: Number(l.credit || 0)
                        }))
                    }
                } as any,
                include: { lines: true }
            });

            return NextResponse.json(draft, { status: 201 });
        }

        const entry = await AccountingEngine.postJournalEntry({
            date: entryDate,
            description: body.description,
            reference: body.reference,
            createdBy: session.user.id,
            lines,
            isBackdated
        } as any);

        return NextResponse.json(entry);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// Posted/void journal entries are append-only — physical deletion is not permitted.
// Use POST { action: 'REVERSE' | 'VOID', entryId, reason } to correct one instead.

// Edit a DRAFT entry in place: PATCH { entryId, date, description, reference, lines }
export async function PATCH(req: Request) {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { entryId, date, description, reference, lines } = body;
    if (!entryId) return NextResponse.json({ error: "entryId is required" }, { status: 400 });
    if (!Array.isArray(lines) || lines.length < 2) {
        return NextResponse.json({ error: "At least 2 lines are required" }, { status: 400 });
    }

    const existing = await prisma.journalEntry.findUnique({ where: { id: entryId } });
    if (!existing) return NextResponse.json({ error: "Entry not found" }, { status: 404 });

    // Only the entry's creator or an admin may edit a draft
    const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { role: true, customRole: { select: { isSystem: true } } }
    });
    const isAdmin = user?.role === 'SYSTEM_ADMIN' || user?.customRole?.isSystem;
    if (!isAdmin && existing.createdBy !== session.user.id) {
        return NextResponse.json({ error: "You can only edit drafts you created" }, { status: 403 });
    }

    try {
        const updated = await AccountingEngine.updateDraftEntry(entryId, {
            date: new Date(date),
            description,
            reference: reference || undefined,
            lines: lines.map((l: any) => ({
                accountId: l.accountId,
                debit: Number(l.debit || 0),
                credit: Number(l.credit || 0),
            })),
        });
        return NextResponse.json(updated);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 400 });
    }
}
