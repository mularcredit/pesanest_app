import prisma from "@/lib/prisma";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { ApprovalQueue } from "../../../components/dashboard/ApprovalQueue";

export default async function ApprovalsPage() {
    const session = await auth();
    if (!session?.user?.id) return redirect("/login");

    const currentUser = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { role: true }
    });

    const isAdmin = currentUser?.role === 'SYSTEM_ADMIN';

    // Fetch pending approvals
    const myPendingApprovals = await prisma.approval.findMany({
        where: {
            ...(isAdmin ? {} : { approverId: session.user.id }),
            status: 'PENDING'
        },
        include: {
            expense: {
                include: {
                    user: {
                        select: { name: true, email: true, department: true }
                    },
                    approvals: {
                        where: { NOT: { comments: null } },
                        orderBy: { createdAt: 'desc' },
                        include: { approver: { select: { name: true, role: true } } }
                    }
                }
            },
            requisition: {
                include: {
                    user: {
                        select: { name: true, email: true, department: true }
                    },
                    approvals: {
                        where: { NOT: { comments: null } },
                        orderBy: { createdAt: 'desc' },
                        include: { approver: { select: { name: true, role: true } } }
                    }
                }
            },
            monthlyBudget: {
                include: {
                    user: {
                        select: { name: true, email: true, department: true }
                    },
                    approvals: {
                        where: { NOT: { comments: null } },
                        orderBy: { createdAt: 'desc' },
                        include: { approver: { select: { name: true, role: true } } }
                    }
                }
            },
            invoice: {
                include: {
                    vendor: true,
                    createdBy: {
                        select: { name: true, email: true, department: true }
                    },
                    items: true,
                    approvals: {
                        where: { NOT: { comments: null } },
                        orderBy: { createdAt: 'desc' },
                        include: { approver: { select: { name: true, role: true } } }
                    }
                }
            }
        },
        orderBy: { createdAt: 'desc' }
    });

    // Separate approvals by type and extract the items with approval IDs, deduplicating on underlying item ID
    const pendingExpenses = Array.from(new Map(
        myPendingApprovals.filter(a => a.expense).map(a => [a.expense!.id, { ...a.expense!, approvalId: a.id }])
    ).values());

    const pendingRequisitions = Array.from(new Map(
        myPendingApprovals.filter(a => a.requisition).map(a => [a.requisition!.id, { ...a.requisition!, approvalId: a.id }])
    ).values());

    const pendingBudgets = Array.from(new Map(
        myPendingApprovals.filter(a => a.monthlyBudget).map(a => [a.monthlyBudget!.id, { ...a.monthlyBudget!, approvalId: a.id }])
    ).values());

    const pendingInvoices = Array.from(new Map(
        myPendingApprovals.filter(a => a.invoice).map(a => [a.invoice!.id, { ...a.invoice!, approvalId: a.id }])
    ).values());

    // Fetch approval history
    const approvalHistory = await prisma.approval.findMany({
        where: {
            ...(isAdmin ? {} : { approverId: session.user.id }),
            status: { in: ['APPROVED', 'REJECTED'] }
        },
        include: {
            expense: {
                include: {
                    user: {
                        select: { name: true }
                    }
                }
            },
            requisition: {
                include: {
                    user: {
                        select: { name: true }
                    }
                }
            },
            monthlyBudget: {
                include: {
                    user: {
                        select: { name: true }
                    }
                }
            },
            invoice: {
                include: {
                    createdBy: {
                        select: { name: true }
                    }
                }
            }
        },
        orderBy: { createdAt: 'desc' },
        take: 20
    });

    return (
        <ApprovalQueue
            expenses={JSON.parse(JSON.stringify(pendingExpenses))}
            requisitions={JSON.parse(JSON.stringify(pendingRequisitions))}
            budgets={JSON.parse(JSON.stringify(pendingBudgets))}
            invoices={JSON.parse(JSON.stringify(pendingInvoices))}
            history={JSON.parse(JSON.stringify(approvalHistory))}
        />
    );
}
