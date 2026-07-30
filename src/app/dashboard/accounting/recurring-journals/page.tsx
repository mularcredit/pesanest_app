import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import prisma from '@/lib/prisma';
import { RecurringJournalsClient } from './RecurringJournalsClient';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Recurring Journals | Pesanest' };

export default async function RecurringJournalsPage() {
    const session = await auth();
    if (!session?.user) return redirect('/login');

    const [templates, accounts] = await Promise.all([
        (prisma as any).recurringJournalTemplate.findMany({
            include: {
                lines: {
                    include: { account: { select: { id: true, code: true, name: true } } }
                }
            },
            orderBy: { nextRunDate: 'asc' }
        }),
        prisma.account.findMany({
            where: { isActive: true },
            orderBy: { code: 'asc' },
            select: { id: true, code: true, name: true, type: true }
        })
    ]);

    return (
        <div className="p-6 md:p-8 space-y-8 min-h-screen">
            <div>
                <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Recurring Journals</h1>
                <p className="text-gray-500">Set up repeating journal entries that post automatically on a schedule.</p>
            </div>
            <RecurringJournalsClient templates={templates} accounts={accounts} />
        </div>
    );
}
