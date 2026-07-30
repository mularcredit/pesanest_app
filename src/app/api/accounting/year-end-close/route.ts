/**
 * POST /api/accounting/year-end-close
 *
 * Posts year-end closing entries for a fiscal year:
 *   1. Closes all revenue accounts (4xxx) to Income Summary (3900).
 *   2. Closes all expense accounts (5xxx, 6xxx, 7xxx) to Income Summary (3900).
 *   3. Closes Income Summary (net income/loss) to Retained Earnings (3200).
 *
 * Requires SYSTEM_ADMIN.
 * Idempotent: skips if closing entries already posted for the fiscal year.
 * The fiscal year must have all periods closed before this runs.
 *
 * Body: { fiscalYearId: string }
 */

import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { AccountingEngine } from "@/lib/accounting/accounting-engine";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { role: true, customRole: { select: { isSystem: true } } }
    });
    if (user?.role !== 'SYSTEM_ADMIN' && !user?.customRole?.isSystem) {
        return NextResponse.json({ error: "Only System Admins can run year-end close" }, { status: 403 });
    }

    const { fiscalYearId } = await req.json();
    if (!fiscalYearId) return NextResponse.json({ error: "fiscalYearId is required" }, { status: 400 });

    const fiscalYear = await (prisma as any).fiscalYear.findUnique({
        where: { id: fiscalYearId },
        include: { periods: true }
    });
    if (!fiscalYear) return NextResponse.json({ error: "Fiscal year not found" }, { status: 404 });

    // All periods must be closed
    const openPeriods = fiscalYear.periods.filter((p: any) => !p.isClosed);
    if (openPeriods.length > 0) {
        return NextResponse.json({
            error: `Cannot close fiscal year: ${openPeriods.length} period(s) still open`,
            openPeriods: openPeriods.map((p: any) => p.name)
        }, { status: 422 });
    }

    // Idempotency: check for existing closing entries
    const closingRef = `YEARCLOSE-${fiscalYearId}`;
    const existing = await prisma.journalEntry.findFirst({ where: { reference: closingRef } });
    if (existing) {
        return NextResponse.json({ error: "Year-end closing entries already posted", entryId: existing.id }, { status: 409 });
    }

    const fyStart = fiscalYear.startDate;
    const fyEnd = fiscalYear.endDate;

    // Compute period balances for all P&L accounts
    const lines = await prisma.journalLine.findMany({
        where: { entry: { date: { gte: fyStart, lte: fyEnd }, status: 'POSTED' } },
        include: { account: { select: { id: true, code: true, name: true, type: true } } }
    });

    // Aggregate by account
    const balances: Record<string, { account: any; net: number }> = {};
    for (const line of lines) {
        const id = line.accountId;
        if (!balances[id]) balances[id] = { account: line.account, net: 0 };
        balances[id].net += line.debit - line.credit;
    }

    // Revenue accounts: type REVENUE (credit-normal, so net will be negative in Dr-Cr terms)
    // Expense accounts: type EXPENSE (debit-normal, net will be positive)
    const revenueAccounts = Object.values(balances).filter(b => b.account.type === 'REVENUE' && b.net !== 0);
    const expenseAccounts = Object.values(balances).filter(b => b.account.type === 'EXPENSE' && b.net !== 0);

    if (!revenueAccounts.length && !expenseAccounts.length) {
        return NextResponse.json({ message: "No P&L account activity in this fiscal year — nothing to close" });
    }

    // Resolve or auto-create Retained Earnings (3200) and Income Summary (3900)
    let retainedEarnings = await prisma.account.findFirst({ where: { code: '3200' } });
    if (!retainedEarnings) {
        retainedEarnings = await prisma.account.create({
            data: { code: '3200', name: 'Retained Earnings', type: 'EQUITY', currency: 'KES' }
        });
    }

    let incomeSummary = await prisma.account.findFirst({ where: { code: '3900' } });
    if (!incomeSummary) {
        incomeSummary = await prisma.account.create({
            data: { code: '3900', name: 'Income Summary', type: 'EQUITY', currency: 'KES' }
        });
    }

    const closingDate = new Date(fyEnd);
    const journalLines: { accountId: string; debit: number; credit: number; description?: string }[] = [];

    // Close revenue accounts: Dr Revenue / Cr Income Summary
    for (const { account, net } of revenueAccounts) {
        // net is Dr - Cr. Revenue is credit-normal so net < 0 means there's a credit balance.
        // To close: Debit the revenue account (zero it out), Credit Income Summary
        if (net < 0) {
            journalLines.push({ accountId: account.id, debit: Math.abs(net), credit: 0, description: `Close ${account.name}` });
            journalLines.push({ accountId: incomeSummary!.id, debit: 0, credit: Math.abs(net), description: `Close ${account.name}` });
        }
    }

    // Close expense accounts: Dr Income Summary / Cr Expense
    for (const { account, net } of expenseAccounts) {
        // Expenses are debit-normal so net > 0 means debit balance.
        if (net > 0) {
            journalLines.push({ accountId: incomeSummary!.id, debit: net, credit: 0, description: `Close ${account.name}` });
            journalLines.push({ accountId: account.id, debit: 0, credit: net, description: `Close ${account.name}` });
        }
    }

    // Net income = total revenue credits - total expense debits
    const totalRevenue = revenueAccounts.filter(b => b.net < 0).reduce((s, b) => s + Math.abs(b.net), 0);
    const totalExpenses = expenseAccounts.filter(b => b.net > 0).reduce((s, b) => s + b.net, 0);
    const netIncome = totalRevenue - totalExpenses;

    // Close Income Summary to Retained Earnings
    if (netIncome > 0) {
        // Net income: Dr Income Summary / Cr Retained Earnings
        journalLines.push({ accountId: incomeSummary!.id, debit: netIncome, credit: 0, description: 'Close net income to Retained Earnings' });
        journalLines.push({ accountId: retainedEarnings.id, debit: 0, credit: netIncome, description: 'Net income' });
    } else if (netIncome < 0) {
        // Net loss: Dr Retained Earnings / Cr Income Summary
        journalLines.push({ accountId: retainedEarnings.id, debit: Math.abs(netIncome), credit: 0, description: 'Net loss' });
        journalLines.push({ accountId: incomeSummary!.id, debit: 0, credit: Math.abs(netIncome), description: 'Close net loss to Retained Earnings' });
    }

    if (!journalLines.length) {
        return NextResponse.json({ message: "Nothing to close" });
    }

    const entry = await AccountingEngine.postJournalEntry({
        date: closingDate,
        description: `Year-end closing entries — ${fiscalYear.name}`,
        reference: closingRef,
        userId: session.user.id,
        lines: journalLines
    });

    // Mark fiscal year closed
    await (prisma as any).fiscalYear.update({
        where: { id: fiscalYearId },
        data: { isClosed: true }
    });

    await (prisma as any).auditLog.create({
        data: {
            actorId: session.user.id,
            action: 'YEAR_END_CLOSE',
            entity: 'FiscalYear',
            entityId: fiscalYearId,
            after: { fiscalYear: fiscalYear.name, netIncome, journalEntryId: entry.id }
        }
    });

    return NextResponse.json({ entryId: entry.id, entryNumber: entry.entryNumber, netIncome, totalRevenue, totalExpenses });
}
