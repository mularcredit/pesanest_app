import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import prisma from '@/lib/prisma';

export async function GET(req: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const q = req.nextUrl.searchParams.get('q')?.trim() ?? '';
    const browse = req.nextUrl.searchParams.get('browse') === 'true';

    // browse=true returns all contacts with phones; q filters them
    const take = browse ? 200 : 10;

    const makeWhere = (phoneField: string, fields: string[]) => {
        if (!q) return { [phoneField]: { not: null } };
        const search = { contains: q, mode: 'insensitive' as const };
        return { [phoneField]: { not: null }, OR: fields.map(f => ({ [f]: search })) };
    };

    if (!browse && q.length < 1) return NextResponse.json({ contacts: [] });

    const [users, customers, vendors] = await Promise.all([
        prisma.user.findMany({
            where: browse
                ? { isActive: true, phoneNumber: { not: null }, ...(q ? { OR: [{ name: { contains: q, mode: 'insensitive' } }, { phoneNumber: { contains: q } }] } : {}) }
                : { isActive: true, OR: [{ name: { contains: q, mode: 'insensitive' } }, { phoneNumber: { contains: q } }] },
            select: { id: true, name: true, email: true, phoneNumber: true, role: true },
            take,
            orderBy: { name: 'asc' },
        }),
        prisma.customer.findMany({
            where: browse
                ? { phone: { not: null }, ...(q ? { OR: [{ name: { contains: q, mode: 'insensitive' } }, { phone: { contains: q } }] } : {}) }
                : { OR: [{ name: { contains: q, mode: 'insensitive' } }, { phone: { contains: q } }] },
            select: { id: true, name: true, phone: true, email: true },
            take,
            orderBy: { name: 'asc' },
        }),
        prisma.vendor.findMany({
            where: browse
                ? { phone: { not: null }, ...(q ? { OR: [{ name: { contains: q, mode: 'insensitive' } }, { phone: { contains: q } }] } : {}) }
                : { OR: [{ name: { contains: q, mode: 'insensitive' } }, { phone: { contains: q } }] },
            select: { id: true, name: true, phone: true, email: true },
            take,
            orderBy: { name: 'asc' },
        }),
    ]);

    const contacts = [
        ...users
            .filter(u => u.phoneNumber)
            .map(u => ({
                id: `user-${u.id}`,
                name: u.name,
                phone: u.phoneNumber!,
                label: u.role?.toLowerCase().replace(/_/g, ' ') ?? 'user',
                type: 'user' as const,
            })),
        ...customers
            .filter(c => c.phone)
            .map(c => ({
                id: `customer-${c.id}`,
                name: c.name,
                phone: c.phone!,
                label: 'customer',
                type: 'customer' as const,
            })),
        ...vendors
            .filter(v => v.phone)
            .map(v => ({
                id: `vendor-${v.id}`,
                name: v.name,
                phone: v.phone!,
                label: 'vendor',
                type: 'vendor' as const,
            })),
    ];

    return NextResponse.json({ contacts });
}
