import prisma from "@/lib/prisma";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { ExpensesClient } from "./ExpensesClient";

export default async function ExpensesPage() {
    const session = await auth();
    if (!session?.user?.id) return redirect("/login");

    const userId = session.user.id;

    // Check for System Admin role
    const currentUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { role: true, customRole: { select: { isSystem: true } } }
    });

    const isAdmin = currentUser?.role === 'SYSTEM_ADMIN' || currentUser?.customRole?.isSystem;

    // Fetch expenses based on role
    const whereDrafts = isAdmin ? { status: 'DRAFT' } : { userId, status: 'DRAFT' };
    const whereSubmitted = isAdmin ? { NOT: { status: 'DRAFT' } } : { userId, NOT: { status: 'DRAFT' } };

    const draftExpenses = await prisma.expense.findMany({
        where: whereDrafts,
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { name: true } } } // Include user name for admin visibility
    });

    const submittedExpenses = await prisma.expense.findMany({
        where: whereSubmitted,
        orderBy: { expenseDate: 'desc' },
        include: { 
            user: { select: { name: true } },
            approvals: {
                orderBy: { createdAt: 'desc' },
                take: 1,
                include: { approver: { select: { name: true, role: true } } }
            }
        }
    });

    const unsubmittedAmount = draftExpenses.reduce((sum: number, exp: any) => sum + exp.amount, 0);

    return (
        <ExpensesClient
            draftExpenses={JSON.parse(JSON.stringify(draftExpenses))}
            submittedExpenses={JSON.parse(JSON.stringify(submittedExpenses))}
            unsubmittedAmount={unsubmittedAmount}
            isAdmin={!!isAdmin}
        />
    );
}
