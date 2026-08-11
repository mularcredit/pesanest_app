/**
 * DELETE /api/accounting/bank-accounts/[id]/reconciliation-drafts/[draftId]
 *
 * Discards a draft. This only removes the saved selection — the underlying
 * statement lines are untouched and stay available to match normally.
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

export async function DELETE(req: Request, props: { params: Promise<{ id: string; draftId: string }> }) {
    const params = await props.params;
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await requireAdmin(session))) {
        return NextResponse.json({ error: "Only System Admins can discard a reconciliation draft" }, { status: 403 });
    }

    const draft = await (prisma as any).reconciliationDraft.findUnique({ where: { id: params.draftId } });
    if (!draft || (draft.bankAccountId !== params.id && draft.paybillAccountId !== params.id)) {
        return NextResponse.json({ error: "Draft not found" }, { status: 404 });
    }

    await (prisma as any).reconciliationDraft.delete({ where: { id: params.draftId } });

    return NextResponse.json({ success: true });
}
