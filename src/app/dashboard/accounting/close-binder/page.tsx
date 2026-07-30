import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import prisma from '@/lib/prisma';
import { CloseBinder } from './CloseBinder';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Close Binder | Pesanest' };

export default async function ClosebinderPage() {
    const session = await auth();
    if (!session?.user) return redirect('/login');

    const fiscalYears = await (prisma as any).fiscalYear.findMany({
        include: { periods: { orderBy: { startDate: 'desc' } } },
        orderBy: { startDate: 'desc' }
    });

    return (
        <div className="p-6 md:p-8 space-y-8 min-h-screen">
            <div>
                <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Close Binder</h1>
                <p className="text-gray-500">Period-end TB snapshot, journal listing, sequence gaps, and exception report.</p>
            </div>
            <CloseBinder fiscalYears={fiscalYears} />
        </div>
    );
}
