import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import prisma from '@/lib/prisma';
import {
    loadActor,
    processApprovalDecision,
    approvalItemLabel,
    APPROVAL_DECISIONS,
    type ApprovalDecision,
} from '@/lib/approvals/process-approval';

const MAX_BATCH = 200;

/**
 * POST — apply one decision to many approvals.
 *
 * Sequential: the workflow engine advances levels and can create the next
 * approval in a chain, so decisions are ordered rather than raced. One failure
 * (wrong approver, over limit, already decided) never aborts the batch — each
 * approval is attempted and reported on its own.
 */
export async function POST(req: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();
        const { approvalIds, decision, comments } = body as {
            approvalIds?: unknown;
            decision?: ApprovalDecision;
            comments?: string;
        };

        if (!decision || !APPROVAL_DECISIONS.includes(decision)) {
            return NextResponse.json(
                { error: 'Invalid decision. Must be APPROVED, REJECTED, or ADJUSTMENT' },
                { status: 400 }
            );
        }

        if (!Array.isArray(approvalIds) || approvalIds.length === 0) {
            return NextResponse.json({ error: 'Select at least one item' }, { status: 400 });
        }

        const ids = Array.from(new Set(
            approvalIds.filter((v): v is string => typeof v === 'string' && v.length > 0)
        ));
        if (ids.length === 0) {
            return NextResponse.json({ error: 'Select at least one item' }, { status: 400 });
        }
        if (ids.length > MAX_BATCH) {
            return NextResponse.json(
                { error: `Too many items selected — process at most ${MAX_BATCH} at a time` },
                { status: 400 }
            );
        }

        const actor = await loadActor(session.user.id);
        if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        // Titles are read up front: once a decision is processed the workflow may
        // move the item on, and a rejected item is no longer easy to describe.
        const known = await prisma.approval.findMany({
            where: { id: { in: ids } },
            select: {
                id: true,
                expense: { select: { title: true, amount: true } },
                requisition: { select: { title: true, amount: true } },
                invoice: { select: { invoiceNumber: true, amount: true } },
                monthlyBudget: { select: { month: true, year: true, totalAmount: true } },
            },
        });
        const meta = new Map(known.map(a => [a.id, a]));

        const results: { approvalId: string; label: string; amount: number; ok: boolean; error?: string }[] = [];

        for (const approvalId of ids) {
            const info = meta.get(approvalId);
            const label = info ? approvalItemLabel(info as any) : 'Item';
            const amount =
                info?.expense?.amount ??
                info?.requisition?.amount ??
                info?.invoice?.amount ??
                info?.monthlyBudget?.totalAmount ??
                0;

            try {
                const result = await processApprovalDecision({ approvalId, decision, comments, actor });
                results.push(
                    result.ok
                        ? { approvalId, label, amount: Number(amount), ok: true }
                        : { approvalId, label, amount: Number(amount), ok: false, error: result.error }
                );
            } catch (err: any) {
                console.error(`[BulkApproval] ${decision} failed for ${approvalId}:`, err);
                results.push({ approvalId, label, amount: Number(amount), ok: false, error: err?.message || 'Unexpected error' });
            }
        }

        const succeeded = results.filter(r => r.ok);
        const failed = results.filter(r => !r.ok);

        return NextResponse.json({
            success: failed.length === 0,
            decision,
            requested: ids.length,
            succeeded: succeeded.length,
            failed: failed.length,
            amountProcessed: succeeded.reduce((s, r) => s + (r.amount || 0), 0),
            results,
        });

    } catch (error: any) {
        console.error('Bulk approval error:', error);
        return NextResponse.json(
            { error: 'Failed to process bulk approval', details: error.message },
            { status: 500 }
        );
    }
}
