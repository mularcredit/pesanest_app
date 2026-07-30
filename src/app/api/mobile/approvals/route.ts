import { NextRequest, NextResponse } from "next/server";
import { getMobileUser } from "@/lib/auth-utils";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const user = getMobileUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const isAdmin = user.role === 'SYSTEM_ADMIN';

    // 1. Fetch pending approvals exactly like the web ApprovalsPage
    const myPendingApprovals = await prisma.approval.findMany({
      where: {
        ...(isAdmin ? {} : { approverId: user.id }),
        status: 'PENDING'
      },
      include: {
        requisition: {
          include: {
            user: { select: { name: true, email: true, department: true } },
            items: true,
            branchRef: { select: { name: true } }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // 2. Extract and format the requisitions exactly as the mobile app expects them
    // but include the approvalId so the frontend can submit the approval action
    const approvals = Array.from(new Map(
      myPendingApprovals
        .filter(a => a.requisition)
        .map(a => [
          a.requisition!.id, 
          { 
            ...a.requisition!, 
            approvalId: a.id,
            // Format for mobile consistency
            isApprovalAction: true
          }
        ])
    ).values());

    return NextResponse.json({ 
      approvals,
      count: approvals.length
    });
  } catch (error) {
    console.error("Error fetching mobile approvals:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
