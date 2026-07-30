import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { AgingClient } from './AgingClient';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'AR / AP Aging | Pesanest' };

export default async function AgingPage() {
    const session = await auth();
    if (!session?.user) return redirect('/login');
    return (
        <div className="space-y-5 pb-24">
            <div>
                <h1 className="text-[20px] font-[600] text-gray-900 tracking-tight">AR / AP Aging</h1>
                <p className="text-[12.5px] text-gray-400 mt-0.5">
                    Aged receivables and payables with GL control-account tie-out.
                </p>
            </div>
            <AgingClient />
        </div>
    );
}
