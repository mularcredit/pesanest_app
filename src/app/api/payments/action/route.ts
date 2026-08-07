import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { processPaymentAction, PAYMENT_ACTIONS } from "@/lib/payments/process-payment-action";

// POST - Authorize, Reject, Disburse or Close a single payment.
// The state machine itself lives in lib so the bulk endpoint shares it exactly.
export async function POST(req: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();
        const { paymentId, action, paymentMethod, proofUrl, settlementAccountId, settlementKind } = body;

        if (!PAYMENT_ACTIONS.includes(action)) {
            return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
        }

        const result = await processPaymentAction({
            paymentId,
            action,
            paymentMethod,
            proofUrl,
            userId: session.user.id,
            settlement: settlementAccountId || settlementKind ? { accountId: settlementAccountId, kind: settlementKind } : undefined,
        });

        if (!result.ok) {
            return NextResponse.json({ error: result.error }, { status: result.status });
        }

        return result.summary
            ? NextResponse.json({ success: true, summary: result.summary })
            : NextResponse.json({ success: true });

    } catch (error) {
        console.error('Payment authorization error:', error);
        return NextResponse.json({ error: 'Failed to process authorization' }, { status: 500 });
    }
}
