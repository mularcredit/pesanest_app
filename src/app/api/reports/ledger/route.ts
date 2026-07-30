import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/auth";

/**
 * GET /api/reports/ledger?all=true
 * Returns all journal entries (with lines + account info) for export.
 * Only accessible to authenticated users.
 */
export async function GET(req: NextRequest) {
    const session = await auth();
    if (!session?.user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("q") || "";
    const accountId = searchParams.get("accountId") || "";

    const whereClause: any = { AND: [] };

    if (search) {
        whereClause.AND.push({
            OR: [
                { description: { contains: search, mode: "insensitive" } },
                { reference: { contains: search, mode: "insensitive" } },
                { lines: { some: { account: { name: { contains: search, mode: "insensitive" } } } } },
                { lines: { some: { account: { code: { contains: search, mode: "insensitive" } } } } },
            ]
        });
    }

    if (accountId) {
        whereClause.AND.push({
            lines: { some: { accountId } }
        });
    }

    if (whereClause.AND.length === 0) {
        delete whereClause.AND;
    }

    try {
        const entries = await (prisma as any).journalEntry.findMany({
            where: whereClause,
            orderBy: { date: "desc" },
            include: {
                lines: {
                    include: { account: true },
                },
            },
        });

        return NextResponse.json(entries);
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
