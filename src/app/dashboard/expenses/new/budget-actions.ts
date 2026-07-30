"use server";

import { budgetManager } from "@/lib/budget-manager";
import { auth } from "@/auth";

export async function checkBudget(category: string, amount: number) {
    const session = await auth();
    if (!session?.user?.id) throw new Error("Unauthorized");

    try {
        const result = await budgetManager.checkExpenseAgainstBudget(
            session.user.id,
            category,
            amount
        );
        return result;
    } catch (error) {
        console.error("Budget check error:", error);
        return { allowed: true }; // Fallback to allowed if check fails
    }
}
