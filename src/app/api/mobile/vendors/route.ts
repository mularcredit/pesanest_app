import { NextRequest, NextResponse } from "next/server";
import { getMobileUser } from "@/lib/auth-utils";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const user = getMobileUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const vendors = await prisma.vendor.findMany({
      select: {
        id: true,
        name: true,
        preferredPaymentMethod: true,
        bankAccount: true,
        email: true,
        phone: true,
      },
      orderBy: { name: 'asc' }
    });

    return NextResponse.json({ vendors });
  } catch (error) {
    console.error("Error fetching vendors:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
