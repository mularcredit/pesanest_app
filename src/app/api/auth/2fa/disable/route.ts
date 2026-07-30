import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";
import { totp as totpUtil } from "@/lib/totp";

// POST — verify TOTP then disable 2FA
export async function POST(req: Request) {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { token } = await req.json();
    if (!token) return NextResponse.json({ error: "token is required to disable 2FA" }, { status: 400 });

    const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { totpSecret: true, totpEnabled: true }
    }) as any;

    if (!user?.totpEnabled) return NextResponse.json({ error: "2FA is not enabled" }, { status: 400 });

    const valid = totpUtil.verify({ token, secret: user.totpSecret });
    if (!valid) return NextResponse.json({ error: "Invalid TOTP code" }, { status: 400 });

    await prisma.user.update({
        where: { id: session.user.id },
        data: { totpEnabled: false, totpSecret: null } as any
    });

    await (prisma as any).auditLog.create({
        data: {
            actorId: session.user.id,
            actorEmail: session.user.email,
            action: '2FA_DISABLED',
            entity: 'User',
            entityId: session.user.id,
        }
    });

    return NextResponse.json({ ok: true, message: "2FA disabled" });
}
