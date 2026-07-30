import Link from "next/link";
import { PiCaretLeft, PiPlus } from "react-icons/pi";
import prisma from "@/lib/prisma";
import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import { RequisitionListWithFilter } from "../../RequisitionListWithFilter";

export default async function AccountCategoryPage({ params }: { params: Promise<{ slug: string }> }) {
    const session = await auth();
    if (!session?.user?.id) return redirect("/login");

    const { slug } = await params;
    const accountName = decodeURIComponent(slug);
    const userId = session.user.id;

    const currentUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { role: true, customRole: { select: { isSystem: true } } }
    });
    const isAdmin = currentUser?.role === 'SYSTEM_ADMIN' || currentUser?.customRole?.isSystem;

    const account = await prisma.account.findFirst({
        where: { name: accountName, type: 'EXPENSE' },
        select: { id: true, name: true, code: true }
    });

    if (!account) return notFound();

    const whereReq = isAdmin
        ? { OR: [{ accountId: account.id }, { category: account.name }] }
        : { userId, OR: [{ accountId: account.id }, { category: account.name }] };

    const [rawRequisitions, monthlyBudgets] = await Promise.all([
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
        Promise.resolve([])
    ]);

    const requisitions = rawRequisitions.map((r: any) => ({
        ...r,
        receiptUrl: r.expenses?.[0]?.receiptUrl || null
    }));

    return (
        <div className="space-y-6 pb-24">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 py-8">
                <div>
                    <Link href="/dashboard/requisitions" className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-900 transition-colors mb-2">
                        <PiCaretLeft /> Back to accounts
                    </Link>
                    <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">{account.name}</h1>
                    <p className="text-gray-500 text-sm mt-1">GL-{account.code} · {requisitions.length} {requisitions.length === 1 ? 'expense' : 'expenses'}</p>
                </div>

                <div className="flex items-center gap-3">
                    <Link
                        href={`/dashboard/requisitions/new?category=${encodeURIComponent(account.name)}`}
                        className="px-5 py-2.5 bg-[#6366F1] text-white rounded-md font-medium text-xs hover:bg-[#6366F1]/90 transition-all flex items-center gap-2"
                    >
                        <PiPlus />
                        <span>New Expense</span>
                    </Link>
                </div>
            </div>

            <RequisitionListWithFilter
                requisitions={JSON.parse(JSON.stringify(requisitions))}
                monthlyBudgets={JSON.parse(JSON.stringify(monthlyBudgets))}
            />
        </div>
    );
}
