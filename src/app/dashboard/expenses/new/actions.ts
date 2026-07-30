"use server";

import prisma from "@/lib/prisma";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { checkEnforceClosure } from "@/lib/closure-check";

const expenseSchema = z.object({
    title: z.string().min(3),
    amount: z.coerce.number().positive(),
    currency: z.string().default('KES'),
    category: z.string().min(1),
    expenseDate: z.coerce.date(),
    merchant: z.string().optional(),
    description: z.string().optional(),
    costCenter: z.enum(['OFFICE']).optional().default('OFFICE'),
    accountId: z.string().optional(),
});

export async function createExpense(formData: FormData) {
    const session = await auth();
    if (!session?.user?.id) {
        throw new Error("Unauthorized");
    }

    const etrNumber = (formData.get("etrNumber") as string)?.trim().toUpperCase() || null;

    const rawData = {
        title: formData.get("title") || "",
        amount: formData.get("amount"),
        currency: formData.get("currency") || undefined,
        category: formData.get("category") || "",
        expenseDate: formData.get("expenseDate"),
        merchant: formData.get("merchant") || undefined,
        description: formData.get("description") || undefined,
        costCenter: formData.get("costCenter") || undefined,
        accountId: formData.get("accountId") || undefined,
    };

    const validated = expenseSchema.safeParse(rawData);

    if (!validated.success) {
        return {
            errors: validated.error.flatten().fieldErrors,
        };
    }

    try {
        const closureCheck = await checkEnforceClosure(session.user.id);
        if (closureCheck.blocked) {
            return {
                message: closureCheck.message,
            };
        }

        await prisma.expense.create({
            data: {
                userId: session.user.id,
                title: validated.data.title,
                amount: validated.data.amount,
                currency: validated.data.currency,
                category: validated.data.category,
                expenseDate: validated.data.expenseDate,
                merchant: validated.data.merchant || "",
                description: validated.data.description,
                costCenter: validated.data.costCenter,
                accountId: validated.data.accountId,
                etrNumber: etrNumber || null,
                status: "DRAFT",
            },
        });
    } catch (e) {
        console.error(e);
        return {
            message: "Database Error: Failed to Create Expense.",
        };
    }

    revalidatePath("/dashboard/expenses");
    redirect("/dashboard/expenses");
}

export async function updateExpense(expenseId: string, formData: FormData) {
    const session = await auth();
    if (!session?.user?.id) {
        throw new Error("Unauthorized");
    }

    const rawData = {
        title: formData.get("title") || "",
        amount: formData.get("amount"),
        currency: formData.get("currency") || undefined,
        category: formData.get("category") || "",
        expenseDate: formData.get("expenseDate"),
        merchant: formData.get("merchant") || undefined,
        description: formData.get("description") || undefined,
        costCenter: formData.get("costCenter") || undefined,
        accountId: formData.get("accountId") || undefined,
    };

    const validated = expenseSchema.safeParse(rawData);

    if (!validated.success) {
        return {
            errors: validated.error.flatten().fieldErrors,
        };
    }

    try {
        const closureCheck = await checkEnforceClosure(session.user.id);
        if (closureCheck.blocked) {
            return {
                message: closureCheck.message,
            };
        }

        // Check if user is admin to allow editing others' records
        const currentUser = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: { role: true, customRole: { select: { isSystem: true } } }
        });
        const isAdmin = currentUser?.role === 'SYSTEM_ADMIN' || currentUser?.customRole?.isSystem;

        await prisma.expense.update({
            where: isAdmin ? { id: expenseId } : { id: expenseId, userId: session.user.id },
            data: {
                title: validated.data.title,
                amount: validated.data.amount,
                currency: validated.data.currency,
                category: validated.data.category,
                expenseDate: validated.data.expenseDate,
                merchant: validated.data.merchant || "",
                description: validated.data.description,
                costCenter: validated.data.costCenter,
                accountId: validated.data.accountId,
            },
        });
    } catch (e: any) {
        console.error("Update Expense Error:", e);
        return {
            message: `Database Error: ${e.message || "Failed to Update Expense."}`,
        };
    }

    revalidatePath("/dashboard/expenses");
    // No redirect here as it might be called from a modal
}

import { checkExpensePolicies } from "@/lib/policy-engine";
import { approvalWorkflow } from "@/lib/approval-workflow";

export async function submitExpense(expenseId: string) {
    const session = await auth();
    if (!session?.user?.id) {
        throw new Error("Unauthorized");
    }

    try {
        const expense = await prisma.expense.findUnique({
            where: { id: expenseId, userId: session.user.id }
        });

        if (!expense) return { message: "Expense not found" };

        // Run Policy Checks
        const policyResult = await checkExpensePolicies({
            title: expense.title,
            amount: expense.amount,
            category: expense.category,
            merchant: expense.merchant || undefined,
            expenseDate: expense.expenseDate,
            receiptUrl: expense.receiptUrl,
            userId: session.user.id,
            paymentMethod: expense.paymentMethod
        });

        if (!policyResult.isValid) {
            // If there are blocking violations, stop submission
            const blockers = policyResult.violations.filter(v => v.isBlocking).map(v => v.message);
            return {
                message: `Policy Violation: ${blockers.join(", ")}`
            };
        }

        // Resolve regionId for approval routing
        const userWithBranch = await prisma.user.findUnique({
            where: { id: session.user.id },
            include: { leadBranch: true }
        });
        const userRegionId = userWithBranch?.regionId || userWithBranch?.leadBranch?.regionId;

        // Initiate Approval Workflow
        const route = await approvalWorkflow.determineRoute(
            session.user.id,
            expense.amount,
            expense.category,
            !!expense.receiptUrl,
            undefined, // No requisitionType for expenses
            userRegionId || undefined
        );

        await approvalWorkflow.createApprovals(expense.id, route);
    } catch (e: any) {
        console.error(e);
        return {
            message: e.message || "Database Error: Failed to Submit Expense.",
        };
    }

    revalidatePath("/dashboard/expenses");
    revalidatePath("/dashboard/approvals");
    redirect("/dashboard/expenses");
}

