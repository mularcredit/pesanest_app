import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const costCentres = await (prisma as any).costCentre.findMany({
        orderBy: { code: 'asc' },
        include: { _count: { select: { lines: true } } }
    });
    return NextResponse.json(costCentres);
}

export async function POST(req: Request) {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { role: true, customRole: { select: { isSystem: true } } }
    });
    const isAdmin = user?.role === 'SYSTEM_ADMIN' || user?.customRole?.isSystem;
    if (!isAdmin) return NextResponse.json({ error: "System Admins only" }, { status: 403 });

    const body = await req.json();
    if (!body.code || !body.name) {
        return NextResponse.json({ error: "code and name are required" }, { status: 400 });
    }

    try {
        const cc = await (prisma as any).costCentre.create({
            data: { code: body.code.toUpperCase(), name: body.name, description: body.description || null }
        });
        return NextResponse.json(cc, { status: 201 });
    } catch (err: any) {
        if (err.code === 'P2002') return NextResponse.json({ error: "Code already exists" }, { status: 409 });
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
