import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { paystackService } from "@/lib/payments/paystack";
import { postPaystackTopup } from "@/lib/accounting/wallet-gl";

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { reference } = body;

        if (!reference) {
            return NextResponse.json({ error: "Missing reference" }, { status: 400 });
        }

        // Verify the payment
        const verification = await paystackService.verifyTransaction(reference);

        if (verification.status !== 'success') {
            return NextResponse.json({ error: "Payment was not successful" }, { status: 400 });
        }

        // Transaction succeeds, locate the pending record in database
        const transaction = await prisma.walletTransaction.findFirst({
            where: { reference: reference }
        });

        if (!transaction) {
            return NextResponse.json({ error: "Transaction record not found" }, { status: 404 });
        }

        // Check if already credited to avoid double-crediting
        // We look for 'Completed' or check wallet. We can add a simple check using exactly the same amount.
        // Actually, DEPOSIT doesn't have a status field in the schema right now. 
        // We will just verify if the description contains 'COMPLETED' or update it.
        if (transaction.description.includes('[COMPLETED]')) {
            return NextResponse.json({ success: true, amount: transaction.amount, alreadyVerified: true });
        }

        const wallet = await prisma.wallet.findUnique({
            where: { id: transaction.walletId },
            include: { user: { select: { name: true, phoneNumber: true } } },
        }) as any;

        // Critical: update wallet balance and mark transaction complete (atomic)
        await prisma.$transaction([
            prisma.wallet.update({
                where: { id: transaction.walletId },
                data: { balance: { increment: transaction.amount } }
            }),
            prisma.walletTransaction.update({
                where: { id: transaction.id },
                data: { description: `Wallet Top Up [COMPLETED]` }
            }),
        ]);

        // Non-critical: GL journal entry — failure here must NOT roll back the balance update
        try {
            await postPaystackTopup(prisma as any, {
                amount: transaction.amount,
                walletGlAccountId: wallet?.glAccountId,
                reference,
            });
        } catch (glErr) {
            console.error('[Wallet GL] GL posting failed (non-critical):', glErr);
        }

        // Non-critical: SMS confirmation to wallet owner
        if (wallet?.user?.phoneNumber) {
            const newBalance = (wallet.balance ?? 0) + transaction.amount;
            import('@/lib/sms/sms-service')
                .then(({ smsService }) => smsService.sendWalletTopup(
                    wallet.user.phoneNumber,
                    wallet.user.name ?? 'User',
                    transaction.amount,
                    newBalance,
                ))
                .catch(() => {});
        }

        return NextResponse.json({ success: true, amount: transaction.amount });

    } catch (error: any) {
        console.error("TopUp Verification failed:", error);
        return NextResponse.json({ error: error.message || "Failed to verify top up" }, { status: 500 });
    }
}
