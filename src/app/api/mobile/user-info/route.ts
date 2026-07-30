import { NextRequest, NextResponse } from "next/server";
import { getMobileUser } from "@/lib/auth-utils";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const user = getMobileUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let branchName = "";
    let departmentName = "";

    if (user.branchId) {
      const branch = await prisma.branch.findUnique({
        where: { id: user.branchId },
        select: { name: true }
      });
      branchName = branch?.name || "";
    }

    // `department` on the User model is already a plain string field
    const fullUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { department: true }
    });
    departmentName = fullUser?.department || "";

    return NextResponse.json({
      branch: branchName,
      department: departmentName,
      branchId: user.branchId,
      regionId: user.regionId,
    });
  } catch (error) {
    console.error("Error fetching user info:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
