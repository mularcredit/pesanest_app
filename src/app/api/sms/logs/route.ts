import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import prisma from '@/lib/prisma';

export async function GET(req: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = req.nextUrl;
    const page   = Math.max(1, parseInt(searchParams.get('page') ?? '1'));
    const limit  = Math.min(50, parseInt(searchParams.get('limit') ?? '20'));
    const status = searchParams.get('status') ?? undefined;
    const event  = searchParams.get('event') ?? undefined;

    const where: any = {};
    if (status) where.status = status;
    if (event)  where.event  = event;

    const [logs, total, stats] = await Promise.all([
        (prisma as any).smsLog.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            skip: (page - 1) * limit,
            take: limit,
        }),
        (prisma as any).smsLog.count({ where }),
        (prisma as any).smsLog.groupBy({
            by: ['status'],
            _count: { status: true },
        }),
    ]);

    const statsMap = (stats as any[]).reduce((acc: any, s: any) => {
        acc[s.status] = s._count.status;
        return acc;
    }, { SENT: 0, FAILED: 0, STUB: 0 });

    return NextResponse.json({
        logs,
        total,
        page,
        pages: Math.ceil(total / limit),
        stats: statsMap,
    });
}
