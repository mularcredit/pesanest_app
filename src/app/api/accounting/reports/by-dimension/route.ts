import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";

// GET /api/accounting/reports/by-dimension?startDate=&endDate=&costCentreId=
export async function GET(req: Request) {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const startDate = searchParams.get('startDate') ? new Date(searchParams.get('startDate')!) : new Date(new Date().getFullYear(), 0, 1);
    const endDate = searchParams.get('endDate') ? new Date(searchParams.get('endDate')!) : new Date();
    const costCentreId = searchParams.get('costCentreId') || undefined;

    const costCentres = await (prisma as any).costCentre.findMany({ orderBy: { code: 'asc' } });

    // Build the where clause for journal lines via entries
    const entryWhere: any = {
        status: 'POSTED',
        date: { gte: startDate, lte: endDate }
    };

    const lineWhere: any = costCentreId ? { costCentreId } : {};

    const lines = await (prisma as any).journalLine.findMany({
        where: {
            ...lineWhere,
            entry: entryWhere
        },
        include: {
            account: true,
            costCentre: true,
            entry: { select: { date: true, description: true, entryNumber: true } }
        }
    });

    // Group by costCentre → account type → account
    const report: Record<string, {
        costCentre: any;
        revenue: number;
        expenses: number;
        netIncome: number;
        accounts: Record<string, { account: any; debit: number; credit: number; net: number }>;
    }> = {};

    const noCCKey = '__UNTAGGED__';

    for (const line of lines) {
        const key = line.costCentreId || noCCKey;
        if (!report[key]) {
            report[key] = {
                costCentre: line.costCentre || { id: noCCKey, code: '—', name: 'Untagged' },
                revenue: 0,
                expenses: 0,
                netIncome: 0,
                accounts: {}
            };
        }
        const acc = line.account;
        if (!report[key].accounts[acc.id]) {
            report[key].accounts[acc.id] = { account: acc, debit: 0, credit: 0, net: 0 };
        }
        report[key].accounts[acc.id].debit += line.debit;
        report[key].accounts[acc.id].credit += line.credit;
    }

    for (const entry of Object.values(report)) {
        for (const a of Object.values(entry.accounts)) {
            a.net = a.credit - a.debit;
            if (a.account.type === 'REVENUE') entry.revenue += a.net;
            if (a.account.type === 'EXPENSE') entry.expenses += (a.debit - a.credit);
        }
        entry.netIncome = entry.revenue - entry.expenses;
        (entry as any).accounts = Object.values(entry.accounts);
    }

    return NextResponse.json({
        startDate, endDate,
        costCentres,
        segments: Object.values(report).sort((a, b) =>
            (a.costCentre.code || '').localeCompare(b.costCentre.code || ''))
    });
}
