import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";

// GET - List all permissions (grouped by resource)
export async function GET(req: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const permissions = await prisma.permission.findMany({
            orderBy: [
                { resource: 'asc' },
                { action: 'asc' }
            ]
        });

        // Group by resource for easier UI rendering
        const grouped = permissions.reduce((acc: any, perm) => {
            if (!acc[perm.resource]) {
                acc[perm.resource] = [];
            }
            acc[perm.resource].push(perm);
            return acc;
        }, {});

        return NextResponse.json({ permissions, grouped });

    } catch (error) {
        console.error('Fetch Permissions Error:', error);
        return NextResponse.json({ error: 'Failed' }, { status: 500 });
    }
}
