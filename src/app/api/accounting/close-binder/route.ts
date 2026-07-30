/**
 * GET /api/accounting/close-binder?periodId=xxx
 *
 * Produces the close binder package for a period:
 *
 *  1. Trial balance snapshot — all accounts with their debit/credit totals
 *     for the period and running balances.
 *  2. Journal listing — all POSTED entries in the period ordered by date/number.
 *  3. Sequence gap report — any gaps or duplicates in JE entryNumber for the period.
 *  4. Exception report:
 *       - Backdated entries (isBackdated = true) posted in the period
 *       - Manual journals (no expenseId/invoiceId/saleId) posted in the period
 *       - Entries with missing entryNumber
 *  5. Documents without postings — expenses/invoices marked PAID with no linked JE.
 *
 * All SYSTEM_ADMIN access required.
 */

import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { role: true, customRole: { select: { isSystem: true } } }
    });
    if (user?.role !== 'SYSTEM_ADMIN' && !user?.customRole?.isSystem) {
        return NextResponse.json({ error: "Only System Admins can access the close binder" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const periodId = searchParams.get('periodId');

    if (!periodId) return NextResponse.json({ error: "periodId is required" }, { status: 400 });

    const period = await (prisma as any).accountingPeriod.findUnique({
        where: { id: periodId },
        include: { fiscalYear: { select: { name: true } } }
    });
    if (!period) return NextResponse.json({ error: "Period not found" }, { status: 404 });

    const { startDate, endDate } = period;

    // 1. Trial balance for the period
    const periodEntries = await prisma.journalEntry.findMany({
        where: { date: { gte: startDate, lte: endDate }, status: 'POSTED' },
        include: { lines: { include: { account: { select: { id: true, code: true, name: true, type: true } } } } }
    });

    const accountMap: Record<string, { code: string; name: string; type: string; debit: number; credit: number }> = {};
    for (const entry of periodEntries) {
        for (const line of entry.lines) {
            const key = line.accountId;
            if (!accountMap[key]) {
                accountMap[key] = { code: line.account.code, name: line.account.name, type: line.account.type, debit: 0, credit: 0 };
            }
            accountMap[key].debit += line.debit;
            accountMap[key].credit += line.credit;
        }
    }
    const trialBalance = Object.entries(accountMap)
        .map(([id, a]) => ({ id, ...a, net: a.debit - a.credit }))
        .sort((a, b) => a.code.localeCompare(b.code));

    // 2. Journal listing
    const journalListing = periodEntries.map(e => ({
        id: e.id,
        entryNumber: e.entryNumber,
        date: e.date,
        description: e.description,
        reference: e.reference,
        isBackdated: (e as any).isBackdated,
        isManual: !e.expenseId && !e.invoiceId && !e.saleId && !e.paymentId && !e.requisitionId && !e.monthlyBudgetId && !e.creditNoteId,
        lineCount: e.lines.length,
        totalDebit: e.lines.reduce((s, l) => s + l.debit, 0)
    })).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // 3. Sequence gap report
    const numberedEntries = journalListing
        .filter(e => e.entryNumber)
        .map(e => parseInt(e.entryNumber!.replace(/\D/g, ''), 10))
        .filter(n => !isNaN(n))
        .sort((a, b) => a - b);

    const gaps: number[] = [];
    const duplicates: number[] = [];
    const seen = new Set<number>();
    for (let i = 0; i < numberedEntries.length; i++) {
        const n = numberedEntries[i];
        if (seen.has(n)) duplicates.push(n);
        seen.add(n);
        if (i > 0 && n !== numberedEntries[i - 1] + 1) {
            for (let g = numberedEntries[i - 1] + 1; g < n; g++) gaps.push(g);
        }
    }

    // 4. Exception report
    const exceptions = {
        backdated: journalListing.filter(e => e.isBackdated),
        manualJournals: journalListing.filter(e => e.isManual),
        missingNumbers: journalListing.filter(e => !e.entryNumber),
        gaps,
        duplicates
    };

    // 5. Documents without postings
    const paidExpensesNoJE = await prisma.expense.findMany({
        where: {
            status: 'PAID',
            createdAt: { gte: startDate, lte: endDate },
            journalEntries: { none: {} }
        },
        select: { id: true, title: true, amount: true, paidAt: true }
    });

    const paidInvoicesNoJE = await prisma.invoice.findMany({
        where: {
            paymentStatus: 'PAID',
            paidAt: { gte: startDate, lte: endDate },
            journalEntries: { none: {} }
        },
        select: { id: true, invoiceNumber: true, amount: true, paidAt: true }
    });

    const totalDebits = trialBalance.reduce((s, a) => s + a.debit, 0);
    const totalCredits = trialBalance.reduce((s, a) => s + a.credit, 0);

    return NextResponse.json({
        period: {
            id: period.id,
            name: period.name,
            fiscalYear: period.fiscalYear.name,
            startDate,
            endDate,
            isClosed: period.isClosed
        },
        trialBalance,
        totals: { debit: totalDebits, credit: totalCredits, balanced: Math.abs(totalDebits - totalCredits) < 0.01 },
        journalListing,
        sequenceGaps: { gaps, duplicates },
        exceptions,
        orphanedDocuments: {
            expenses: paidExpensesNoJE,
            invoices: paidInvoicesNoJE
        }
    });
}
