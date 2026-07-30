import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

/** Returns whether TOTP is enabled for a given email — used by the login page
 *  to decide whether to show the authenticator code field after a failed attempt. */
export async function GET(req: NextRequest) {
    const email = req.nextUrl.searchParams.get('email')?.trim().toLowerCase();
    if (!email) return NextResponse.json({ totpEnabled: false });

    try {
        const user = await prisma.user.findUnique({
            where: { email },
            select: { totpEnabled: true },
        });
        return NextResponse.json({ totpEnabled: user?.totpEnabled ?? false });
    } catch {
        return NextResponse.json({ totpEnabled: false });
    }
}
