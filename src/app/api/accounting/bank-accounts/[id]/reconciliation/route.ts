/**
 * Reconciliation API for a bank or paybill account (see reconcilable-accounts.ts).
 *
 * GET  /api/accounting/bank-accounts/[id]/reconciliation
 *   Returns unmatched statement lines and unmatched GL journal lines for
 *   the account's GL account, grouped for side-by-side matching.
 *
 * POST /api/accounting/bank-accounts/[id]/reconciliation
 *   body: { action: 'MATCH', statementLineIds: string[], journalEntryIds: string[], matchType, notes? }
 *     Persists one ReconciliationMatch per (statementLine, journalEntry) pair —
 *     the full cross-product of both sides — and marks each statementLine as
 *     matched. Either side (or both) can have more than one item, e.g. 3 bank
 *     transactions against 1 lump-sum entry, or 1 bank transaction against 2
 *     entries. Whenever either side has more than one item, their combined net
 *     amounts must be exactly equal. A single-to-single match has no such
 *     check, since that pairing is already a human judgment call.
 *     (statementLineId/journalEntryId singular still accepted for one item.)
 *
 *   body: { action: 'AUTO_MATCH' }
 *     Iterates all unmatched statement lines and attempts to find a unique
 *     GL journal line with the same net amount (debit–credit) and a date
 *     within ±3 days. One-to-one only — it doesn't search for combinations.
 *
 *   body: { action: 'UNMATCH', statementLineIds: string[] }
 *     Deletes the ReconciliationMatch(es) and marks the lines unmatched.
 *     (statementLineId singular is still accepted for one line.)
 */

import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";
import { resolveReconcilableAccount, statementOwnerFilter } from "@/lib/accounting/reconcilable-accounts";

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

    const account = await resolveReconcilableAccount(params.id);
    if (!account) return NextResponse.json({ error: "Account not found" }, { status: 404 });

    const { searchParams } = new URL(req.url);
    const statementId = searchParams.get('statementId');

    // Fetch unmatched statement lines
    const lineFilter: any = {
        isMatched: false,
        statement: statementOwnerFilter(params.id)
    };
    if (statementId) lineFilter.statementId = statementId;

    const unmatchedLines = await (prisma as any).bankStatementLine.findMany({
        where: lineFilter,
        include: { statement: { select: { periodStart: true, periodEnd: true } } },
        orderBy: { transactionDate: 'asc' }
    });

    // Fetch GL journal lines on this account's GL account that have no ReconciliationMatch
    const glLines = await prisma.journalLine.findMany({
        where: {
            accountId: account.glAccountId,
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
        account,
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

    const account = await resolveReconcilableAccount(params.id);
    if (!account) return NextResponse.json({ error: "Account not found" }, { status: 404 });

    const body = await req.json();
    const { action } = body;

    if (action === 'MATCH') {
        const { matchType, notes } = body;
        const statementLineIds: string[] = Array.isArray(body.statementLineIds)
            ? body.statementLineIds
            : (body.statementLineId ? [body.statementLineId] : []);
        const journalEntryIds: string[] = Array.isArray(body.journalEntryIds)
            ? body.journalEntryIds
            : (body.journalEntryId ? [body.journalEntryId] : []);

        if (statementLineIds.length === 0 || journalEntryIds.length === 0 || !matchType) {
            return NextResponse.json({ error: "statementLineIds, journalEntryIds, and matchType are required" }, { status: 400 });
        }

        const lines = await (prisma as any).bankStatementLine.findMany({ where: { id: { in: statementLineIds } } });
        if (lines.length !== statementLineIds.length) {
            return NextResponse.json({ error: "One or more statement lines not found" }, { status: 404 });
        }
        if (lines.some((l: any) => l.isMatched)) {
            return NextResponse.json({ error: "One or more statement lines are already matched" }, { status: 409 });
        }

        // Splitting several items on either side only makes sense if the two
        // sides actually add up to the same total — a single-to-single match
        // has no such requirement, since a human already eyeballed that pair.
        if (statementLineIds.length > 1 || journalEntryIds.length > 1) {
            const glLines = await prisma.journalLine.findMany({
                where: { entryId: { in: journalEntryIds }, accountId: account.glAccountId },
            });
            const netByEntry = new Map<string, number>();
            for (const l of glLines) netByEntry.set(l.entryId, (netByEntry.get(l.entryId) || 0) + (l.debit - l.credit));

            const missingEntry = journalEntryIds.find(id => !netByEntry.has(id));
            if (missingEntry) return NextResponse.json({ error: "One or more journal entries not found on this account" }, { status: 404 });

            const entryNetSum = journalEntryIds.reduce((s, id) => s + (netByEntry.get(id) || 0), 0);
            const selectedSum = lines.reduce((s: number, l: any) => s + (Number(l.credit) - Number(l.debit)), 0);
            if (Math.abs(selectedSum - entryNetSum) > 0.01) {
                return NextResponse.json({
                    error: `Selected totals don't match — bank side is ${selectedSum.toFixed(2)}, books side is ${entryNetSum.toFixed(2)}`,
                }, { status: 400 });
            }
        }

        // Every statement line is matched against every journal entry in the
        // group — with no per-pair concept in a many-to-many split, what's
        // actually verified is that the GROUP balances, not any one pairing.
        const matches = await prisma.$transaction(async (tx) => {
            const created = [];
            for (const slId of statementLineIds) {
                for (const jeId of journalEntryIds) {
                    created.push(await (tx as any).reconciliationMatch.create({
                        data: {
                            statementLineId: slId,
                            journalEntryId: jeId,
                            matchedBy: session.user!.id,
                            matchType,
                            notes: notes || null
                        }
                    }));
                }
            }
            await (tx as any).bankStatementLine.updateMany({
                where: { id: { in: statementLineIds } },
                data: { isMatched: true }
            });
            return created;
        });

        return NextResponse.json(matches, { status: 201 });
    }

    if (action === 'UNMATCH') {
        const ids: string[] = Array.isArray(body.statementLineIds)
            ? body.statementLineIds
            : (body.statementLineId ? [body.statementLineId] : []);
        if (ids.length === 0) return NextResponse.json({ error: "statementLineIds is required" }, { status: 400 });

        await prisma.$transaction(async (tx) => {
            await (tx as any).reconciliationMatch.deleteMany({ where: { statementLineId: { in: ids } } });
            await (tx as any).bankStatementLine.updateMany({
                where: { id: { in: ids } },
                data: { isMatched: false }
            });
        });

        return NextResponse.json({ success: true });
    }

    if (action === 'AUTO_MATCH') {
        const glLines = await prisma.journalLine.findMany({
            where: { accountId: account.glAccountId, entry: { status: 'POSTED' } },
            include: { entry: { select: { id: true, date: true } } }
        });

        const matchedEntryIds = new Set(
            (await (prisma as any).reconciliationMatch.findMany({
                select: { journalEntryId: true }
            })).map((m: any) => m.journalEntryId)
        );

        const availableGlLines = glLines.filter(l => !matchedEntryIds.has(l.entryId));

        const unmatchedLines = await (prisma as any).bankStatementLine.findMany({
            where: { isMatched: false, statement: statementOwnerFilter(params.id) },
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
