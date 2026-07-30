export const dynamic = 'force-dynamic';

import prisma from "@/lib/prisma";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { BiWallet } from "react-icons/bi";
import { WalletVerifier } from "@/components/dashboard/WalletVerifier";
import { Suspense } from "react";
import { paystackService } from "@/lib/payments/paystack";
import { WalletPageClient } from "./WalletPageClient";

export default async function WalletPage() {
    const session = await auth();
    if (!session?.user?.id) return redirect("/login");

    const isAdmin = (session.user as any).role === "SYSTEM_ADMIN";

    const [wallet, branchesData] = await Promise.all([
        prisma.wallet.findUnique({
            where: { userId: session.user.id },
            include: {
                transactions: { orderBy: { createdAt: 'desc' }, take: 200 }
            }
        }),
        prisma.branch.findMany({
            where: { isActive: true },
            select: { id: true, name: true }
        })
    ]);

    // Auto-verify any pending topups on every page load (force-dynamic ensures fresh run)
    if (wallet) {
        const pendingTopups = wallet.transactions.filter(
            tx => tx.type === 'DEPOSIT' &&
            !tx.description.includes('[COMPLETED]') &&
            tx.reference !== null
        );
        if (pendingTopups.length > 0) {
            console.log(`[Wallet] Found ${pendingTopups.length} pending topup(s) for user ${session.user.id}`);
        }
        for (const tx of pendingTopups) {
            try {
                const verification = await paystackService.verifyTransaction(tx.reference!);
                if (verification.status !== 'success') {
                    // Mark abandoned/failed refs so they stop being retried
                    if (verification.status === 'abandoned' || verification.status === 'failed') {
                        await prisma.walletTransaction.update({
                            where: { id: tx.id },
                            data: { description: `Wallet Top Up [${verification.status.toUpperCase()}]` }
                        });
                        tx.description = `Wallet Top Up [${verification.status.toUpperCase()}]`;
                    }
                    continue;
                }
                await prisma.$transaction([
                    prisma.wallet.update({ where: { id: tx.walletId }, data: { balance: { increment: tx.amount } } }),
                    prisma.walletTransaction.update({ where: { id: tx.id }, data: { description: 'Wallet Top Up [COMPLETED]' } }),
                ]);
                (wallet as any).balance += tx.amount;
                tx.description = 'Wallet Top Up [COMPLETED]';
                console.log(`[Wallet] Auto-credited ${tx.amount} from ${tx.reference}`);
            } catch (err: any) {
                // Paystack doesn't know this reference — orphaned record, mark it so it's not retried
                if (err?.message?.includes('not found') || err?.message?.includes('Transaction reference')) {
                    await prisma.walletTransaction.update({
                        where: { id: tx.id },
                        data: { description: 'Wallet Top Up [NOT FOUND]' }
                    }).catch(() => {});
                    tx.description = 'Wallet Top Up [NOT FOUND]';
                } else {
                    console.error(`[Wallet] Auto-verify failed for ${tx.reference}:`, err);
                }
            }
        }
    }

    const dbBalance = wallet?.balance ?? 0;

    // Paystack is the source of truth for the displayed balance
    let liveBalance = dbBalance;
    let paystackBalance: number | null = null;
    try {
        const paystackBalances = await paystackService.getBalance();
        const targetCurrency = wallet?.currency || 'KES';
        const balanceData = paystackBalances.find((b: any) =>
            b.currency?.toUpperCase() === targetCurrency.toUpperCase()
        );
        if (balanceData) {
            paystackBalance = balanceData.balance / 100;
            liveBalance = paystackBalance; // card shows live Paystack balance
        }
    } catch { /* fall back to DB balance */ }

    if (!wallet) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
                <div className="w-12 h-12 rounded-[10px] bg-gray-50 flex items-center justify-center"
                    style={{ border: '1px solid rgba(0,0,0,0.07)' }}>
                    <BiWallet className="text-2xl text-gray-300" />
                </div>
                <div className="text-center">
                    <h2 className="text-[14px] font-[600] text-gray-900">No wallet assigned</h2>
                    <p className="text-[12.5px] text-gray-400 mt-0.5">No corporate wallet has been linked to your account.</p>
                </div>
            </div>
        );
    }

    // Running balances — walk desc (newest→oldest), balance after each tx
    let runningBal = liveBalance;
    const txLedger = wallet.transactions.map(tx => {
        const balAfter = runningBal;
        runningBal -= tx.amount;
        return {
            id: tx.id,
            createdAt: tx.createdAt.toISOString(),
            description: tx.description,
            type: tx.type,
            reference: tx.reference,
            amount: tx.amount,
            runningBalance: balAfter,
        };
    });

    return (
        <>
            <Suspense fallback={null}>
                <WalletVerifier />
            </Suspense>
            <WalletPageClient
                liveBalance={liveBalance}
                paystackBalance={paystackBalance}
                dbBalance={dbBalance}
                currency={wallet.currency}
                branches={branchesData.map(b => ({ id: b.id, name: b.name }))}
                holderName={session.user.name || "Corporate Wallet"}
                isAdmin={isAdmin}
                txLedger={txLedger}
            />
        </>
    );
}
