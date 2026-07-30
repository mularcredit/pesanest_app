import prisma from "@/lib/prisma";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import {
    PiTrendUp,
    PiHandCoins,
    PiInvoice,
    PiUser,
    PiBuildings,
    PiFileText
} from "react-icons/pi";
import { PaymentQueue } from "../../../components/dashboard/PaymentQueue";
import { StatsCard } from "@/components/dashboard/StatsCard";

export default async function PaymentsPage() {
    const session = await auth();
    if (!session?.user?.id) return redirect("/login");

    // Check user role for scoping
    const userRole = (session.user as any)?.role || 'EMPLOYEE';
    const isBranchManager = userRole === 'TEAM_LEADER';
    
    // Fetch full user to get branch details if needed
    const userProfile = await prisma.user.findUnique({
        where: { id: session.user.id },
        include: { leadBranch: true, customRole: true }
    });
    
    const isSystemAdmin = userRole !== 'EMPLOYEE';

    const branchName = userProfile?.leadBranch?.name || userProfile?.branchId || "";
    const branchId = userProfile?.branchId || "";

    // Base conditions for Branch Managers
    const expenseWhere = isBranchManager 
        ? { status: 'APPROVED', isReimbursable: true, paymentId: null, userId: session.user.id } // Only own expenses for now unless employees have branches
        : { status: 'APPROVED', isReimbursable: true, paymentId: null };

    const invoiceWhere = isBranchManager
        ? { status: 'APPROVED', paymentStatus: { not: 'PAID' }, paymentId: null, vendor: { is: { branchId: branchId } } }
        : { status: 'APPROVED', paymentStatus: { not: 'PAID' }, paymentId: null };
        
    const pendingPaymentWhere = isBranchManager
        ? { status: 'PENDING_AUTHORIZATION', makerId: session.user.id }
        : { status: 'PENDING_AUTHORIZATION' };

    const authorizedPaymentWhere = isBranchManager
        ? { status: { in: ['AUTHORIZED', 'FAILED'] }, makerId: session.user.id }
        : { status: { in: ['AUTHORIZED', 'FAILED'] } };

    const paidPaymentWhere = isBranchManager
        ? { status: { in: ['PAID', 'PARTIALLY_PAID'] }, makerId: session.user.id }
        : { status: { in: ['PAID', 'PARTIALLY_PAID'] } };

    const payoutHistoryWhere = isBranchManager
        ? { status: { in: ['REJECTED', 'CLOSED'] }, makerId: session.user.id }
        : { status: { in: ['REJECTED', 'CLOSED'] } };

    // Fetch expenses that are APPROVED but not yet linked to a payment OR paid
    const approvedExpenses = await prisma.expense.findMany({
        where: expenseWhere as any,
        include: {
            user: {
                select: {
                    name: true,
                    email: true,
                    department: true,
                    bankAccount: true
                }
            }
        },
        orderBy: { updatedAt: 'desc' }
    });

    // Fetch invoices that are APPROVED but not paid
    const approvedInvoices = await (prisma.invoice as any).findMany({
        where: invoiceWhere as any,
        include: {
            vendor: true,
            createdBy: {
                select: { name: true, email: true }
            }
        },
        orderBy: { dueDate: 'asc' }
    });

    // Fetch requisitions that are APPROVED but not paid
    let approvedReqRecords: any[] = [];
    if (isBranchManager && branchName && branchId) {
        approvedReqRecords = await prisma.$queryRaw<any[]>`SELECT id FROM "Requisition" WHERE status = 'APPROVED' AND "paymentId" IS NULL AND ("branch" = ${branchName} OR "branchId" = ${branchId})`;
    } else {
        approvedReqRecords = await prisma.$queryRaw<any[]>`SELECT id FROM "Requisition" WHERE status = 'APPROVED' AND "paymentId" IS NULL`;
    }
    
    const approvedRequisitions = await (prisma as any).requisition.findMany({
        where: {
            id: { in: approvedReqRecords.map(r => r.id) }
        },
        include: {
            user: {
                select: { name: true, email: true, department: true }
            }
        },
        orderBy: { updatedAt: 'desc' }
    });

    // Fetch budgets that are APPROVED but not paid
    let approvedBudRecords: any[] = [];
    if (isBranchManager && branchName) {
         approvedBudRecords = await prisma.$queryRaw<any[]>`SELECT id FROM "MonthlyBudget" WHERE status = 'APPROVED' AND "paymentId" IS NULL AND "branch" = ${branchName}`;
    } else {
         approvedBudRecords = await prisma.$queryRaw<any[]>`SELECT id FROM "MonthlyBudget" WHERE status = 'APPROVED' AND "paymentId" IS NULL`;
    }

    const approvedBudgets = await (prisma as any).monthlyBudget.findMany({
        where: {
            id: { in: approvedBudRecords.map(b => b.id) }
        },
        include: {
            user: {
                select: { name: true, email: true, department: true }
            }
        },
        orderBy: { updatedAt: 'desc' }
    });

    // Fetch pending payment requests
    const pendingPayments = await prisma.payment.findMany({
        where: pendingPaymentWhere as any,
        include: {
            maker: { select: { name: true, email: true, profileImage: true } },
            _count: {
                select: { invoices: true, expenses: true }
            }
        },
        orderBy: { createdAt: 'desc' }
    });

    // Fetch authorized payment requests (Ready to Pay)
    const authorizedPayments = await prisma.payment.findMany({
        where: authorizedPaymentWhere as any,
        include: {
            maker: { select: { name: true, email: true, profileImage: true } },
            _count: {
                select: { invoices: true, expenses: true }
            }
        },
        orderBy: { updatedAt: 'desc' }
    });

    // Fetch paid payments (Ready to Close)
    const paidPayments = await prisma.payment.findMany({
        where: paidPaymentWhere as any,
        include: {
            maker: { select: { name: true, email: true, profileImage: true } },
            expenses: {
                include: {
                    user: { select: { name: true, email: true } },
                    receiptVerification: true,
                }
            },
            requisitions: {
                select: {
                    id: true,
                    title: true,
                    amount: true,
                    currency: true,
                    category: true,
                    receiptUrl: true,
                    etrNumber: true,
                    etrVerified: true,
                    user: { select: { name: true, email: true } },
                }
            },
            _count: {
                select: { invoices: true, expenses: true, requisitions: true }
            }
        },
        orderBy: { updatedAt: 'desc' }
    });

    // Fetch payout history
    const payoutHistory = await prisma.payment.findMany({
        where: payoutHistoryWhere as any,
        include: {
            maker: { select: { name: true } },
            checker: { select: { name: true } }
        },
        orderBy: { updatedAt: 'desc' },
        take: 20
    });

    // Calculate totals
    const totalExpenses = approvedExpenses.reduce((sum: number, exp: any) => sum + exp.amount, 0);
    const totalInvoices = approvedInvoices.reduce((sum: number, inv: any) => sum + inv.amount, 0);
    const totalRequisitions = approvedRequisitions.reduce((sum: number, req: any) => sum + req.amount, 0);
    const totalBudgets = approvedBudgets.reduce((sum: number, bud: any) => sum + bud.totalAmount, 0);
    const totalPending = totalExpenses + totalInvoices + totalRequisitions + totalBudgets;

    const totalAwaitingAuth = pendingPayments.reduce((sum: number, p: any) => sum + p.amount, 0);
    const totalReadyToPay = authorizedPayments.reduce((sum: number, p: any) => sum + p.amount, 0);

    // Group expenses by user for batch payments
    const expensesByUser = approvedExpenses.reduce((acc, exp) => {
        const userId = exp.userId;
        if (!acc[userId]) {
            acc[userId] = {
                user: exp.user,
                expenses: [],
                total: 0
            };
        }
        acc[userId].expenses.push(exp);
        acc[userId].total += exp.amount;
        return acc;
    }, {} as Record<string, any>);

    let paystackStatus = userProfile?.paystackCustomerCode ? 'COMPLETED' : 'NOT_CONNECTED';

    return (
        <PaymentQueue
            expenses={JSON.parse(JSON.stringify(approvedExpenses))}
            invoices={JSON.parse(JSON.stringify(approvedInvoices))}
            requisitions={JSON.parse(JSON.stringify(approvedRequisitions))}
            budgets={JSON.parse(JSON.stringify(approvedBudgets))}
            pendingPayments={JSON.parse(JSON.stringify(pendingPayments))}
            authorizedPayments={JSON.parse(JSON.stringify(authorizedPayments))}
            paidPayments={JSON.parse(JSON.stringify(paidPayments))}
            history={JSON.parse(JSON.stringify(payoutHistory))}
            userRole={userRole}
            paystackStatus={paystackStatus}
            isSystemAdmin={isSystemAdmin}
        />
    );
}
