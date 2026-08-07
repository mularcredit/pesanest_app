import { auth } from "@/auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { requirePermission } from "@/lib/access-control";
import { getTransfers, getTransferStats, getBankAccounts, getPaybillAccounts } from "./actions";
import { getBankAccountsDetailed } from "./bank-actions";
import { getPaybillAccountsDetailed } from "./paybill-actions";
import { TransfersManager } from "./TransfersManager";

export const dynamic = 'force-dynamic';

export const metadata = {
    title: "Transfers | Pesanest",
    description: "Monitor bank, mobile money and paybill transfers",
};

export default async function TransfersPage() {
    const session = await auth();
    if (!session?.user?.id) return redirect("/login");
    requirePermission(session, ['TRANSFERS.VIEW', 'FINANCE.VIEW']);

    const [transfers, stats, bankAccounts, bankAccountRows, paybillAccounts, paybillAccountRows, user] = await Promise.all([
        getTransfers(),
        getTransferStats(),
        getBankAccounts(),
        getBankAccountsDetailed(),
        getPaybillAccounts(),
        getPaybillAccountsDetailed(),
        prisma.user.findUnique({
            where: { id: session.user.id },
            select: { role: true, customRole: { select: { isSystem: true } } },
        }),
    ]);

    const isAdmin = user?.role === 'SYSTEM_ADMIN' || !!user?.customRole?.isSystem;

    return (
        <div className="space-y-6 pb-24">
            <div>
                <h1 className="text-[20px] font-[600] text-gray-900 tracking-tight">Transfers</h1>
                <p className="text-[12.5px] text-gray-400 mt-0.5">
                    Money moved between banks, out to mobile numbers, and in and out of the paybill.
                </p>
            </div>
            <TransfersManager
                transfers={transfers}
                stats={stats}
                bankAccounts={bankAccounts}
                bankAccountRows={bankAccountRows}
                paybillAccounts={paybillAccounts}
                paybillAccountRows={paybillAccountRows}
                isAdmin={isAdmin}
            />
        </div>
    );
}
