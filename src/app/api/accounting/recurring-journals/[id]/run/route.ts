/**
 * POST /api/accounting/recurring-journals/[id]/run
 *
 * Generates a journal entry from a recurring template and advances nextRunDate.
 * Idempotent: skips if today < nextRunDate (pass force=true to override).
 *
 * Body: { force?: boolean }
 */

import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { AccountingEngine } from "@/lib/accounting/accounting-engine";
import { NextResponse } from "next/server";

function advanceDate(date: Date, frequency: string): Date {
    const d = new Date(date);
    switch (frequency) {
        case 'WEEKLY':    d.setDate(d.getDate() + 7); break;
        case 'MONTHLY':   d.setMonth(d.getMonth() + 1); break;
        case 'QUARTERLY': d.setMonth(d.getMonth() + 3); break;
        case 'ANNUALLY':  d.setFullYear(d.getFullYear() + 1); break;
    }
    return d;
}

export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
    const params = await props.params;
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const force = body.force === true;

    const template = await (prisma as any).recurringJournalTemplate.findUnique({
        where: { id: params.id },
        include: { lines: true }
    });

    if (!template) return NextResponse.json({ error: "Template not found" }, { status: 404 });
    if (!template.isActive) return NextResponse.json({ error: "Template is inactive" }, { status: 400 });

    const now = new Date();
    if (!force && new Date(template.nextRunDate) > now) {
        return NextResponse.json({
            skipped: true,
            nextRunDate: template.nextRunDate,
            message: "Not yet due. Pass force=true to run early."
        });
    }

    if (template.endDate && new Date(template.endDate) < now) {
        await (prisma as any).recurringJournalTemplate.update({
            where: { id: params.id },
            data: { isActive: false }
        });
        return NextResponse.json({ error: "Template has passed its end date and has been deactivated" }, { status: 400 });
    }

    const entry = await AccountingEngine.postJournalEntry({
        date: template.nextRunDate,
        description: template.name + (template.description ? ` — ${template.description}` : ''),
        reference: `RECUR-${params.id}-${new Date(template.nextRunDate).toISOString().slice(0, 10)}`,
        userId: session.user.id,
        lines: template.lines.map((l: any) => ({
            accountId: l.accountId,
            description: l.description,
            debit: Number(l.debit),
            credit: Number(l.credit)
        }))
    });

    const nextRunDate = advanceDate(new Date(template.nextRunDate), template.frequency);
    const shouldDeactivate = template.endDate && nextRunDate > new Date(template.endDate);

    await (prisma as any).recurringJournalTemplate.update({
        where: { id: params.id },
        data: {
            nextRunDate,
            isActive: !shouldDeactivate
        }
    });

    return NextResponse.json({ entryId: entry.id, entryNumber: entry.entryNumber, nextRunDate });
}
