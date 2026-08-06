import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import {
    processPaymentAction,
    PAYMENT_ACTIONS,
    type PaymentAction,
    type DisburseSummary,
} from "@/lib/payments/process-payment-action";

const MAX_BATCH = 100;

type PerPayment = {
    paymentId: string;
    reference: string | null;
    amount: number;
    ok: boolean;
    error?: string;
    summary?: DisburseSummary;
};

/**
 * POST — run one lifecycle action across many payments.
 *
 * Strictly sequential. DISBURSE decrements a shared wallet and calls Paystack
 * per item, so running these concurrently would race the balance check against
 * the debit and could overdraw. Sequential also means an exhausted balance
 * simply fails the remaining payments instead of corrupting earlier ones.
 *
 * One failure never aborts the batch — every payment is attempted and reported.
 */
export async function POST(req: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();
        const { paymentIds, action, paymentMethod, proofUrl } = body as {
            paymentIds?: unknown;
            action?: PaymentAction;
            paymentMethod?: any;
            proofUrl?: string;
        };

        if (!action || !PAYMENT_ACTIONS.includes(action)) {
            return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
        }

        if (!Array.isArray(paymentIds) || paymentIds.length === 0) {
            return NextResponse.json({ error: 'Select at least one payment' }, { status: 400 });
        }

        const ids = Array.from(new Set(paymentIds.filter((v): v is string => typeof v === 'string' && v.length > 0)));
        if (ids.length === 0) {
            return NextResponse.json({ error: 'Select at least one payment' }, { status: 400 });
        }
        if (ids.length > MAX_BATCH) {
            return NextResponse.json(
                { error: `Too many payments selected — process at most ${MAX_BATCH} at a time` },
                { status: 400 }
            );
        }

        // Read reference/amount up front for reporting: a rejected payment has its
        // items detached, so re-reading afterwards would lose the context.
        const known = await prisma.payment.findMany({
            where: { id: { in: ids } },
            select: { id: true, reference: true, amount: true },
        });
        const meta = new Map(known.map(p => [p.id, p]));

        const results: PerPayment[] = [];

        for (const paymentId of ids) {
            const info = meta.get(paymentId);
            const base = {
                paymentId,
                reference: info?.reference ?? null,
                amount: info?.amount ?? 0,
            };

            try {
                const result = await processPaymentAction({
                    paymentId,
                    action,
                    paymentMethod,
                    proofUrl,
                    userId: session.user.id,
                });

                if (result.ok) {
                    // A disbursement whose items all failed is not a success.
                    const s = result.summary;
                    if (s && s.success === 0 && s.failed > 0) {
                        results.push({ ...base, ok: false, error: s.errors[0] || 'All transfers failed', summary: s });
                    } else {
                        results.push({ ...base, ok: true, summary: s });
                    }
                } else {
                    results.push({ ...base, ok: false, error: result.error });
                }
            } catch (err: any) {
                console.error(`[BulkPaymentAction] ${action} failed for ${paymentId}:`, err);
                results.push({ ...base, ok: false, error: err?.message || 'Unexpected error' });
            }
        }

        const succeeded = results.filter(r => r.ok);
        const failed = results.filter(r => !r.ok);

        // Roll the per-item disbursement counts up across the batch.
        const items = results.reduce(
            (acc, r) => {
                if (r.summary) {
                    acc.success += r.summary.success;
                    acc.failed += r.summary.failed;
                    acc.details.push(...r.summary.details);
                }
                return acc;
            },
            { success: 0, failed: 0, details: [] as DisburseSummary['details'] }
        );

        return NextResponse.json({
            success: failed.length === 0,
            action,
            requested: ids.length,
            succeeded: succeeded.length,
            failed: failed.length,
            amountProcessed: succeeded.reduce((s, r) => s + (r.amount || 0), 0),
            items,
            results,
        });

    } catch (error) {
        console.error('Bulk payment action error:', error);
        return NextResponse.json({ error: 'Failed to process bulk action' }, { status: 500 });
    }
}
