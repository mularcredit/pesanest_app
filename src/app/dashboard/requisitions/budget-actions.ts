"use server";

import prisma from "@/lib/prisma";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

export async function createMonthlyBudget(data: {
    month: number;
    year: number;
    branch: string;
    department: string;
    accountId?: string;
    items: { description: string; category: string; amount: number }[];
}) {
    const session = await auth();
    if (!session?.user?.id) throw new Error("Unauthorized");

    const totalAmount = data.items.reduce((sum, item) => sum + item.amount, 0);

    try {
        const budget = await (prisma as any).monthlyBudget.create({
            data: {
                userId: session.user.id,
                month: data.month,
                year: data.year,
                branch: data.branch,
                department: data.department,
                accountId: data.accountId,
                totalAmount,
                status: "PENDING",
                items: {
                    create: data.items
                }
            }
        });

        // Resolve regionId for approval routing
        const userWithBranch = await prisma.user.findUnique({
            where: { id: session.user.id },
            include: { leadBranch: true }
        });
        const userRegionId = userWithBranch?.regionId || userWithBranch?.leadBranch?.regionId;


        // ✨ NEW: Initiate Approval Workflow for Budget
        const { approvalWorkflow } = await import("@/lib/approval-workflow");
        const route = await approvalWorkflow.determineRoute(
            session.user.id,
            totalAmount,
            "Budget Plan",
            false,
            "BUDGET",
            userRegionId || undefined
        );

        await approvalWorkflow.createBudgetApprovals(budget.id, route);


        revalidatePath("/dashboard/requisitions");
        revalidatePath("/dashboard/approvals");
        return { success: true, id: budget.id };
    } catch (e: any) {
        console.error("Budget Creation Error:", e);
        return { error: e.message || "Failed to create monthly budget" };
    }
}

export async function updateMonthlyBudget(budgetId: string, data: {
    month: number;
    year: number;
    branch: string;
    department: string;
    accountId?: string;
    items: { description: string; category: string; amount: number }[];
}) {
    const session = await auth();
    if (!session?.user?.id) throw new Error("Unauthorized");

    try {
        const existingBudget = await (prisma as any).monthlyBudget.findUnique({
            where: { id: budgetId },
            select: { userId: true, status: true }
        });

        if (!existingBudget) return { error: "Budget not found" };
        if (existingBudget.status !== "PENDING") return { error: "Only pending budgets can be edited" };

        // For now, allow any System Admin OR the owner to edit it.
        const user = await prisma.user.findUnique({ where: { id: session.user.id } });
        const isAdmin = user?.role === 'SYSTEM_ADMIN';
        if (existingBudget.userId !== session.user.id && !isAdmin) {
            return { error: "Unauthorized to edit this budget" };
        }

        const totalAmount = data.items.reduce((sum, item) => sum + item.amount, 0);

        // Transaction to wipe old items, create new ones, update budget, and reset approvals
        await prisma.$transaction(async (tx: any) => {
            // Delete old items
            await tx.budgetItem.deleteMany({ where: { budgetId } });

            // Delete existing pending approvals (so they are re-evaluated based on the new total/branch)
            await tx.approval.deleteMany({ where: { monthlyBudgetId: budgetId, status: "PENDING" } });

            // Update budget
            await tx.monthlyBudget.update({
                where: { id: budgetId },
                data: {
                    month: data.month,
                    year: data.year,
                    branch: data.branch,
                    department: data.department,
                    accountId: data.accountId,
                    totalAmount,
                    items: {
                        create: data.items.map((item: any) => ({
                            description: item.description,
                            category: item.category,
                            amount: item.amount
                        }))
                    }
                }
            });

            // Resolve regionId for approval routing
            const userWithBranch = await prisma.user.findUnique({
                where: { id: existingBudget.userId },
                include: { leadBranch: true }
            });
            const userRegionId = userWithBranch?.regionId || userWithBranch?.leadBranch?.regionId;

            // Re-run Approval Workflow for Budget
            const { approvalWorkflow } = await import("@/lib/approval-workflow");
            const route = await approvalWorkflow.determineRoute(
                existingBudget.userId,
                totalAmount,
                "Budget Plan",
                false,
                "BUDGET",
                userRegionId || undefined
            );

            // Recreate approvals using the underlying structure used in createMonthlyBudget
            await approvalWorkflow.createBudgetApprovals(budgetId, route);

        });

        revalidatePath("/dashboard/requisitions");
        revalidatePath("/dashboard/approvals");
        return { success: true };
    } catch (e: any) {
        console.error("Budget Update Error:", e);
        return { error: e.message || "Failed to update monthly budget" };
    }
}
