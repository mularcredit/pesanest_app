/**
 * Accrual schedules — prepayments, accruals, and deferred income.
 *
 * GET  /api/accounting/accruals          — list schedules (optional ?type=ACCRUAL|PREPAYMENT|DEFERRED_INCOME)
 * POST /api/accounting/accruals          — create a schedule + generate recognition lines
 *
 * Recognition line amounts are distributed evenly across `periods`.
 * The last recognition absorbs any rounding remainder.
 *
 * Types:
 *   ACCRUAL         — expense accrued before invoice (Dr Expense / Cr Accrued Liabilities)
 *   PREPAYMENT      — expense paid in advance       (Dr Prepaid Asset / Cr Cash)
 *   DEFERRED_INCOME — income received in advance    (Dr Cash / Cr Deferred Revenue)
 */

import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type');

    const scheduleRows = await (type
        ? prisma.$queryRaw<any[]>`
            SELECT s.*,
                da.id as "da_id", da.code as "da_code", da.name as "da_name",
                ca.id as "ca_id", ca.code as "ca_code", ca.name as "ca_name"
            FROM "AccrualSchedule" s
            LEFT JOIN "Account" da ON s."debitAccountId" = da.id
            LEFT JOIN "Account" ca ON s."creditAccountId" = ca.id
            WHERE s.type = ${type}
            ORDER BY s."createdAt" DESC`
        : prisma.$queryRaw<any[]>`
            SELECT s.*,
                da.id as "da_id", da.code as "da_code", da.name as "da_name",
                ca.id as "ca_id", ca.code as "ca_code", ca.name as "ca_name"
            FROM "AccrualSchedule" s
            LEFT JOIN "Account" da ON s."debitAccountId" = da.id
            LEFT JOIN "Account" ca ON s."creditAccountId" = ca.id
            ORDER BY s."createdAt" DESC`
    ).catch(() => []);

    const recognitionRows = scheduleRows.length
        ? await prisma.$queryRaw<any[]>`SELECT * FROM "AccrualRecognition" ORDER BY "periodDate" ASC`.catch(() => [])
        : [];

    const schedules = scheduleRows.map((s: any) => ({
        ...s,
        debitAccount: { id: s.da_id, code: s.da_code, name: s.da_name },
        creditAccount: { id: s.ca_id, code: s.ca_code, name: s.ca_name },
        recognitions: recognitionRows.filter((r: any) => r.scheduleId === s.id),
    }));

    return NextResponse.json(schedules);
}

export async function POST(req: Request) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const {
        name, type, totalAmount, debitAccountId, creditAccountId,
        startDate, endDate, periods, periodType, sourceRef
    } = body;

    if (!name || !type || !totalAmount || !debitAccountId || !creditAccountId || !startDate || !periods) {
        return NextResponse.json({ error: "name, type, totalAmount, debitAccountId, creditAccountId, startDate, and periods are required" }, { status: 400 });
    }

    const validTypes = ['ACCRUAL', 'PREPAYMENT', 'DEFERRED_INCOME'];
    if (!validTypes.includes(type)) {
        return NextResponse.json({ error: `type must be one of: ${validTypes.join(', ')}` }, { status: 400 });
    }

    const total = Number(totalAmount);
    const perPeriod = Math.floor((total * 100) / periods) / 100;
    const remainder = Math.round((total - perPeriod * periods) * 100) / 100;

    // Generate recognition dates: one per period starting from startDate
    const recognitionLines = [];
    const start = new Date(startDate);
    for (let i = 0; i < periods; i++) {
        const periodDate = new Date(start);
        if ((periodType || 'MONTHLY') === 'MONTHLY') {
            periodDate.setMonth(start.getMonth() + i);
        } else if (periodType === 'QUARTERLY') {
            periodDate.setMonth(start.getMonth() + i * 3);
        } else if (periodType === 'WEEKLY') {
            periodDate.setDate(start.getDate() + i * 7);
        }
        const amount = i === periods - 1 ? perPeriod + remainder : perPeriod;
        recognitionLines.push({ periodDate, amount, status: 'PENDING' });
    }

    try {
        const scheduleId = crypto.randomUUID();
        const endDateVal = endDate ? new Date(endDate) : new Date(recognitionLines[recognitionLines.length - 1].periodDate);

        await prisma.$executeRaw`
            INSERT INTO "AccrualSchedule"
                (id, name, type, "totalAmount", "debitAccountId", "creditAccountId",
                 "startDate", "endDate", periods, "periodType", "sourceRef", status, "createdBy", "createdAt", "updatedAt")
            VALUES (
                ${scheduleId}, ${name}, ${type}, ${total}, ${debitAccountId}, ${creditAccountId},
                ${new Date(startDate)}, ${endDateVal}, ${periods}, ${periodType || 'MONTHLY'},
                ${sourceRef || null}, 'ACTIVE', ${session.user.id}, NOW(), NOW()
            )
        `;

        for (const line of recognitionLines) {
            await prisma.$executeRaw`
                INSERT INTO "AccrualRecognition" (id, "scheduleId", "periodDate", amount, status)
                VALUES (${crypto.randomUUID()}, ${scheduleId}, ${line.periodDate}, ${line.amount}, 'PENDING')
            `;
        }

        await prisma.$executeRaw`
            INSERT INTO "AuditLog" (id, "actorId", action, entity, "entityId", "after", "createdAt")
            VALUES (${crypto.randomUUID()}, ${session.user.id}, 'ACCRUAL_CREATE', 'AccrualSchedule', ${scheduleId},
                    ${JSON.stringify({ name, type, totalAmount: total, periods })}::jsonb, NOW())
        `.catch(() => {});

        const [created] = await prisma.$queryRaw<any[]>`
            SELECT s.*, da.code as "da_code", da.name as "da_name", ca.code as "ca_code", ca.name as "ca_name"
            FROM "AccrualSchedule" s
            LEFT JOIN "Account" da ON s."debitAccountId" = da.id
            LEFT JOIN "Account" ca ON s."creditAccountId" = ca.id
            WHERE s.id = ${scheduleId}
        `;
        const recognitions = await prisma.$queryRaw<any[]>`
            SELECT * FROM "AccrualRecognition" WHERE "scheduleId" = ${scheduleId} ORDER BY "periodDate" ASC
        `;

        return NextResponse.json({ ...created, recognitions }, { status: 201 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
