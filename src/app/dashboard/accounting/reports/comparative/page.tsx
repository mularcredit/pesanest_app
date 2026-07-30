import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { ComparativeReportClient } from './ComparativeReportClient';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Comparative Reports | Pesanest' };

export default async function ComparativeReportPage() {
    const session = await auth();
    if (!session?.user) return redirect('/login');
    return (
        <div className="p-6 md:p-8 space-y-8 min-h-screen">
            <div>
                <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Comparative Reports</h1>
                <p className="text-gray-500">Side-by-side P&amp;L or Balance Sheet for two periods with variance.</p>
            </div>
            <ComparativeReportClient />
        </div>
    );
}
