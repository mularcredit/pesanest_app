/**
 * Reconciliation API for a bank account.
 *
 * GET  /api/accounting/bank-accounts/[id]/reconciliation
 *   Returns unmatched statement lines and unmatched GL journal lines for
 *   the bank account's GL account, grouped for side-by-side matching.
 *
 * POST /api/accounting/bank-accounts/[id]/reconciliation
 *   body: { action: 'MATCH', statementLineId, journalEntryId, matchType, notes? }
 *     Persists a ReconciliationMatch and marks the statementLine as matched.
 *
 *   body: { action: 'AUTO_MATCH' }
 *     Iterates all unmatched statement lines and attempts to find a unique
 *     GL journal line with the same net amount (debit–credit) and a date
 *     within ±3 days.
 *
 *   body: { action: 'UNMATCH', statementLineId }
 *     Deletes the ReconciliationMatch and marks the line unmatched.
 */

import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";

async function requireAdmin(session: any) {
    if (!session?.user?.id) return false;
    const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { role: true, customRole: { select: { isSystem: true } } }
    });
    return user?.role === 'SYSTEM_ADMIN' || user?.customRole?.isSystem;
}

export async function GET(req: Request, props: { params: Promise<{ id: string }> }) {
    const params = await props.params;
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const bankAccount = await (prisma as any).bankAccount.findUnique({
        where: { id: params.id },
        select: { id: true, name: true, glAccountId: true }
    });
    if (!bankAccount) return NextResponse.json({ error: "Bank account not found" }, { status: 404 });

    const { searchParams } = new URL(req.url);
    const statementId = searchParams.get('statementId');

    // Fetch unmatched statement lines
    const lineFilter: any = {
        isMatched: false,
        statement: { bankAccountId: params.id }
    };
    if (statementId) lineFilter.statementId = statementId;

    const unmatchedLines = await (prisma as any).bankStatementLine.findMany({
        where: lineFilter,
        include: { statement: { select: { periodStart: true, periodEnd: true } } },
        orderBy: { transactionDate: 'asc' }
    });

    // Fetch GL journal lines on this bank account's GL account that have no ReconciliationMatch
    const glLines = await prisma.journalLine.findMany({
        where: {
            accountId: bankAccount.glAccountId,
            entry: { status: 'POSTED' }
        },
        include: {
            entry: {
                select: {
                    id: true,
                    entryNumber: true,
                    date: true,
                    description: true,
                    reference: true
                }
            }
        },
        orderBy: { entry: { date: 'asc' } }
    });

    // Filter out GL lines whose entryId already has a ReconciliationMatch
    const matchedEntryIds = new Set(
        (await (prisma as any).reconciliationMatch.findMany({
            select: { journalEntryId: true }
        })).map((m: any) => m.journalEntryId)
    );

    const unmatchedGlLines = glLines.filter(l => !matchedEntryIds.has(l.entryId));

    return NextResponse.json({
        bankAccount,
        unmatchedStatementLines: unmatchedLines,
        unmatchedGlLines: unmatchedGlLines.map(l => ({
            id: l.id,
            entryId: l.entryId,
            entryNumber: (l.entry as any).entryNumber,
            date: (l.entry as any).date,
            description: (l.entry as any).description,
            reference: (l.entry as any).reference,
            debit: l.debit,
            credit: l.credit,
            net: l.debit - l.credit
        }))
    });
}

export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
    const params = await props.params;
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await requireAdmin(session))) {
        return NextResponse.json({ error: "Only System Admins can perform reconciliation" }, { status: 403 });
    }

    const bankAccount = await (prisma as any).bankAccount.findUnique({
        where: { id: params.id },
        select: { id: true, glAccountId: true }
    });
    if (!bankAccount) return NextResponse.json({ error: "Bank account not found" }, { status: 404 });

    const body = await req.json();
    const { action } = body;

    if (action === 'MATCH') {
        const { statementLineId, journalEntryId, matchType, notes } = body;
        if (!statementLineId || !journalEntryId || !matchType) {
            return NextResponse.json({ error: "statementLineId, journalEntryId, and matchType are required" }, { status: 400 });
        }

        const line = await (prisma as any).bankStatementLine.findUnique({ where: { id: statementLineId } });
        if (!line) return NextResponse.json({ error: "Statement line not found" }, { status: 404 });
        if (line.isMatched) return NextResponse.json({ error: "Statement line is already matched" }, { status: 409 });

        const match = await prisma.$transaction(async (tx) => {
            const m = await (tx as any).reconciliationMatch.create({
                data: {
                    statementLineId,
                    journalEntryId,
                    matchedBy: session.user!.id,
                    matchType,
                    notes: notes || null
                }
            });
            await (tx as any).bankStatementLine.update({
                where: { id: statementLineId },
                data: { isMatched: true }
            });
            return m;
        });

        return NextResponse.json(match, { status: 201 });
    }

    if (action === 'UNMATCH') {
        const { statementLineId } = body;
        if (!statementLineId) return NextResponse.json({ error: "statementLineId is required" }, { status: 400 });

        await prisma.$transaction(async (tx) => {
            await (tx as any).reconciliationMatch.deleteMany({ where: { statementLineId } });
            await (tx as any).bankStatementLine.update({
                where: { id: statementLineId },
                data: { isMatched: false }
            });
        });

        return NextResponse.json({ success: true });
    }

    if (action === 'AUTO_MATCH') {
        const glLines = await prisma.journalLine.findMany({
            where: { accountId: bankAccount.glAccountId, entry: { status: 'POSTED' } },
            include: { entry: { select: { id: true, date: true } } }
        });

        const matchedEntryIds = new Set(
            (await (prisma as any).reconciliationMatch.findMany({
                select: { journalEntryId: true }
            })).map((m: any) => m.journalEntryId)
        );

        const availableGlLines = glLines.filter(l => !matchedEntryIds.has(l.entryId));

        const unmatchedLines = await (prisma as any).bankStatementLine.findMany({
            where: { isMatched: false, statement: { bankAccountId: params.id } },
            orderBy: { transactionDate: 'asc' }
        });

        let matched = 0;
        const THREE_DAYS = 3 * 24 * 60 * 60 * 1000;

        for (const stmtLine of unmatchedLines) {
            const stmtNet = Number(stmtLine.credit) - Number(stmtLine.debit);
            const stmtDate = new Date(stmtLine.transactionDate).getTime();

            // Find GL lines with matching net amount within ±3 days
            const candidates = availableGlLines.filter(gl => {
                const glNet = gl.debit - gl.credit;
                const glDate = new Date((gl.entry as any).date).getTime();
                return Math.abs(glNet - stmtNet) < 0.01 && Math.abs(glDate - stmtDate) <= THREE_DAYS;
            });

            if (candidates.length !== 1) continue; // skip ambiguous or no match

            const glLine = candidates[0];

            await prisma.$transaction(async (tx) => {
                await (tx as any).reconciliationMatch.create({
                    data: {
                        statementLineId: stmtLine.id,
                        journalEntryId: glLine.entryId,
                        matchedBy: session.user!.id,
                        matchType: 'AUTO',
                        notes: 'Auto-matched by amount and date'
                    }
                });
                await (tx as any).bankStatementLine.update({
                    where: { id: stmtLine.id },
                    data: { isMatched: true }
                });
            });

            matchedEntryIds.add(glLine.entryId);
            availableGlLines.splice(availableGlLines.indexOf(glLine), 1);
            matched++;
        }

        return NextResponse.json({ matched });
    }

    return NextResponse.json({ error: "Invalid action. Use MATCH, UNMATCH, or AUTO_MATCH" }, { status: 400 });
}
