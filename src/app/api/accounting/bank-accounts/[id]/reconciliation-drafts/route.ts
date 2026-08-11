/**
 * Reconciliation drafts for a bank or paybill account.
 *
 * A draft is a saved-but-unconfirmed group of statement line ids — for when
 * a reconciler wants to earmark a set of transactions (e.g. the 3 that add
 * up to one lump-sum salary entry) before the corresponding journal entry
 * even exists yet, without losing that selection when they step away to go
 * record it.
 *
 * GET  /api/accounting/bank-accounts/[id]/reconciliation-drafts
 *   Lists drafts for this account, with their still-unmatched lines resolved.
 *
 * POST /api/accounting/bank-accounts/[id]/reconciliation-drafts
 *   body: { statementLineIds: string[], label?: string }
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

    const drafts = await (prisma as any).reconciliationDraft.findMany({
        where: account.kind === 'BANK' ? { bankAccountId: params.id } : { paybillAccountId: params.id },
        orderBy: { updatedAt: 'desc' },
    });

    // Resolve each draft's lines fresh — some may have been matched or
    // reverted elsewhere since the draft was saved, so don't trust the
    // stored id list blindly.
    const allIds = Array.from(new Set(drafts.flatMap((d: any) => d.statementLineIds as string[])));
    const lines = allIds.length
        ? await (prisma as any).bankStatementLine.findMany({ where: { id: { in: allIds }, isMatched: false } })
        : [];
    const lineMap = new Map(lines.map((l: any) => [l.id, l]));

    const resolved = drafts.map((d: any) => {
        const stillOpen = (d.statementLineIds as string[])
            .map((id: string) => lineMap.get(id))
            .filter(Boolean);
        return {
            id: d.id,
            label: d.label,
            createdAt: d.createdAt,
            originalCount: d.statementLineIds.length,
            lines: stillOpen.map((l: any) => ({
                id: l.id,
                date: l.transactionDate,
                description: l.description,
                amount: Number(l.credit) > 0 ? Number(l.credit) : -Number(l.debit),
            })),
        };
    });

    return NextResponse.json(resolved);
}

export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
    const params = await props.params;
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await requireAdmin(session))) {
        return NextResponse.json({ error: "Only System Admins can save a reconciliation draft" }, { status: 403 });
    }

    const account = await resolveReconcilableAccount(params.id);
    if (!account) return NextResponse.json({ error: "Account not found" }, { status: 404 });

    const body = await req.json();
    const statementLineIds: string[] = Array.isArray(body.statementLineIds) ? body.statementLineIds : [];
    if (statementLineIds.length === 0) {
        return NextResponse.json({ error: "Select at least one transaction to save as a draft" }, { status: 400 });
    }

    // Lines must actually belong to this account and still be unmatched —
    // otherwise the draft would resurrect stale ids from somewhere else.
    const lines = await (prisma as any).bankStatementLine.findMany({
        where: { id: { in: statementLineIds }, isMatched: false, statement: statementOwnerFilter(params.id) },
    });
    if (lines.length !== statementLineIds.length) {
        return NextResponse.json({ error: "One or more selected transactions are no longer available" }, { status: 409 });
    }

    const draft = await (prisma as any).reconciliationDraft.create({
        data: {
            bankAccountId: account.kind === 'BANK' ? account.id : null,
            paybillAccountId: account.kind === 'PAYBILL' ? account.id : null,
            label: body.label || null,
            statementLineIds,
            createdBy: session.user.id,
        },
    });

    return NextResponse.json({ id: draft.id }, { status: 201 });
}
