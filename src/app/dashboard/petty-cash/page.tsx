import { auth } from "@/auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { requirePermission } from "@/lib/access-control";
import {
    getPettyCashStats, getPettyCashLedger, getPettyCashExpenses,
    getFundingSources, getExpenseAccounts,
} from "./actions";
import { PettyCashManager } from "./PettyCashManager";

export const dynamic = 'force-dynamic';

export const metadata = {
    title: "Petty Cash | Pesanest",
    description: "Track the office cash float, payouts and replenishments",
};

export default async function PettyCashPage() {
    const session = await auth();
    if (!session?.user?.id) return redirect("/login");
    requirePermission(session, ['PETTY_CASH.VIEW', 'FINANCE.VIEW']);

    const [stats, ledger, pending, fundingSources, expenseAccounts, user] = await Promise.all([
        getPettyCashStats(),
        getPettyCashLedger(),
        getPettyCashExpenses(),
        getFundingSources(),
        getExpenseAccounts(),
        prisma.user.findUnique({
            where: { id: session.user.id },
            select: { role: true, customRole: { select: { isSystem: true } } },
        }),
    ]);

    const canManageLimit = user?.role === 'SYSTEM_ADMIN' || !!user?.customRole?.isSystem;

    return (
        <div className="space-y-6 pb-24">
            <div>
                <h1 className="text-[20px] font-[600] text-gray-900 tracking-tight">Petty Cash</h1>
                <p className="text-[12.5px] text-gray-400 mt-0.5">
                    The office cash float — every payout, replenishment and count, posted straight to the ledger.
                </p>
            </div>
            <PettyCashManager
                stats={stats}
                ledger={ledger}
                pending={pending}
                fundingSources={fundingSources}
                expenseAccounts={expenseAccounts}
                canManageLimit={canManageLimit}
            />
        </div>
    );
}
