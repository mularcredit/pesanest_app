import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { smsService } from '@/lib/sms/sms-service';

const OTP_TTL_MINUTES = 5;

/**
 * Step 1 of login: verify the password and, if it's correct, send a fresh
 * SMS OTP to the user's phone. The actual sign-in (POST to NextAuth) happens
 * afterwards with the OTP included — see src/auth.ts's authorize().
 *
 * Requiring a correct password before an OTP is ever sent is deliberate: it
 * keeps this endpoint from being an OTP-spam/enumeration vector, since the
 * existing failed-login lockout (5 attempts / 15 min) already gates it.
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json().catch(() => ({}));
        const email = String(body?.email || '').trim().toLowerCase();
        const password = String(body?.password || '');
        if (!email || !password) {
            return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
        }

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
            return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
        }

        if (user.lockedUntil && new Date(user.lockedUntil) > new Date()) {
            return NextResponse.json({ error: 'Account is temporarily locked. Try again later.' }, { status: 403 });
        }
        if (user.accountStatus === 'PENDING' || !user.isActive) {
            return NextResponse.json({ error: 'This account is not active' }, { status: 403 });
        }

        const passwordsMatch = await bcrypt.compare(password, user.password);
        if (!passwordsMatch) {
            return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
        }

        // Master-admin style bypass — this account skips OTP entirely, so the
        // login page can go straight to signIn() with no code needed.
        if ((user as any).otpExempt) {
            return NextResponse.json({ exempt: true });
        }

        if (!user.phoneNumber) {
            return NextResponse.json({
                error: 'No phone number is on file for this account. Contact a system administrator.',
            }, { status: 400 });
        }

        const code = String(Math.floor(100000 + Math.random() * 900000)); // 6 digits
        const hashedCode = await bcrypt.hash(code, 10);
        const expiry = new Date(Date.now() + OTP_TTL_MINUTES * 60_000);

        await (prisma.user.update as any)({
            where: { id: user.id },
            data: { loginOtpCode: hashedCode, loginOtpExpiry: expiry },
        });

        const result = await smsService.sendLoginOtp(user.phoneNumber, code);
        if (!result.success) {
            return NextResponse.json({
                error: "Couldn't send the login code. Please try again or contact a system administrator.",
            }, { status: 502 });
        }

        return NextResponse.json({ sent: true });
    } catch (err: any) {
        return NextResponse.json({ error: err?.message || 'Something went wrong' }, { status: 500 });
    }
}
