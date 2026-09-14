import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { findDuplicateJournalEntries } from '@/lib/accounting/duplicate-detection';
import { DuplicateEntriesClient } from './DuplicateEntriesClient';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Duplicate Entries | Pesanest' };

export default async function DuplicateEntriesPage() {
    const session = await auth();
    if (!session?.user) return redirect('/login');

    const { highConfidence, needsReview } = await findDuplicateJournalEntries();

    return (
        <div className="p-6 md:p-8 space-y-8 min-h-screen">
            <div>
                <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Duplicate Entries</h1>
                <p className="text-gray-500">
                    Posted journal entries that reference the same requisition, asset, or expense more than once,
                    or that otherwise look like the same transaction posted twice.
                </p>
            </div>
            <DuplicateEntriesClient highConfidence={highConfidence} needsReview={needsReview} />
        </div>
    );
}
