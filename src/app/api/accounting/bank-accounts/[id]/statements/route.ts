/**
 * POST /api/accounting/bank-accounts/[id]/statements
 *
 * Imports a bank statement as CSV or M-Pesa statement format.
 *
 * Expected JSON body:
 * {
 *   periodStart: "YYYY-MM-DD",
 *   periodEnd:   "YYYY-MM-DD",
 *   openingBalance: number,
 *   closingBalance: number,
 *   lines: [
 *     {
 *       transactionDate: "YYYY-MM-DD",
 *       description: string,
 *       reference?: string,
 *       debit?: number,   // money out (reduces bank balance)
 *       credit?: number,  // money in (increases bank balance)
 *       balance?: number
 *     }
 *   ]
 * }
 *
 * The frontend (BankReconciliationClient) parses CSV/Excel using xlsx and
 * sends the normalised lines array to this endpoint.
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

export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
    const params = await props.params;
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await requireAdmin(session))) {
        return NextResponse.json({ error: "Only System Admins can import statements" }, { status: 403 });
    }

    const bankAccount = await (prisma as any).bankAccount.findUnique({ where: { id: params.id } });
    if (!bankAccount) return NextResponse.json({ error: "Bank account not found" }, { status: 404 });

    const body = await req.json();
    const { periodStart, periodEnd, openingBalance, closingBalance, lines } = body;

    if (!periodStart || !periodEnd || !Array.isArray(lines)) {
        return NextResponse.json({ error: "periodStart, periodEnd, and lines[] are required" }, { status: 400 });
    }

    if (!lines.length) {
        return NextResponse.json({ error: "Statement has no lines" }, { status: 400 });
    }

    try {
        const statement = await (prisma as any).bankStatement.create({
            data: {
                bankAccountId: params.id,
                periodStart: new Date(periodStart),
                periodEnd: new Date(periodEnd),
                openingBalance: openingBalance ?? 0,
                closingBalance: closingBalance ?? 0,
                importedBy: session.user.id,
                lines: {
                    create: lines.map((l: any) => ({
                        transactionDate: new Date(l.transactionDate),
                        description: l.description || '',
                        reference: l.reference || null,
                        debit: l.debit ?? 0,
                        credit: l.credit ?? 0,
                        balance: l.balance ?? null,
                        isMatched: false
                    }))
                }
            },
            include: { lines: true }
        });

        await (prisma as any).auditLog.create({
            data: {
                actorId: session.user.id,
                action: 'STATEMENT_IMPORT',
                entity: 'BankStatement',
                entityId: statement.id,
                after: {
                    bankAccountId: params.id,
                    periodStart,
                    periodEnd,
                    lineCount: lines.length
                }
            }
        });

        return NextResponse.json({ id: statement.id, lineCount: statement.lines.length }, { status: 201 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function GET(req: Request, props: { params: Promise<{ id: string }> }) {
    const params = await props.params;
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        const statements = await (prisma as any).bankStatement.findMany({
            where: { bankAccountId: params.id },
            include: {
                lines: {
                    orderBy: { transactionDate: 'asc' },
                    include: { matches: true }
                }
            },
            orderBy: { periodEnd: 'desc' }
        });

        return NextResponse.json(statements);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
