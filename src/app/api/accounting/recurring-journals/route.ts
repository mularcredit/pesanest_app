/**
 * Recurring journal templates.
 *
 * GET  /api/accounting/recurring-journals   — list templates
 * POST /api/accounting/recurring-journals   — create template with lines
 *
 * Lines must balance (sum of debits = sum of credits).
 * Frequency: WEEKLY | MONTHLY | QUARTERLY | ANNUALLY
 */

import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const templates = await (prisma as any).recurringJournalTemplate.findMany({
        include: {
            lines: {
                include: { account: { select: { id: true, code: true, name: true } } }
            }
        },
        orderBy: { nextRunDate: 'asc' }
    });

    return NextResponse.json(templates);
}

export async function POST(req: Request) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { name, description, frequency, nextRunDate, endDate, lines } = body;

    if (!name || !frequency || !nextRunDate || !Array.isArray(lines) || !lines.length) {
        return NextResponse.json({ error: "name, frequency, nextRunDate, and lines[] are required" }, { status: 400 });
    }

    const validFrequencies = ['WEEKLY', 'MONTHLY', 'QUARTERLY', 'ANNUALLY'];
    if (!validFrequencies.includes(frequency)) {
        return NextResponse.json({ error: `frequency must be one of: ${validFrequencies.join(', ')}` }, { status: 400 });
    }

    const totalDebits = lines.reduce((s: number, l: any) => s + Number(l.debit || 0), 0);
    const totalCredits = lines.reduce((s: number, l: any) => s + Number(l.credit || 0), 0);
    if (Math.abs(totalDebits - totalCredits) > 0.001) {
        return NextResponse.json({ error: `Journal lines do not balance: debits ${totalDebits} ≠ credits ${totalCredits}` }, { status: 400 });
    }

    try {
        const template = await (prisma as any).recurringJournalTemplate.create({
            data: {
                name,
                description: description || null,
                frequency,
                nextRunDate: new Date(nextRunDate),
                endDate: endDate ? new Date(endDate) : null,
                isActive: true,
                createdBy: session.user.id,
                lines: {
                    create: lines.map((l: any) => ({
                        accountId: l.accountId,
                        description: l.description || null,
                        debit: Number(l.debit || 0),
                        credit: Number(l.credit || 0)
                    }))
                }
            },
            include: { lines: { include: { account: { select: { code: true, name: true } } } } }
        });

        return NextResponse.json(template, { status: 201 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
