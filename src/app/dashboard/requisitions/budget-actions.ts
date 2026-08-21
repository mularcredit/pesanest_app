"use server";

import prisma from "@/lib/prisma";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { BUDGET_RULE_BRANCH, BUDGET_RULE_DEPARTMENT } from "./budget-constants";

/**
 * Creates or updates a category spending-limit "rule" for the current month —
 * the Budget Rules quick-create flow (/dashboard/budgets). Unlike
 * createMonthlyBudget, this is a personal alert-threshold config, not a spend
 * request, so it saves immediately as APPROVED with no approval routing.
 */
export async function createBudgetRule(data: { category: string; amount: number }) {
    const session = await auth();
    if (!session?.user?.id) throw new Error("Unauthorized");

    if (!data.category || !(data.amount > 0)) {
        return { error: "A category and a positive amount are required" };
    }

    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();

    try {
        const existing = await prisma.monthlyBudget.findFirst({
            where: {
                userId: session.user.id, month, year,
                branch: BUDGET_RULE_BRANCH, department: BUDGET_RULE_DEPARTMENT,
            },
            include: { items: true },
        });

        if (!existing) {
            await prisma.monthlyBudget.create({
                data: {
                    userId: session.user.id, month, year,
                    branch: BUDGET_RULE_BRANCH, department: BUDGET_RULE_DEPARTMENT,
                    totalAmount: data.amount, status: "APPROVED",
                    items: { create: [{ description: `${data.category} budget rule`, category: data.category, amount: data.amount }] },
                },
            });
        } else {
            const existingItem = existing.items.find(i => i.category === data.category);
            if (existingItem) {
                await prisma.budgetItem.update({ where: { id: existingItem.id }, data: { amount: data.amount } });
            } else {
                await prisma.budgetItem.create({
                    data: { budgetId: existing.id, description: `${data.category} budget rule`, category: data.category, amount: data.amount },
                });
            }
            const total = await prisma.budgetItem.aggregate({ where: { budgetId: existing.id }, _sum: { amount: true } });
            await prisma.monthlyBudget.update({ where: { id: existing.id }, data: { totalAmount: total._sum.amount || data.amount } });
        }

        revalidatePath("/dashboard/budgets");
        revalidatePath("/dashboard");
        return { success: true };
    } catch (e: any) {
        console.error("Budget Rule Creation Error:", e);
        return { error: e.message || "Failed to create budget rule" };
    }
}

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
