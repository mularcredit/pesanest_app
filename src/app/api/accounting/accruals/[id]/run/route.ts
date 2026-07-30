/**
 * POST /api/accounting/accruals/[id]/run
 *
 * Posts all PENDING AccrualRecognition lines whose periodDate falls on or before
 * today (or the supplied ?asOf=YYYY-MM-DD date). Each recognition creates a
 * proper journal entry via AccountingEngine.postJournalEntry so that period
 * enforcement, audit logging, and sequence numbering apply.
 *
 * Body: { asOf?: string }  (defaults to today)
 */

import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { AccountingEngine } from "@/lib/accounting/accounting-engine";
import { NextResponse } from "next/server";

export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
    const params = await props.params;
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const asOf = body.asOf ? new Date(body.asOf) : new Date();

    const scheduleRows = await prisma.$queryRaw<any[]>`
        SELECT s.*, da.id as "debitAccountId_ref", ca.id as "creditAccountId_ref"
        FROM "AccrualSchedule" s
        LEFT JOIN "Account" da ON s."debitAccountId" = da.id
        LEFT JOIN "Account" ca ON s."creditAccountId" = ca.id
        WHERE s.id = ${params.id}
    `.catch(() => []);
    const scheduleBase = scheduleRows[0] ?? null;
    const pendingRecs = scheduleBase ? await prisma.$queryRaw<any[]>`
        SELECT * FROM "AccrualRecognition"
        WHERE "scheduleId" = ${params.id} AND status = 'PENDING' AND "periodDate" <= ${asOf}
        ORDER BY "periodDate" ASC
    `.catch(() => []) : [];
    const schedule = scheduleBase ? { ...scheduleBase, recognitions: pendingRecs } : null;

    if (!schedule) return NextResponse.json({ error: "Accrual schedule not found" }, { status: 404 });
    if (schedule.status !== 'ACTIVE') {
        return NextResponse.json({ error: `Schedule is ${schedule.status}` }, { status: 400 });
    }

    const pending = schedule.recognitions;
    if (!pending.length) {
        return NextResponse.json({ posted: 0, message: "No pending recognitions due" });
    }

    let posted = 0;
    for (const rec of pending) {
        const amount = Number(rec.amount);
        const entry = await AccountingEngine.postJournalEntry({
            date: rec.periodDate,
            description: `${schedule.name} — recognition ${new Date(rec.periodDate).toISOString().slice(0, 7)}`,
            reference: `ACCRUAL-${schedule.id}-${new Date(rec.periodDate).toISOString().slice(0, 7)}`,
            userId: session.user.id,
            lines: [
                { accountId: schedule.debitAccountId, debit: amount, credit: 0 },
                { accountId: schedule.creditAccountId, debit: 0, credit: amount }
            ]
        });

        await prisma.$executeRaw`
            UPDATE "AccrualRecognition" SET status = 'POSTED', "journalEntryId" = ${entry.id} WHERE id = ${rec.id}
        `;
        posted++;
    }

    // Mark schedule complete if all recognitions are now posted
    const remainingRows = await prisma.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(*) as count FROM "AccrualRecognition" WHERE "scheduleId" = ${params.id} AND status = 'PENDING'
    `.catch(() => [{ count: BigInt(0) }]);
    const remaining = Number(remainingRows[0]?.count ?? 0);
    if (remaining === 0) {
        await prisma.$executeRaw`
            UPDATE "AccrualSchedule" SET status = 'COMPLETED', "updatedAt" = NOW() WHERE id = ${params.id}
        `;
    }

    return NextResponse.json({ posted, remaining });
}
