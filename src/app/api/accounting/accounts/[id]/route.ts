import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";

async function requireAdmin(session: any) {
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { role: true, customRole: { select: { isSystem: true } } }
    });
    if (user?.role !== 'SYSTEM_ADMIN' && !user?.customRole?.isSystem) {
        return NextResponse.json({ error: "System Admins only" }, { status: 403 });
    }
    return null;
}

export async function GET(req: Request, props: { params: Promise<{ id: string }> }) {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await props.params;
    const account = await prisma.account.findUnique({
        where: { id },
        include: { parent: true, children: true } as any
    });
    if (!account) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(account);
}

export async function PATCH(req: Request, props: { params: Promise<{ id: string }> }) {
    const session = await auth();
    const denied = await requireAdmin(session);
    if (denied) return denied;
    const { id } = await props.params;
    const body = await req.json();

    const account = await prisma.account.findUnique({ where: { id } });
    if (!account) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // Prevent archiving accounts that still have unposted lines
    if (body.isArchived === true) {
        const usage = await (prisma as any).journalLine.count({ where: { accountId: id } });
        if (usage > 0 && body.force !== true) {
            return NextResponse.json({
                error: `Account has ${usage} journal line(s). Set force=true to archive anyway.`,
                usage
            }, { status: 409 });
        }
    }

    const updated = await prisma.account.update({
        where: { id },
        data: {
            ...(body.name !== undefined && { name: body.name }),
            ...(body.description !== undefined && { description: body.description }),
            ...(body.subtype !== undefined && { subtype: body.subtype }),
            ...(body.parentId !== undefined && { parentId: body.parentId || null }),
            ...(body.isActive !== undefined && { isActive: body.isActive }),
            ...(body.isArchived !== undefined && { isArchived: body.isArchived, isActive: !body.isArchived }),
        }
    });

    await (prisma as any).auditLog.create({
        data: {
            actorId: (session as any).user?.id,
            actorEmail: (session as any).user?.email,
            action: body.isArchived ? 'ACCOUNT_ARCHIVE' : 'ACCOUNT_EDIT',
            entity: 'Account',
            entityId: id,
            before: account,
            after: updated,
        }
    });

    return NextResponse.json(updated);
}
