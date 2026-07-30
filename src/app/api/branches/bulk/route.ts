import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";

// POST /api/branches/bulk — create multiple branches at once
export async function POST(request: NextRequest) {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = session.user as any;
    if (!["SYSTEM_ADMIN", "FINANCE_APPROVER"].includes(user.role)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { branches } = body;

    if (!Array.isArray(branches) || branches.length === 0) {
        return NextResponse.json({ error: "An array of branches is required" }, { status: 400 });
    }

    // Validate all entries have required fields
    const invalid = branches.filter((b: any) => !b.name || !b.code || !b.regionId);
    if (invalid.length > 0) {
        return NextResponse.json({
            error: `${invalid.length} entries are missing name, code, or regionId`,
            invalid
        }, { status: 400 });
    }

    try {
        const results = await prisma.$transaction(async (tx) => {
            const created = [];
            for (const branch of branches) {
                const newBranch = await tx.branch.create({
                    data: {
                        name: branch.name,
                        code: branch.code.toUpperCase(),
                        address: branch.address || null,
                        regionId: branch.regionId,
                        teamLeaderId: branch.teamLeaderId || null
                    }
                });

                // Auto-create wallet for each branch
                await tx.branchWallet.create({
                    data: { branchId: newBranch.id, balance: 0 }
                });

                // Assign team leader role if provided
                if (branch.teamLeaderId) {
                    await tx.user.update({
                        where: { id: branch.teamLeaderId },
                        data: { role: "TEAM_LEADER" }
                    });
                }

                created.push(newBranch);
            }
            return created;
        });

        return NextResponse.json({
            message: `${results.length} branches created successfully`,
            created: results
        }, { status: 201 });
    } catch (error: any) {
        if (error.code === "P2002") {
            return NextResponse.json({ error: "One or more branch codes already exist" }, { status: 409 });
        }
        return NextResponse.json({ error: "Failed to create branches" }, { status: 500 });
    }
}
