import { NextRequest, NextResponse } from "next/server";
import { getMobileUser } from "@/lib/auth-utils";
import prisma from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const user = getMobileUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!user.permissions.includes('PAYMENTS.AUTHORIZE')) {
      return NextResponse.json({ error: "Forbidden: Not an authorized payer" }, { status: 403 });
    }

    const { requisitionId } = await req.json();

    if (!requisitionId) {
      return NextResponse.json({ error: "requisitionId is required" }, { status: 400 });
    }

    const requisition = await prisma.requisition.findUnique({
      where: { id: requisitionId }
    });

    if (!requisition) {
      return NextResponse.json({ error: "Requisition not found" }, { status: 404 });
    }

    if (requisition.status !== 'APPROVED') {
      return NextResponse.json({ error: "Requisition is not APPROVED" }, { status: 400 });
    }

    // Process payment
    const payment = await prisma.payment.create({
      data: {
        amount: requisition.amount,
        currency: requisition.currency,
        status: "COMPLETED",
        makerId: user.id,
        method: "MOBILE_APP",
        authorizedAt: new Date(),
        processedAt: new Date(),
        requisitions: { connect: [{ id: requisition.id }] }
      }
    });

    // Update requisition
    const updated = await prisma.requisition.update({
      where: { id: requisition.id },
      data: { status: 'PAID', paymentId: payment.id }
    });

    return NextResponse.json({ payment, requisition: updated });
  } catch (error) {
    console.error("Error creating mobile payment:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
