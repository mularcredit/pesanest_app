import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";
import { totp as totpUtil } from "@/lib/totp";
import QRCode from "qrcode";

const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || "Pesanest";

// GET — generate a new TOTP secret + QR code (pending — not yet enabled)
export async function GET(req: Request) {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const secret = totpUtil.generateSecret();
    const otpauth = totpUtil.keyuri(session.user.email!, APP_NAME, secret);
    const qrDataUrl = await QRCode.toDataURL(otpauth);

    // Store secret temporarily (not yet enabled until verified)
    await prisma.user.update({
        where: { id: session.user.id },
        data: { totpSecret: secret, totpEnabled: false } as any
    });

    return NextResponse.json({ secret, qrDataUrl });
}

// POST — verify the TOTP code and enable 2FA
export async function POST(req: Request) {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { token } = await req.json();
    if (!token) return NextResponse.json({ error: "token is required" }, { status: 400 });

    const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { totpSecret: true, totpEnabled: true }
    }) as any;

    if (!user?.totpSecret) {
        return NextResponse.json({ error: "No pending TOTP setup. Call GET first." }, { status: 400 });
    }

    const valid = totpUtil.verify({ token, secret: user.totpSecret });
    if (!valid) return NextResponse.json({ error: "Invalid TOTP code" }, { status: 400 });

    await prisma.user.update({
        where: { id: session.user.id },
        data: { totpEnabled: true } as any
    });

    await (prisma as any).auditLog.create({
        data: {
            actorId: session.user.id,
            actorEmail: session.user.email,
            action: '2FA_ENABLED',
            entity: 'User',
            entityId: session.user.id,
        }
    });

    return NextResponse.json({ ok: true, message: "2FA enabled successfully" });
}
