import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import prisma from '@/lib/prisma';

export async function PATCH(req: NextRequest) {
    const session = await auth();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const role = (session.user as any).role;
    const isAdmin = role === 'SYSTEM_ADMIN' || role === 'ADMIN' || role === 'FINANCE_MANAGER';
    if (!isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json();
    const { ids, subtype } = body as { ids: string[]; subtype: string };

    if (!Array.isArray(ids) || ids.length === 0) {
        return NextResponse.json({ error: 'No account IDs provided' }, { status: 400 });
    }

    const result = await prisma.account.updateMany({
        where: { id: { in: ids } },
        data: { subtype: subtype?.trim() || null },
    });

    return NextResponse.json({ updated: result.count });
}
