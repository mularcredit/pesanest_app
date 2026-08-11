/**
 * DELETE /api/accounting/bank-accounts/[id]/statements/[statementId]
 *
 * Reverts a bad or duplicate statement import. Refuses if any of its lines
 * have already been matched, unless ?force=true is passed — then it drops
 * those ReconciliationMatch rows first (unmatching, not deleting the
 * underlying journal entries) before removing the statement. Either way,
 * the audit log records how many matches were sacrificed.
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

export async function DELETE(req: Request, props: { params: Promise<{ id: string; statementId: string }> }) {
    const params = await props.params;
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await requireAdmin(session))) {
        return NextResponse.json({ error: "Only System Admins can revert a statement import" }, { status: 403 });
    }

    const force = new URL(req.url).searchParams.get('force') === 'true';

    const statement = await (prisma as any).bankStatement.findUnique({
        where: { id: params.statementId },
        include: { lines: { select: { id: true, isMatched: true } } },
    });
    if (!statement || (statement.bankAccountId !== params.id && statement.paybillAccountId !== params.id)) {
        return NextResponse.json({ error: "Statement not found" }, { status: 404 });
    }

    const matchedLines = statement.lines.filter((l: any) => l.isMatched);
    if (matchedLines.length > 0 && !force) {
        return NextResponse.json({
            error: `${matchedLines.length} line${matchedLines.length !== 1 ? 's' : ''} already matched — unmatch them first, then revert.`,
            matchedCount: matchedLines.length,
        }, { status: 409 });
    }

    await prisma.$transaction(async (tx) => {
        if (matchedLines.length > 0) {
            await (tx as any).reconciliationMatch.deleteMany({
                where: { statementLineId: { in: matchedLines.map((l: any) => l.id) } },
            });
        }
        await (tx as any).bankStatement.delete({ where: { id: params.statementId } });
    });

    await (prisma as any).auditLog.create({
        data: {
            actorId: session.user.id,
            action: 'STATEMENT_REVERT',
            entity: 'BankStatement',
            entityId: params.statementId,
            before: { bankAccountId: params.id, lineCount: statement.lines.length, matchesDropped: matchedLines.length },
        },
    }).catch(() => {});

    return NextResponse.json({ success: true, matchesDropped: matchedLines.length });
}
