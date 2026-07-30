import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";

// POST /api/accounting/periods/[id]/snapshot
// Generates a PeriodBalance snapshot for every GL account for the given period.
// Idempotent — re-running overwrites the existing snapshot.
export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { role: true, customRole: { select: { isSystem: true } } }
    });
    if (user?.role !== 'SYSTEM_ADMIN' && !user?.customRole?.isSystem) {
        return NextResponse.json({ error: "System Admins only" }, { status: 403 });
    }

    const { id: periodId } = await props.params;

    const period = await prisma.accountingPeriod.findUnique({ where: { id: periodId } });
    if (!period) return NextResponse.json({ error: "Period not found" }, { status: 404 });

    // Get all accounts
    const accounts = await prisma.account.findMany({ where: { isArchived: false } } as any);

    // Lines in this period
    const periodLines = await (prisma as any).journalLine.findMany({
        where: {
            entry: {
                status: 'POSTED',
                date: { gte: period.startDate, lte: period.endDate }
            }
        },
        select: { accountId: true, debit: true, credit: true }
    });

    // Lines before this period (for opening balances)
    const priorLines = await (prisma as any).journalLine.findMany({
        where: {
            entry: {
                status: 'POSTED',
                date: { lt: period.startDate }
            }
        },
        select: { accountId: true, debit: true, credit: true }
    });

    type Bal = { debit: number; credit: number };
    const sumLines = (lines: any[]): Record<string, Bal> => {
        const m: Record<string, Bal> = {};
        for (const l of lines) {
            if (!m[l.accountId]) m[l.accountId] = { debit: 0, credit: 0 };
            m[l.accountId].debit += Number(l.debit);
            m[l.accountId].credit += Number(l.credit);
        }
        return m;
    };

    const priorMap = sumLines(priorLines);
    const periodMap = sumLines(periodLines);

    // Upsert snapshots
    let snapshotCount = 0;
    for (const acct of accounts) {
        const prior = priorMap[acct.id] || { debit: 0, credit: 0 };
        const period_ = periodMap[acct.id] || { debit: 0, credit: 0 };

        await (prisma as any).periodBalance.upsert({
            where: { periodId_accountId: { periodId, accountId: acct.id } },
            create: {
                periodId,
                accountId: acct.id,
                openingDebit: prior.debit,
                openingCredit: prior.credit,
                periodDebit: period_.debit,
                periodCredit: period_.credit,
                closingDebit: prior.debit + period_.debit,
                closingCredit: prior.credit + period_.credit,
            },
            update: {
                openingDebit: prior.debit,
                openingCredit: prior.credit,
                periodDebit: period_.debit,
                periodCredit: period_.credit,
                closingDebit: prior.debit + period_.debit,
                closingCredit: prior.credit + period_.credit,
                snapshotAt: new Date(),
            }
        });
        snapshotCount++;
    }

    return NextResponse.json({ ok: true, periodId, accountsSnapshotted: snapshotCount });
}
