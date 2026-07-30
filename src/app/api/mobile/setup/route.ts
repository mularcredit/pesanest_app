import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";

// One-time setup route - DELETE AFTER USE
export async function GET() {
  try {
    const hash = await bcrypt.hash("BranchManager123!", 10);
    const branch = await prisma.branch.findFirst();

    const user = await prisma.user.upsert({
      where: { email: "branchmanager@pesanest.com" },
      update: { accountStatus: "ACTIVE", isActive: true, password: hash },
      create: {
        email: "branchmanager@pesanest.com",
        name: "Test Branch Manager",
        password: hash,
        role: "TEAM_LEADER",
        accountStatus: "ACTIVE",
        isActive: true,
        branchId: branch?.id || null,
      },
    });

    return NextResponse.json({
      success: true,
      email: user.email,
      role: user.role,
      branch: branch?.name || "None",
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
