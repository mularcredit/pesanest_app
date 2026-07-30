import { NextRequest, NextResponse } from "next/server";
import { getMobileUser } from "@/lib/auth-utils";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const user = getMobileUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();

    let branchName = "";
    let totalBudget = 0;
    let type = "PERSONAL";

    if (user.branchId) {
      const branch = await prisma.branch.findUnique({ where: { id: user.branchId } });
      branchName = branch?.name || "";
      type = "BRANCH";
    }

    // Aggregate monthly budget for the user's current month
    const budgets = await prisma.monthlyBudget.findMany({
      where: {
        userId: user.id,
        month: currentMonth,
        year: currentYear,
      },
      include: { items: true }
    });

    totalBudget = budgets.reduce((sum, b) => sum + b.totalAmount, 0);

    // Calculate total spent from PAID requisitions this month
    const startOfMonth = new Date(currentYear, currentMonth - 1, 1);
    const endOfMonth = new Date(currentYear, currentMonth, 0, 23, 59, 59);

    const reqsQuery: any = {
      status: 'PAID',
      createdAt: { gte: startOfMonth, lte: endOfMonth }
    };
    if (user.branchId) {
      reqsQuery.branchId = user.branchId;
    } else {
      reqsQuery.userId = user.id;
    }

    const paidReqs = await prisma.requisition.findMany({
      where: reqsQuery,
      select: { amount: true }
    });

    const spent = paidReqs.reduce((sum, r) => sum + r.amount, 0);
    const available = totalBudget > 0 ? totalBudget - spent : 0;

    return NextResponse.json({
      totalBudget,
      spent,
      available,
      type,
      name: branchName || user.name,
    });
  } catch (error) {
    console.error("Error fetching mobile wallet data:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
