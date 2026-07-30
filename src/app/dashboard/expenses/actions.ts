'use server'

import prisma from "@/lib/prisma";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import { checkExpensePolicies } from "@/lib/policy-engine";
import { approvalWorkflow } from "@/lib/approval-workflow";

export async function submitAllDrafts() {
    const session = await auth();
    if (!session?.user?.id) {
        return { success: false, error: "Unauthorized" };
    }

    try {
        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: { role: true, customRole: { select: { isSystem: true } } }
        });
        const isAdmin = user?.role === 'SYSTEM_ADMIN' || user?.customRole?.isSystem;

        // 1. Fetch all draft expenses (Admins see all drafts in the UI, so they should be able to submit all)
        const drafts = await prisma.expense.findMany({
            where: isAdmin ? { status: 'DRAFT' } : { userId: session.user.id, status: 'DRAFT' },
            include: { user: { include: { leadBranch: true } } }
        });

        if (drafts.length === 0) {
            return { success: true, count: 0, message: "No draft expenses to submit." };
        }

        let submittedCount = 0;
        let errors: string[] = [];

        // 2. Process each expense
        for (const expense of drafts) {
            // Check Policies using the original creator's ID
            const policyResult = await checkExpensePolicies({
                title: expense.title,
                amount: expense.amount,
                category: expense.category,
                merchant: expense.merchant || undefined,
                expenseDate: expense.expenseDate,
                receiptUrl: expense.receiptUrl,
                userId: expense.userId,
                paymentMethod: expense.paymentMethod
            });

            // Identify blocking violations
            const blockers = policyResult.violations.filter(v => v.isBlocking).map(v => v.message);

            if (blockers.length > 0) {
                errors.push(`"${expense.title}": ${blockers.join(", ")}`);
                continue; // Skip submitting this one
            }

            const userRegionId = (expense.user as any)?.regionId || (expense.user as any)?.leadBranch?.regionId;

            // Initiate Approval Workflow using the original creator's ID
            const route = await approvalWorkflow.determineRoute(
                expense.userId,
                expense.amount,
                expense.category,
                !!expense.receiptUrl,
                undefined, // No requisitionType for expenses
                userRegionId || undefined
            );

            await approvalWorkflow.createApprovals(expense.id, route);
            submittedCount++;
        }

        revalidatePath('/dashboard/expenses');
        revalidatePath('/dashboard/approvals');

        if (submittedCount === drafts.length) {
            return { success: true, count: submittedCount, message: `Successfully submitted ${submittedCount} expenses.` };
        } else {
            return {
                success: false,
                count: submittedCount,
                message: `Submitted ${submittedCount} expenses. ${errors.length} failed due to policies.`,
                errors
            };
        }

    } catch (error) {
        console.error("Error submitting drafts:", error);
        return { success: false, error: "Failed to submit expenses" };
    }
}

export async function submitSelectedExpenses(ids: string[]) {
    const session = await auth();
    if (!session?.user?.id) {
        return { success: false, error: "Unauthorized" };
    }

    if (!ids || ids.length === 0) {
        return { success: false, error: "No expenses selected" };
    }

    try {
        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: { role: true, customRole: { select: { isSystem: true } } }
        });
        const isAdmin = user?.role === 'SYSTEM_ADMIN' || user?.customRole?.isSystem;

        let submittedCount = 0;
        let errors: string[] = [];

        // 1. Fetch the selected expenses
        const expenses = await prisma.expense.findMany({
            where: {
                id: { in: ids },
                status: 'DRAFT',
                ...(isAdmin ? {} : { userId: session.user.id })
            },
            include: { user: { include: { leadBranch: true } } }
        });

        if (expenses.length === 0) {
            return { success: false, error: "No valid draft expenses found to submit." };
        }

        // 2. Process each expense
        for (const expense of expenses) {
            // Check Policies using the original creator's ID
            const policyResult = await checkExpensePolicies({
                title: expense.title,
                amount: expense.amount,
                category: expense.category,
                merchant: expense.merchant || undefined,
                expenseDate: expense.expenseDate,
                receiptUrl: expense.receiptUrl,
                userId: expense.userId,
                paymentMethod: expense.paymentMethod
            });

            // Identify blocking violations
            const blockers = policyResult.violations.filter(v => v.isBlocking).map(v => v.message);

            if (blockers.length > 0) {
                errors.push(`"${expense.title}": ${blockers.join(", ")}`);
                continue; // Skip submitting this one
            }

            const userRegionId = (expense.user as any)?.regionId || (expense.user as any)?.leadBranch?.regionId;

            // Initiate Approval Workflow using the original creator's ID
            const route = await approvalWorkflow.determineRoute(
                expense.userId,
                expense.amount,
                expense.category,
                !!expense.receiptUrl,
                undefined, // No requisitionType for expenses
                userRegionId || undefined
            );

            await approvalWorkflow.createApprovals(expense.id, route);
            submittedCount++;
        }

        revalidatePath('/dashboard/expenses');
        revalidatePath('/dashboard/approvals');

        if (submittedCount === expenses.length) {
            return { success: true, count: submittedCount, message: `Successfully submitted ${submittedCount} expenses.` };
        } else {
            return {
                success: false,
                count: submittedCount,
                message: `Submitted ${submittedCount} expenses. ${errors.length} failed due to policies.`,
                errors
            };
        }

    } catch (error) {
        console.error("Error submitting selected expenses:", error);
        return { success: false, error: "Failed to submit expenses" };
    }
}

export async function deleteExpense(id: string) {
    const session = await auth();
    if (!session?.user?.id) {
        return { success: false, error: "Unauthorized" };
    }

    try {
        // Verify ownership and status
        const expense = await prisma.expense.findUnique({
            where: { id },
            select: { userId: true, status: true }
        });

        if (!expense) {
            return { success: false, error: "Expense not found" };
        }

        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: { role: true, customRole: { select: { isSystem: true } } }
        });

        const isAdmin = user?.role === 'SYSTEM_ADMIN' || user?.customRole?.isSystem;
        if (!isAdmin) {
            return { success: false, error: "Only System Admins can delete expenses" };
        }

        /*
        // Original Logic allowed owners to delete drafts.
        // User Requirement: ONLY System Admin can delete ANYTHING.
        if (expense.userId !== session.user.id) {
            return { success: false, error: "Unauthorized" };
        }
        */

        if (expense.status !== 'DRAFT') {
            return { success: false, error: "Only draft expenses can be deleted" };
        }

        await prisma.expense.delete({
            where: { id }
        });

        revalidatePath('/dashboard/expenses');
        return { success: true, message: "Expense deleted successfully" };
    } catch (error) {
        console.error("Error deleting expense:", error);
        return { success: false, error: "Failed to delete expense" };
    }
}

export async function rejectExpense(id: string) {
    const session = await auth();
    if (!session?.user?.id) {
        return { success: false, error: "Unauthorized" };
    }

    try {
        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: { role: true, customRole: { select: { isSystem: true } } }
        });

        const isAdmin = user?.role === 'SYSTEM_ADMIN' || user?.customRole?.isSystem;
        if (!isAdmin) {
            return { success: false, error: "Only System Admins can reject expenses" };
        }

        await prisma.expense.update({
            where: { id },
            data: { status: 'REJECTED' }
        });

        revalidatePath('/dashboard/expenses');
        return { success: true, message: "Expense rejected successfully" };
    } catch (error) {
        console.error("Error rejecting expense:", error);
        return { success: false, error: "Failed to reject expense" };
    }
}

