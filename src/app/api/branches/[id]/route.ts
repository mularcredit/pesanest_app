import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";

// GET /api/branches/[id] — branch detail
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const resolvedParams = await params;

    const branch = await prisma.branch.findUnique({
        where: { id: resolvedParams.id },
        include: {
            region: true,
            teamLeader: { select: { id: true, name: true, email: true, role: true } },
            wallet: {
                include: {
                    transactions: { orderBy: { createdAt: "desc" }, take: 50 }
                }
            },
            requisitions: {
                orderBy: { createdAt: "desc" },
                take: 20,
                include: { user: { select: { id: true, name: true } } }
            }
        }
    });

    if (!branch) return NextResponse.json({ error: "Branch not found" }, { status: 404 });

    return NextResponse.json({ branch });
}

// PATCH /api/branches/[id] — update branch
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = session.user as any;
    if (!["SYSTEM_ADMIN", "FINANCE_APPROVER", "REGIONAL_MANAGER"].includes(user.role)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const resolvedParams = await params;
    const body = await request.json();
    const { name, address, teamLeaderId, isActive } = body;

    try {
        const branch = await prisma.$transaction(async (tx) => {
            // If changing team leader, update both old and new user roles
            if (teamLeaderId !== undefined) {
                const existing = await tx.branch.findUnique({ where: { id: resolvedParams.id }, select: { teamLeaderId: true } });
                if (existing?.teamLeaderId && existing.teamLeaderId !== teamLeaderId) {
                    // Remove old TL role
                    await tx.user.update({ where: { id: existing.teamLeaderId }, data: { role: "EMPLOYEE" } });
                }
                if (teamLeaderId) {
                    await tx.user.update({ where: { id: teamLeaderId }, data: { role: "TEAM_LEADER" } });
                }
            }

            return tx.branch.update({
                where: { id: resolvedParams.id },
                data: { name, address, teamLeaderId, isActive },
                include: {
                    region: true,
                    teamLeader: { select: { id: true, name: true, email: true } },
                    wallet: true
                }
            });
        });

        return NextResponse.json({ branch });
    } catch (error) {
        return NextResponse.json({ error: "Failed to update branch" }, { status: 500 });
    }
}

// DELETE /api/branches/[id] — deactivate branch
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = session.user as any;
    if (!["SYSTEM_ADMIN"].includes(user.role)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const resolvedParams = await params;
    await prisma.branch.update({ where: { id: resolvedParams.id }, data: { isActive: false } });
    return NextResponse.json({ message: "Branch deactivated" });
}
