import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { postVirtualTopup } from "@/lib/accounting/wallet-gl";

// POST /api/wallet/virtual-topup — admin-only, credits the internal wallet
// balance directly. No Paystack call, no real money involved.
export async function POST(req: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const role = (session.user as any).role;
    if (role !== "SYSTEM_ADMIN") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const amount = parseFloat(body.amount);

    if (!amount || amount <= 0) {
        return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
    }

    const userId = session.user.id;
    const reason = body.reason?.trim() || "Virtual funds added by admin";

    try {
        const wallet = await prisma.wallet.findUnique({ where: { userId } });
        if (!wallet) return NextResponse.json({ error: "Wallet not found" }, { status: 404 });

        const reference = `VTOPUP-${Date.now()}`;

        const result = await prisma.$transaction(async (tx) => {
            const updated = await (tx as any).wallet.update({
                where: { id: wallet.id },
                data: { balance: { increment: amount } }
            });

            await (tx as any).walletTransaction.create({
                data: {
                    walletId: wallet.id,
                    userId,
                    type: "DEPOSIT",
                    amount,
                    description: reason,
                    reference
                }
            });

            await postVirtualTopup(tx as any, {
                amount,
                walletGlAccountId: (wallet as any).glAccountId,
                userId,
                reference
            });

            return updated;
        });

        return NextResponse.json({ success: true, balance: result.balance });
    } catch (error: any) {
        console.error("Virtual top up failed:", error);
        return NextResponse.json({ error: error.message || "Failed to add virtual funds" }, { status: 500 });
    }
}
