import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";

/**
 * POST /api/branch-approvals
 * Regional Manager: APPROVE | REJECT | RECOMMEND_ADJUSTMENT
 * Actions:
 *   - APPROVE : create level-2 approval pending admin, notify admin
 *   - REJECT  : mark requisition REJECTED, notify TL
 *   - RECOMMEND_ADJUSTMENT: set recommendedAmount, status back to PENDING_TL_REVIEW, notify TL
 */
export async function POST(request: NextRequest) {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = session.user as any;
    if (!["REGIONAL_MANAGER", "SYSTEM_ADMIN", "FINANCE_APPROVER"].includes(user.role)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { requisitionId, action, comments, recommendedAmount } = body;

    if (!requisitionId || !action) {
        return NextResponse.json({ error: "requisitionId and action are required" }, { status: 400 });
    }

    const validActions = ["APPROVE", "REJECT", "RECOMMEND_ADJUSTMENT"];
    if (!validActions.includes(action)) {
        return NextResponse.json({ error: `action must be one of: ${validActions.join(", ")}` }, { status: 400 });
    }

    // Fetch the requisition
    const requisition = await prisma.requisition.findUnique({
        where: { id: requisitionId },
        include: {
            user: { select: { id: true, name: true, email: true } },
            branchRef: {
                include: {
                    region: { select: { id: true, name: true } },
                    wallet: true
                }
            },
            approvals: true
        }
    });

    if (!requisition) return NextResponse.json({ error: "Requisition not found" }, { status: 404 });

    // If RM, verify they manage this branch's region
    if (user.role === "REGIONAL_MANAGER") {
        const rm = await prisma.user.findUnique({ where: { id: user.id }, select: { regionId: true } });
        if (!rm?.regionId || rm.regionId !== requisition.branchRef?.region?.id) {
            return NextResponse.json({ error: "You do not manage this branch's region" }, { status: 403 });
        }
    }

    if (action === "APPROVE") {
        // Update the Level-1 RM approval to APPROVED
        await prisma.approval.updateMany({
            where: {
                requisitionId,
                level: 1,
                status: { in: ["PENDING", "PENDING_RM"] }
            },
            data: { status: "APPROVED", approvedAt: new Date(), comments }
        });

        // Update requisition status to awaiting admin approval
        await prisma.requisition.update({
            where: { id: requisitionId },
            data: { status: "PENDING_ADMIN_APPROVAL" }
        });

        // Find admin approvers (FINANCE_APPROVER and SYSTEM_ADMIN)
        const admins = await prisma.user.findMany({
            where: {
                role: { in: ["FINANCE_APPROVER", "SYSTEM_ADMIN"] },
                isActive: true,
                accountStatus: "ACTIVE"
            },
            select: { id: true }
        });

        // Create level-2 approvals for each admin
        if (admins.length > 0) {
            await prisma.approval.createMany({
                data: admins.map(admin => ({
                    requisitionId,
                    approverId: admin.id,
                    level: 2,
                    status: "PENDING"
                }))
            });

            // Notify all admins
            await prisma.notification.createMany({
                data: admins.map(admin => ({
                    userId: admin.id,
                    type: "BRANCH_REQUISITION_ESCALATED",
                    title: "Branch Requisition Awaiting Your Approval",
                    message: `Regional Manager approved requisition "${requisition.title}" from ${requisition.branchRef?.name || "a branch"}. It requires your final approval.`,
                    link: `/dashboard/approvals`,
                    relatedId: requisitionId
                }))
            });
        }

        // Notify Team Leader
        await prisma.notification.create({
            data: {
                userId: requisition.userId,
                type: "REQUISITION_RM_APPROVED",
                title: "Your Requisition Was Approved by Regional Manager",
                message: `Your requisition "${requisition.title}" has been approved by the Regional Manager and is now pending final HQ approval.`,
                link: `/dashboard/requisitions`,
                relatedId: requisitionId
            }
        });

        return NextResponse.json({ message: "Requisition approved — escalated to admin for final approval" });
    }

    if (action === "REJECT") {
        // Update level-1 approval
        await prisma.approval.updateMany({
            where: { requisitionId, level: 1, status: { in: ["PENDING", "PENDING_RM"] } },
            data: { status: "REJECTED", approvedAt: new Date(), comments }
        });

        // Mark requisition as REJECTED
        await prisma.requisition.update({
            where: { id: requisitionId },
            data: { status: "REJECTED" }
        });

        // Notify Team Leader
        await prisma.notification.create({
            data: {
                userId: requisition.userId,
                type: "REQUISITION_REJECTED",
                title: "Your Requisition Was Rejected",
                message: `Your requisition "${requisition.title}" was rejected by the Regional Manager.${comments ? ` Reason: ${comments}` : ""}`,
                link: `/dashboard/requisitions`,
                relatedId: requisitionId
            }
        });

        return NextResponse.json({ message: "Requisition rejected" });
    }

    if (action === "RECOMMEND_ADJUSTMENT") {
        if (!recommendedAmount || recommendedAmount <= 0) {
            return NextResponse.json({ error: "recommendedAmount is required and must be positive" }, { status: 400 });
        }

        // Update level-1 approval with recommended amount
        await prisma.approval.updateMany({
            where: { requisitionId, level: 1, status: { in: ["PENDING", "PENDING_RM"] } },
            data: { recommendedAmount, rmComments: comments }
        });

        // Set requisition back to TL review
        await prisma.requisition.update({
            where: { id: requisitionId },
            data: { status: "PENDING_TL_REVIEW" }
        });

        // Notify Team Leader with the recommended amount
        await prisma.notification.create({
            data: {
                userId: requisition.userId,
                type: "REQUISITION_ADJUSTMENT_RECOMMENDED",
                title: "Adjustment Recommended for Your Requisition",
                message: `The Regional Manager has recommended an adjusted amount of ${requisition.currency} ${recommendedAmount.toFixed(2)} for your requisition "${requisition.title}".${comments ? ` Notes: ${comments}` : ""} Please review and resubmit.`,
                link: `/dashboard/requisitions/${requisitionId}`,
                relatedId: requisitionId
            }
        });

        return NextResponse.json({
            message: "Adjustment recommended — Team Leader has been notified to review and resubmit"
        });
    }
}

/**
 * GET /api/branch-approvals
 * Regional Manager sees pending requisitions from their region's branches
 */
export async function GET() {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = session.user as any;

    let whereClause: any = {
        status: { in: ["PENDING", "PENDING_RM"] },
        branchId: { not: null }
    };

    if (user.role === "REGIONAL_MANAGER") {
        const rm = await prisma.user.findUnique({ where: { id: user.id }, select: { regionId: true } });
        if (!rm?.regionId) return NextResponse.json({ requisitions: [] });

        // Get branch IDs in this region
        const branches = await prisma.branch.findMany({
            where: { regionId: rm.regionId, isActive: true },
            select: { id: true }
        });
        const branchIds = branches.map(b => b.id);
        whereClause.branchId = { in: branchIds };
    }

    const requisitions = await prisma.requisition.findMany({
        where: whereClause,
        include: {
            user: { select: { id: true, name: true, email: true } },
            branchRef: { include: { region: true } },
            approvals: { include: { approver: { select: { id: true, name: true, role: true } } } },
            items: true
        },
        orderBy: { createdAt: "desc" }
    });

    return NextResponse.json({ requisitions });
}
