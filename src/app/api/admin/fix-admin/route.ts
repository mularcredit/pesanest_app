import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import bcrypt from 'bcryptjs';

export async function GET() {
    try {
        const email = 'admin@payridge.co.ke';
        const password = 'Admin@123';
        const hash = await bcrypt.hash(password, 12);

        const user = await prisma.user.upsert({
            where: { email },
            update: { password: hash, role: 'SYSTEM_ADMIN', isActive: true, failedLoginAttempts: 0, lockedUntil: null },
            create: {
                email,
                name: 'System Admin',
                password: hash,
                role: 'SYSTEM_ADMIN',
                isActive: true,
            },
        });

        return NextResponse.json({ ok: true, id: user.id, email: user.email });
    } catch (e: any) {
        return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
    }
}
