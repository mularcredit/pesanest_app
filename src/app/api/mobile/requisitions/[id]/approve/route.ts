import { NextRequest, NextResponse } from "next/server";
import { getMobileUser } from "@/lib/auth-utils";
import prisma from "@/lib/prisma";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = getMobileUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (user.role !== 'REGIONAL_MANAGER' && user.role !== 'SYSTEM_ADMIN' && user.role !== 'FINANCE_APPROVER') {
      return NextResponse.json({ error: "Forbidden: Not an approver" }, { status: 403 });
    }

    const { id: requisitionId } = await params;

    // Verify requisition exists
    const requisition = await prisma.requisition.findUnique({
      where: { id: requisitionId }
    });

    if (!requisition) {
      return NextResponse.json({ error: "Requisition not found" }, { status: 404 });
    }

    // Update status to APPROVED
    const updated = await prisma.requisition.update({
      where: { id: requisitionId },
      data: { status: 'APPROVED' }
    });

    // Create Approval record
    await prisma.approval.create({
      data: {
        requisitionId,
        approverId: user.id,
        level: 1,
        status: 'APPROVED',
        comments: 'Approved via Mobile App',
        approvedAt: new Date()
      }
    });

    return NextResponse.json({ requisition: updated });
  } catch (error) {
    console.error("Error approving requisition:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
