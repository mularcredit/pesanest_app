import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import prisma from '@/lib/prisma';
import { SmsPageClient } from './SmsPageClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function SmsPage() {
    const session = await auth();
    if (!session?.user?.id) return redirect('/login');

    const [logs, stats] = await Promise.all([
        (prisma as any).smsLog.findMany({
            orderBy: { createdAt: 'desc' },
            take: 20,
        }),
        (prisma as any).smsLog.groupBy({
            by: ['status'],
            _count: { status: true },
        }),
    ]);

    const statsMap = (stats as any[]).reduce(
        (acc: any, s: any) => { acc[s.status] = s._count.status; return acc; },
        { SENT: 0, FAILED: 0, STUB: 0 }
    );
    const total = Object.values(statsMap).reduce((a: any, b: any) => a + b, 0);

    const isStub = process.env.CELCOM_SMS_STUB === 'true';
    const shortcode = process.env.CELCOM_SHORTCODE ?? 'MularCredit';
    const partnerId = process.env.CELCOM_PARTNER_ID ?? '';

    return (
        <SmsPageClient
            initialLogs={JSON.parse(JSON.stringify(logs))}
            stats={{ ...statsMap, total }}
            config={{ isStub, shortcode, partnerId }}
        />
    );
}
