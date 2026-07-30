
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

// Journal entries are append-only — physical deletion is not permitted.
// Use POST { action: 'REVERSE', entryId, reason } to create a contra-entry.
