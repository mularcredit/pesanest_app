import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";

// GET /api/audit?entity=&action=&actorId=&from=&to=&page=1&limit=50
export async function GET(req: Request) {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { role: true, customRole: { select: { isSystem: true } } }
    });
    const isAdmin = user?.role === 'SYSTEM_ADMIN' || user?.customRole?.isSystem;
    const isFinance = (user as any)?.role === 'FINANCE_APPROVER' || (user as any)?.role === 'FINANCE_TEAM';
    if (!isAdmin && !isFinance) {
        return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, Number(searchParams.get('page') || '1'));
    const limit = Math.min(Number(searchParams.get('limit') || '50'), 200);
    const skip = (page - 1) * limit;

    const where: any = {};
    if (searchParams.get('entity')) where.entity = searchParams.get('entity');
    if (searchParams.get('action')) where.action = { contains: searchParams.get('action'), mode: 'insensitive' };
    if (searchParams.get('actorId')) where.actorId = searchParams.get('actorId');
    if (searchParams.get('from') || searchParams.get('to')) {
        where.createdAt = {};
        if (searchParams.get('from')) where.createdAt.gte = new Date(searchParams.get('from')!);
        if (searchParams.get('to')) where.createdAt.lte = new Date(searchParams.get('to')!);
    }

    // Build dynamic WHERE clause for raw SQL
    const conditions: string[] = [];
    const values: any[] = [];
    let idx = 1;
    if (where.entity) { conditions.push(`entity = $${idx++}`); values.push(where.entity); }
    if (where.actorId) { conditions.push(`"actorId" = $${idx++}`); values.push(where.actorId); }
    if (where.action?.contains) { conditions.push(`action ILIKE $${idx++}`); values.push(`%${where.action.contains}%`); }
    if (where.createdAt?.gte) { conditions.push(`"createdAt" >= $${idx++}`); values.push(where.createdAt.gte); }
    if (where.createdAt?.lte) { conditions.push(`"createdAt" <= $${idx++}`); values.push(where.createdAt.lte); }
    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const [totalRows, logs, entityRows, actionRows] = await Promise.all([
        prisma.$queryRawUnsafe<{ count: bigint }[]>(`SELECT COUNT(*) as count FROM "AuditLog" ${whereClause}`, ...values).catch(() => [{ count: BigInt(0) }]),
        prisma.$queryRawUnsafe<any[]>(`SELECT * FROM "AuditLog" ${whereClause} ORDER BY "createdAt" DESC LIMIT ${limit} OFFSET ${skip}`, ...values).catch(() => []),
        prisma.$queryRaw<{ entity: string }[]>`SELECT DISTINCT entity FROM "AuditLog" ORDER BY entity ASC`.catch(() => []),
        prisma.$queryRaw<{ action: string }[]>`SELECT DISTINCT action FROM "AuditLog" ORDER BY action ASC`.catch(() => []),
    ]);
    const total = Number(totalRows[0]?.count ?? 0);
    const entities = entityRows;
    const actions = actionRows;

    return NextResponse.json({
        logs,
        total,
        page,
        pages: Math.ceil(total / limit),
        filters: {
            entities: entities.map((e: any) => e.entity),
            actions: actions.map((a: any) => a.action),
        }
    });
}
