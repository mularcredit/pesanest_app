import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import prisma from '@/lib/prisma';
import { BankReconciliationClient } from '@/components/accounting/BankReconciliationClient';
import { BankAccountPicker } from './BankAccountPicker';

const CARD_STYLE: React.CSSProperties = { border: '1px solid rgba(0,0,0,0.09)' };

export default async function BankReconciliationPage({
    searchParams,
}: {
    searchParams: Promise<{ bankAccountId?: string }>;
}) {
    const session = await auth();
    if (!session?.user) return redirect("/login");

    const { bankAccountId: requestedId } = await searchParams;

    const [bankRows, paybillRows] = await Promise.all([
        prisma.bankAccount.findMany({
            where: { isActive: true },
            select: { id: true, name: true, bankName: true, currency: true, glAccountId: true },
            orderBy: { name: 'asc' },
        }),
        prisma.paybillAccount.findMany({
            where: { isActive: true },
            select: { id: true, name: true, paybillNumber: true, glAccountId: true },
            orderBy: { name: 'asc' },
        }),
    ]);

    const accounts = [
        ...bankRows.map(b => ({ id: b.id, kind: 'BANK' as const, label: `${b.name} — ${b.bankName}`, currency: b.currency, glAccountId: b.glAccountId })),
        ...paybillRows.map(p => ({ id: p.id, kind: 'PAYBILL' as const, label: `${p.name} — ${p.paybillNumber}`, currency: 'KES', glAccountId: p.glAccountId })),
    ];

    if (accounts.length === 0) {
        return (
            <div className="space-y-6 pb-24">
                <div>
                    <h1 className="text-[20px] font-[600] text-gray-900 tracking-tight">Bank Reconciliation</h1>
                </div>
                <div className="bg-white rounded-[8px] py-16 flex flex-col items-center text-center gap-2" style={CARD_STYLE}>
                    <p className="text-[13px] font-[500] text-gray-900">No bank or paybill accounts set up yet</p>
                    <p className="text-[12px] text-gray-400 max-w-sm">
                        Reconciliation runs against a specific account's ledger. Add one from Transfers first.
                    </p>
                    <Link href="/dashboard/transfers"
                        className="mt-2 px-4 py-2 rounded-[6px] text-[12.5px] font-[500] text-white bg-[#6366F1] hover:bg-indigo-600 transition-colors">
                        Go to Transfers
                    </Link>
                </div>
            </div>
        );
    }

    const account = accounts.find(a => a.id === requestedId) || accounts[0];

    const glBalanceAgg = await prisma.journalLine.aggregate({
        where: { accountId: account.glAccountId, entry: { status: 'POSTED' } },
        _sum: { debit: true, credit: true },
    });
    const glBalance = (glBalanceAgg._sum.debit || 0) - (glBalanceAgg._sum.credit || 0);

    // Same "still open" definition the reconciliation API uses: a GL line whose
    // entry has no ReconciliationMatch yet.
    const [glLines, matchedEntryIds, unmatchedStatementLines] = await Promise.all([
        prisma.journalLine.findMany({
            where: { accountId: account.glAccountId, entry: { status: 'POSTED' } },
            include: { entry: { select: { id: true, entryNumber: true, date: true, description: true, reference: true } } },
            orderBy: { entry: { date: 'desc' } },
            take: 300,
        }),
        prisma.reconciliationMatch.findMany({ select: { journalEntryId: true } }),
        prisma.bankStatementLine.findMany({
            where: { isMatched: false, statement: { OR: [{ bankAccountId: account.id }, { paybillAccountId: account.id }] } },
            orderBy: { transactionDate: 'asc' },
        }),
    ]);

    const matchedSet = new Set(matchedEntryIds.map(m => m.journalEntryId));
    const unmatchedGlLines = glLines.filter(l => !matchedSet.has(l.entryId));

    return (
        <div className="space-y-6 pb-24">
            <div className="flex items-start justify-between pb-5 flex-wrap gap-3"
                style={{ borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
                <div>
                    <h1 className="text-[20px] font-[600] text-gray-900 tracking-tight">Bank Reconciliation</h1>
                    <p className="text-[12.5px] text-gray-400 mt-0.5">
                        Match a bank statement import against the General Ledger
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <BankAccountPicker accounts={accounts} value={account.id} />
                    <div className="bg-white rounded-[8px] px-5 py-3 text-right shrink-0" style={CARD_STYLE}>
                        <p className="text-[10.5px] font-[500] text-gray-400 uppercase tracking-[0.06em] mb-1">GL Balance</p>
                        <p className="text-[20px] font-[600] text-gray-900">
                            {account.currency} {glBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                    </div>
                </div>
            </div>

            <BankReconciliationClient
                key={account.id}
                bankAccountId={account.id}
                glBalance={glBalance}
                currency={account.currency}
                journalLines={unmatchedGlLines.map(line => ({
                    id: line.id,
                    entryId: line.entryId,
                    date: line.entry.date.toISOString(),
                    description: line.entry.description,
                    reference: line.entry.reference || '',
                    debit: line.debit,
                    credit: line.credit,
                    amount: line.debit > 0 ? line.debit : -line.credit,
                }))}
                initialStatementLines={unmatchedStatementLines.map(l => {
                    const credit = Number(l.credit);
                    const debit = Number(l.debit);
                    return {
                        id: l.id,
                        date: l.transactionDate.toISOString(),
                        description: l.description,
                        amount: credit > 0 ? credit : -debit,
                        statementId: l.statementId,
                    };
                })}
            />
        </div>
    );
}
