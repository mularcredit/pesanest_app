import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";

// GET /api/auth/login-events?limit=50
export async function GET(req: Request) {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const limit = Math.min(Number(searchParams.get('limit') || '50'), 200);
    const userId = searchParams.get('userId') || session.user.id;

    // Admins can view any user's events; others can only view their own
    const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { role: true, customRole: { select: { isSystem: true } } }
    });
    const isAdmin = user?.role === 'SYSTEM_ADMIN' || user?.customRole?.isSystem;
    const targetId = isAdmin ? (userId || undefined) : session.user.id;

    const events = await (prisma as any).loginEvent.findMany({
        where: targetId ? { userId: targetId } : {},
        orderBy: { createdAt: 'desc' },
        take: limit,
        include: { user: { select: { name: true, email: true } } }
    });

    return NextResponse.json(events);
}
