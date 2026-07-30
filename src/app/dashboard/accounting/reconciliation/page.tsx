import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import prisma from '@/lib/prisma';
import { BankReconciliationClient } from '@/components/accounting/BankReconciliationClient';

const CARD_STYLE: React.CSSProperties = { border: '1px solid rgba(0,0,0,0.09)' };

export default async function BankReconciliationPage() {
    const session = await auth();
    if (!session?.user) return redirect("/login");

    const cashAccount = await prisma.account.findFirst({
        where: { code: '1000' }
    });

    if (!cashAccount) {
        return (
            <div className="space-y-6 pb-24">
                <div>
                    <h1 className="text-[20px] font-[600] text-gray-900 tracking-tight">Bank Reconciliation</h1>
                </div>
                <div className="bg-white rounded-[8px] py-16 flex flex-col items-center text-center" style={CARD_STYLE}>
                    <p className="text-[13px] font-[500] text-rose-600 mb-1">
                        Cash Account (1000) not found in Chart of Accounts.
                    </p>
                    <p className="text-[12px] text-gray-400">Please create it first.</p>
                </div>
            </div>
        );
    }

    const journalLines = await prisma.journalLine.findMany({
        where: {
            accountId: cashAccount.id,
            entry: { status: 'POSTED' }
        },
        include: { entry: true },
        orderBy: { entry: { date: 'desc' } },
        take: 100
    });

    const glBalance = journalLines.reduce((balance, line) => {
        return balance + (line.debit - line.credit);
    }, 0);

    return (
        <div className="space-y-6 pb-24">
            <div className="flex items-start justify-between pb-5"
                style={{ borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
                <div>
                    <h1 className="text-[20px] font-[600] text-gray-900 tracking-tight">Bank Reconciliation</h1>
                    <p className="text-[12.5px] text-gray-400 mt-0.5">
                        Match your bank statement with the General Ledger ({cashAccount.name})
                    </p>
                </div>
                <div className="bg-white rounded-[8px] px-5 py-3 text-right shrink-0" style={CARD_STYLE}>
                    <p className="text-[10.5px] font-[500] text-gray-400 uppercase tracking-[0.06em] mb-1">GL Cash Balance</p>
                    <p className="text-[20px] font-[600] text-gray-900">
                        KES {glBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                </div>
            </div>

            <BankReconciliationClient
                cashAccountId={cashAccount.id}
                glBalance={glBalance}
                currency={cashAccount.currency}
                journalLines={journalLines.map(line => ({
                    id: line.id,
                    date: line.entry.date.toISOString(),
                    description: line.entry.description,
                    reference: line.entry.reference || '',
                    debit: line.debit,
                    credit: line.credit,
                    amount: line.debit > 0 ? line.debit : -line.credit
                }))}
            />
        </div>
    );
}
