
import { NextResponse } from 'next/server';
import { QuickBooksService } from '@/lib/integrations/quickbooks';
import { auth } from '@/auth';
import prisma from '@/lib/prisma';

export async function GET() {
    try {
        const session = await auth();
        if (!session?.user || (session.user as any).role !== 'SYSTEM_ADMIN') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const qboAccounts = await QuickBooksService.fetchAccounts();
        const internalAccounts = await prisma.account.findMany({
            orderBy: { code: 'asc' }
        });

        return NextResponse.json({ qboAccounts, internalAccounts });
    } catch (error: any) {
        console.error('Fetch QBO accounts error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const session = await auth();
        if (!session?.user || (session.user as any).role !== 'SYSTEM_ADMIN') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { mapping } = await req.json(); // { internalAccountId: qboAccountId }
        
        const updates = Object.entries(mapping).map(([id, qboId]) => {
            return prisma.account.update({
                where: { id },
                data: { qboId: qboId as string }
            });
        });

        await prisma.$transaction(updates);

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
