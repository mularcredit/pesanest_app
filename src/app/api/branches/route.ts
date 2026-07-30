import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";

// GET /api/branches — list all branches
export async function GET(request: NextRequest) {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = session.user as any;
    const { searchParams } = new URL(request.url);
    const regionId = searchParams.get("regionId");

    // Regional Managers only see their region's branches
    let whereClause: any = { isActive: true };
    if (user.role === "REGIONAL_MANAGER") {
        const rm = await prisma.user.findUnique({ where: { id: user.id }, select: { regionId: true } });
        if (rm?.regionId) whereClause.regionId = rm.regionId;
    } else if (regionId) {
        whereClause.regionId = regionId;
    }

    const branches = await prisma.branch.findMany({
        where: whereClause,
        include: {
            region: { select: { id: true, name: true, code: true } },
            teamLeader: { select: { id: true, name: true, email: true } },
            wallet: { select: { id: true, balance: true, currency: true } }
        },
        orderBy: { name: "asc" }
    });

    return NextResponse.json({ branches });
}

// POST /api/branches — create a single branch
export async function POST(request: NextRequest) {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = session.user as any;
    if (!["SYSTEM_ADMIN", "FINANCE_APPROVER", "REGIONAL_MANAGER"].includes(user.role)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { name, code, address, regionId, teamLeaderId } = body;

    if (!name || !code || !regionId) {
        return NextResponse.json({ error: "Name, code, and regionId are required" }, { status: 400 });
    }

    try {
        const branch = await prisma.$transaction(async (tx) => {
            const newBranch = await tx.branch.create({
                data: {
                    name,
                    code: code.toUpperCase(),
                    address,
                    regionId,
                    teamLeaderId: teamLeaderId || null
                }
            });

            // Create wallet for this branch
            await tx.branchWallet.create({
                data: { branchId: newBranch.id, balance: 0 }
            });

            // Assign team leader role
            if (teamLeaderId) {
                await tx.user.update({
                    where: { id: teamLeaderId },
                    data: { role: "TEAM_LEADER" }
                });
            }

            return newBranch;
        });

        const result = await prisma.branch.findUnique({
            where: { id: branch.id },
            include: {
                region: true,
                teamLeader: { select: { id: true, name: true, email: true } },
                wallet: true
            }
        });

        return NextResponse.json({ branch: result }, { status: 201 });
    } catch (error: any) {
        if (error.code === "P2002") {
            return NextResponse.json({ error: "Branch code already exists" }, { status: 409 });
        }
        return NextResponse.json({ error: "Failed to create branch" }, { status: 500 });
    }
}
