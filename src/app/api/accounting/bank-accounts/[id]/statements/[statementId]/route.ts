/**
 * DELETE /api/accounting/bank-accounts/[id]/statements/[statementId]
 *
 * Reverts a bad or duplicate statement import. Refuses if any of its lines
 * have already been matched — those matches are real reconciliation history
 * (each one is a ReconciliationMatch against a real journal entry), so
 * unmatch them first via the reconciliation endpoint before reverting.
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

    const statement = await (prisma as any).bankStatement.findUnique({
        where: { id: params.statementId },
        include: { lines: { select: { isMatched: true } } },
    });
    if (!statement || statement.bankAccountId !== params.id) {
        return NextResponse.json({ error: "Statement not found" }, { status: 404 });
    }

    const matchedCount = statement.lines.filter((l: any) => l.isMatched).length;
    if (matchedCount > 0) {
        return NextResponse.json({
            error: `${matchedCount} line${matchedCount !== 1 ? 's' : ''} already matched — unmatch them first, then revert.`,
        }, { status: 409 });
    }

    await (prisma as any).bankStatement.delete({ where: { id: params.statementId } });

    await (prisma as any).auditLog.create({
        data: {
            actorId: session.user.id,
            action: 'STATEMENT_REVERT',
            entity: 'BankStatement',
            entityId: params.statementId,
            before: { bankAccountId: params.id, lineCount: statement.lines.length },
        },
    }).catch(() => {});

    return NextResponse.json({ success: true });
}
