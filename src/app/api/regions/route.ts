import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";

// GET /api/regions — list all regions
export async function GET() {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const regions = await prisma.region.findMany({
        where: { isActive: true },
        include: {
            branches: {
                where: { isActive: true },
                select: { id: true, name: true, code: true, teamLeaderId: true }
            }
        },
        orderBy: { name: "asc" }
    });

    return NextResponse.json({ regions });
}

// POST /api/regions — create a region
export async function POST(request: NextRequest) {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = session.user as any;
    if (!["SYSTEM_ADMIN", "FINANCE_APPROVER"].includes(user.role)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { name, code, managerId } = body;

    if (!name || !code) {
        return NextResponse.json({ error: "Name and code are required" }, { status: 400 });
    }

    try {
        const region = await prisma.region.create({
            data: { name, code: code.toUpperCase() }
        });

        // Assign Regional Manager if provided
        if (managerId) {
            await prisma.user.update({
                where: { id: managerId },
                data: { regionId: region.id, role: "REGIONAL_MANAGER" }
            });
        }

        return NextResponse.json({ region }, { status: 201 });
    } catch (error: any) {
        if (error.code === "P2002") {
            return NextResponse.json({ error: "Region name or code already exists" }, { status: 409 });
        }
        return NextResponse.json({ error: "Failed to create region" }, { status: 500 });
    }
}
