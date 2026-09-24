/**
 * GET /api/accounting/settlement-accounts
 *
 * Lists the real bank/paybill/Paystack accounts a payment can actually
 * settle through, for any UI that needs to ask "which account did this move
 * through" before posting a GL entry — so that entry lands on the
 * specific account's linked glAccountId (and is therefore visible to
 * Bank Reconciliation) instead of a generic, unlinked fallback account.
 *
 * Returns [{ id, kind: 'BANK' | 'PAYBILL' | 'PAYSTACK', label, glAccountId }].
 */

import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const [bankRows, paybillRows, paystackRows] = await Promise.all([
        prisma.bankAccount.findMany({
            where: { isActive: true },
            select: { id: true, name: true, bankName: true, glAccountId: true },
            orderBy: { name: 'asc' },
        }),
        prisma.paybillAccount.findMany({
            where: { isActive: true },
            select: { id: true, name: true, paybillNumber: true, glAccountId: true },
            orderBy: { name: 'asc' },
        }),
        (prisma as any).paystackAccount.findMany({
            where: { isActive: true },
            select: { id: true, name: true, glAccountId: true },
            orderBy: { name: 'asc' },
        }),
    ]);

    const accounts = [
        ...bankRows.map(b => ({ id: b.id, kind: 'BANK' as const, label: `${b.name} — ${b.bankName}`, glAccountId: b.glAccountId })),
        ...paybillRows.map(p => ({ id: p.id, kind: 'PAYBILL' as const, label: `${p.name} — ${p.paybillNumber}`, glAccountId: p.glAccountId })),
        ...paystackRows.map((ps: any) => ({ id: ps.id, kind: 'PAYSTACK' as const, label: ps.name, glAccountId: ps.glAccountId })),
    ];

    return NextResponse.json({ accounts });
}
