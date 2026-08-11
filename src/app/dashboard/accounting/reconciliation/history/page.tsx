import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import prisma from '@/lib/prisma';
import { BankAccountPicker } from '../BankAccountPicker';
import { StatementHistoryCard, type HistoryStatement } from './StatementHistoryCard';
import { PiArrowLeft } from 'react-icons/pi';

const CARD_STYLE: React.CSSProperties = { border: '1px solid rgba(0,0,0,0.09)' };

export default async function ReconciliationHistoryPage({
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
            select: { id: true, name: true, bankName: true, currency: true },
            orderBy: { name: 'asc' },
        }),
        prisma.paybillAccount.findMany({
            where: { isActive: true },
            select: { id: true, name: true, paybillNumber: true },
            orderBy: { name: 'asc' },
        }),
    ]);

    const accounts = [
        ...bankRows.map(b => ({ id: b.id, kind: 'BANK' as const, label: `${b.name} — ${b.bankName}`, currency: b.currency })),
        ...paybillRows.map(p => ({ id: p.id, kind: 'PAYBILL' as const, label: `${p.name} — ${p.paybillNumber}`, currency: 'KES' })),
    ];

    if (accounts.length === 0) {
        return (
            <div className="space-y-6 pb-24">
                <h1 className="text-[20px] font-[600] text-gray-900 tracking-tight">Reconciliation History</h1>
                <div className="bg-white rounded-[8px] py-16 flex flex-col items-center text-center gap-2" style={CARD_STYLE}>
                    <p className="text-[13px] font-[500] text-gray-900">No bank or paybill accounts set up yet</p>
                </div>
            </div>
        );
    }

    const account = accounts.find(a => a.id === requestedId) || accounts[0];

    const statements = await prisma.bankStatement.findMany({
        where: { OR: [{ bankAccountId: account.id }, { paybillAccountId: account.id }] },
        include: { lines: { include: { matches: true }, orderBy: { transactionDate: 'asc' } } },
        orderBy: { importedAt: 'desc' },
    });

    // ReconciliationMatch has no relation to JournalEntry (plain id) — resolve
    // both the matched entries and the matchers in two batched lookups.
    const journalEntryIds = Array.from(new Set(
        statements.flatMap(s => s.lines.flatMap(l => l.matches.map(m => m.journalEntryId)))
    ));
    const matcherIds = Array.from(new Set(
        statements.flatMap(s => s.lines.flatMap(l => l.matches.map(m => m.matchedBy).filter((x): x is string => !!x)))
    ));

    const [entries, matchers] = await Promise.all([
        journalEntryIds.length
            ? prisma.journalEntry.findMany({ where: { id: { in: journalEntryIds } }, select: { id: true, entryNumber: true, description: true, date: true } })
            : Promise.resolve([]),
        matcherIds.length
            ? prisma.user.findMany({ where: { id: { in: matcherIds } }, select: { id: true, name: true } })
            : Promise.resolve([]),
    ]);
    const entryMap = new Map(entries.map(e => [e.id, e]));
    const matcherMap = new Map(matchers.map(m => [m.id, m.name]));

    const historyStatements: HistoryStatement[] = statements.map(s => ({
        id: s.id,
        periodStart: s.periodStart.toISOString(),
        periodEnd: s.periodEnd.toISOString(),
        importedAt: s.importedAt.toISOString(),
        importedByName: s.importedBy ? matcherMap.get(s.importedBy) || null : null,
        lines: s.lines.map(l => {
            // A split match (one bank line grouped against several book entries)
            // gives this line one ReconciliationMatch row per entry — surface all of them.
            const credit = Number(l.credit);
            const debit = Number(l.debit);
            return {
                id: l.id,
                date: l.transactionDate.toISOString(),
                description: l.description,
                amount: credit > 0 ? credit : -debit,
                isMatched: l.isMatched,
                matches: l.matches.map(match => {
                    const entry = entryMap.get(match.journalEntryId);
                    return {
                        matchedAt: match.matchedAt.toISOString(),
                        matchedByName: match.matchedBy ? matcherMap.get(match.matchedBy) || null : null,
                        matchType: match.matchType,
                        entryNumber: entry?.entryNumber || null,
                        entryDescription: entry?.description || null,
                        entryDate: entry?.date ? entry.date.toISOString() : null,
                    };
                }),
            };
        }),
    }));

    const totalMatched = historyStatements.reduce((s, st) => s + st.lines.filter(l => l.isMatched).length, 0);
    const totalUnmatched = historyStatements.reduce((s, st) => s + st.lines.filter(l => !l.isMatched).length, 0);

    return (
        <div className="space-y-6 pb-24">
            <div className="flex items-start justify-between pb-5 flex-wrap gap-3"
                style={{ borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
                <div>
                    <Link href={`/dashboard/accounting/reconciliation?bankAccountId=${account.id}`}
                        className="inline-flex items-center gap-1.5 text-[11.5px] font-[500] text-gray-400 hover:text-gray-700 transition-colors mb-1.5">
                        <PiArrowLeft className="text-[12px]" /> Back to reconciliation
                    </Link>
                    <h1 className="text-[20px] font-[600] text-gray-900 tracking-tight">Reconciliation History</h1>
                    <p className="text-[12.5px] text-gray-400 mt-0.5">
                        Every statement ever imported for this account, and what each transaction matched to
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <BankAccountPicker accounts={accounts} value={account.id} basePath="/dashboard/accounting/reconciliation/history" />
                </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
                <div className="bg-white rounded-[8px] px-5 py-4" style={CARD_STYLE}>
                    <p className="text-[10px] font-[600] uppercase tracking-[0.09em] text-gray-400 mb-2">Statements imported</p>
                    <p className="text-[20px] font-[700] text-gray-900 tabular-nums">{historyStatements.length}</p>
                </div>
                <div className="bg-white rounded-[8px] px-5 py-4" style={CARD_STYLE}>
                    <p className="text-[10px] font-[600] uppercase tracking-[0.09em] text-emerald-600 mb-2">Matched transactions</p>
                    <p className="text-[20px] font-[700] text-gray-900 tabular-nums">{totalMatched}</p>
                </div>
                <div className="bg-white rounded-[8px] px-5 py-4" style={CARD_STYLE}>
                    <p className="text-[10px] font-[600] uppercase tracking-[0.09em] text-amber-600 mb-2">Still open</p>
                    <p className="text-[20px] font-[700] text-gray-900 tabular-nums">{totalUnmatched}</p>
                </div>
            </div>

            {historyStatements.length === 0 ? (
                <div className="bg-white rounded-[8px] py-16 flex flex-col items-center text-center gap-2" style={CARD_STYLE}>
                    <p className="text-[13px] font-[500] text-gray-900">No statements imported yet for this account</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {historyStatements.map((s, i) => (
                        <StatementHistoryCard key={s.id} statement={s} currency={account.currency} defaultOpen={i === 0} />
                    ))}
                </div>
            )}
        </div>
    );
}
