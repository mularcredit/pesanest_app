import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import prisma from '@/lib/prisma';
import { AccrualsClient } from './AccrualsClient';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Accrual Schedules | Pesanest' };

export default async function AccrualsPage() {
    const session = await auth();
    if (!session?.user) return redirect('/login');

    const [scheduleRows, recognitionRows, accounts] = await Promise.all([
        prisma.$queryRaw<any[]>`
            SELECT s.*,
                da.id as "da_id", da.code as "da_code", da.name as "da_name",
                ca.id as "ca_id", ca.code as "ca_code", ca.name as "ca_name"
            FROM "AccrualSchedule" s
            LEFT JOIN "Account" da ON s."debitAccountId" = da.id
            LEFT JOIN "Account" ca ON s."creditAccountId" = ca.id
            ORDER BY s."createdAt" DESC
        `.catch(() => []),
        prisma.$queryRaw<any[]>`
            SELECT * FROM "AccrualRecognition" ORDER BY "periodDate" ASC
        `.catch(() => []),
        prisma.account.findMany({
            where: { isActive: true },
            orderBy: { code: 'asc' },
            select: { id: true, code: true, name: true, type: true }
        })
    ]);

    const schedules = scheduleRows.map((s: any) => ({
        ...s,
        debitAccount: { id: s.da_id, code: s.da_code, name: s.da_name },
        creditAccount: { id: s.ca_id, code: s.ca_code, name: s.ca_name },
        recognitions: recognitionRows.filter((r: any) => r.scheduleId === s.id),
    }));

    return (
        <div className="p-6 md:p-8 space-y-8 min-h-screen">
            <div>
                <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Accrual Schedules</h1>
                <p className="text-gray-500">Manage prepayments, accruals, and deferred income recognition.</p>
            </div>
            <AccrualsClient schedules={schedules} accounts={accounts} />
        </div>
    );
}
