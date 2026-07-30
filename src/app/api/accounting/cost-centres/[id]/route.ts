import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function PATCH(req: Request, props: { params: Promise<{ id: string }> }) {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { role: true, customRole: { select: { isSystem: true } } }
    });
    if (user?.role !== 'SYSTEM_ADMIN' && !user?.customRole?.isSystem) {
        return NextResponse.json({ error: "System Admins only" }, { status: 403 });
    }

    const { id } = await props.params;
    const body = await req.json();

    const updated = await (prisma as any).costCentre.update({
        where: { id },
        data: {
            ...(body.name !== undefined && { name: body.name }),
            ...(body.description !== undefined && { description: body.description }),
            ...(body.isActive !== undefined && { isActive: body.isActive }),
        }
    });
    return NextResponse.json(updated);
}

export async function DELETE(req: Request, props: { params: Promise<{ id: string }> }) {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { role: true, customRole: { select: { isSystem: true } } }
    });
    if (user?.role !== 'SYSTEM_ADMIN' && !user?.customRole?.isSystem) {
        return NextResponse.json({ error: "System Admins only" }, { status: 403 });
    }

    const { id } = await props.params;

    const usage = await (prisma as any).journalLine.count({ where: { costCentreId: id } });
    if (usage > 0) {
        return NextResponse.json({ error: `Cost centre has ${usage} journal line(s) — deactivate instead of deleting.` }, { status: 409 });
    }

    await (prisma as any).costCentre.delete({ where: { id } });
    return NextResponse.json({ ok: true });
}
