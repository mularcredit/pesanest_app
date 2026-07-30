import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import prisma from '@/lib/prisma';
import { JournalApprovalsClient } from './JournalApprovalsClient';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Journal Approvals | Pesanest' };

export default async function JournalApprovalsPage() {
    const session = await auth();
    if (!session?.user) return redirect('/login');

    const drafts = await prisma.journalEntry.findMany({
        where: { status: { in: ['DRAFT', 'PENDING_APPROVAL'] } },
        include: { lines: { include: { account: { select: { code: true, name: true } } } } },
        orderBy: { createdAt: 'desc' }
    });

    return (
        <div className="p-6 md:p-8 space-y-8 min-h-screen">
            <div>
                <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Journal Approvals</h1>
                <p className="text-gray-500">Review and approve draft manual journal entries before they post to the ledger.</p>
            </div>
            <JournalApprovalsClient drafts={drafts} />
        </div>
    );
}
