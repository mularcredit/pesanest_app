import prisma from "@/lib/prisma";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { AccountsGridClient } from "./AccountsGridClient";

export default async function RequisitionsPage() {
    const session = await auth();
    if (!session?.user?.id) return redirect("/login");

    const userId = session.user.id;

    const currentUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { role: true, customRole: { select: { isSystem: true } } }
    });

    const isAdmin = currentUser?.role === 'SYSTEM_ADMIN' || currentUser?.customRole?.isSystem;
    const whereReq = isAdmin ? {} : { userId };

    const [accounts, rawRequisitions, monthlyBudgets] = await Promise.all([
        prisma.account.findMany({
            where: { type: 'EXPENSE' },
            select: { id: true, name: true, code: true },
            orderBy: { name: 'asc' }
        }),
        (prisma as any).requisition.findMany({
            where: whereReq,
            include: {
                expenses: { select: { receiptUrl: true } },
                user: { select: { name: true } },
                approvals: {
                    orderBy: { createdAt: 'desc' },
                    take: 1,
                    include: { approver: { select: { name: true, role: true } } }
                }
            },
            orderBy: { createdAt: 'desc' }
        }),
        (prisma as any).monthlyBudget ? (prisma as any).monthlyBudget.findMany({
            where: whereReq,
            include: {
                items: true,
                user: { select: { name: true } },
                approvals: {
                    orderBy: { createdAt: 'desc' },
                    take: 1,
                    include: { approver: { select: { name: true, role: true } } }
                }
            },
            orderBy: { createdAt: 'desc' }
        }).catch(() => []) : Promise.resolve([])
    ]);

    const requisitions = rawRequisitions.map((r: any) => ({
        ...r,
        receiptUrl: r.expenses?.[0]?.receiptUrl || null
    }));

    // Group requisitions by ledger account. A requisition's item category is
    // auto-mapped to the account name at creation time (see requisitions/new),
    // so matching on category name covers requisitions created before accountId
    // existed as well as ones created after.
    const accountsData = accounts.map(acc => {
        const matching = requisitions.filter((r: any) => r.accountId === acc.id || r.category === acc.name);
        const total = matching.length;
        const totalAmount = matching.reduce((sum: number, r: any) => sum + (r.amount || 0), 0);
        const pending = matching.filter((r: any) => r.status === 'PENDING').length;
        const approved = matching.filter((r: any) => ['APPROVED', 'PAID', 'COMPLETED'].includes(r.status)).length;
        const fulfilled = matching.filter((r: any) => r.status === 'FULFILLED').length;
        const rejected = matching.filter((r: any) => r.status === 'REJECTED').length;
        const lastActivity = matching[0]?.createdAt ?? null;

        return { id: acc.id, name: acc.name, code: acc.code, total, totalAmount, pending, approved, fulfilled, rejected, lastActivity };
    }).sort((a, b) => b.total - a.total);

    const totalRequisitions = requisitions.length;
    const totalAmount = requisitions.reduce((sum: number, r: any) => sum + (r.amount || 0), 0);
    const totalPending = requisitions.filter((r: any) => r.status === 'PENDING').length;

    return (
        <div className="pb-24">
            <AccountsGridClient
                accountsData={JSON.parse(JSON.stringify(accountsData))}
                totalRequisitions={totalRequisitions}
                totalAmount={totalAmount}
                totalPending={totalPending}
                allRequisitions={requisitions}
                monthlyBudgets={monthlyBudgets}
            />
        </div>
    );
}
