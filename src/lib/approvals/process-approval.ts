/**
 * One approval decision, lifted out of the API route so a single decision and
 * a bulk run share exactly the same authorisation and limit checks.
 */

import prisma from "@/lib/prisma";
import { approvalWorkflow } from "@/lib/approval-workflow";

export type ApprovalDecision = 'APPROVED' | 'REJECTED' | 'ADJUSTMENT';
export const APPROVAL_DECISIONS: ApprovalDecision[] = ['APPROVED', 'REJECTED', 'ADJUSTMENT'];

/** Approvers with no custom role fall back to this ceiling. */
const LEGACY_APPROVAL_LIMIT = 100;

export type Actor = {
    id: string;
    isAdmin: boolean;
    approvalLimit: number;
};

export type ApprovalResult =
    | { ok: true }
    | { ok: false; error: string; status: number };

/**
 * Resolve the acting user once. Bulk runs reuse this rather than re-reading the
 * same row for every approval in the batch.
 */
export async function loadActor(userId: string): Promise<Actor | null> {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
            role: true,
            customRole: { select: { isSystem: true, maxApprovalLimit: true } },
        },
    });
    if (!user) return null;

    const isAdmin = user.role === 'SYSTEM_ADMIN' || !!user.customRole?.isSystem;

    // A custom role with a null limit means unlimited; no custom role at all
    // means the legacy default.
    const approvalLimit = user.customRole
        ? (user.customRole.maxApprovalLimit ?? Number.MAX_SAFE_INTEGER)
        : LEGACY_APPROVAL_LIMIT;

    return { id: userId, isAdmin, approvalLimit };
}

export async function processApprovalDecision(params: {
    approvalId: string;
    decision: ApprovalDecision;
    comments?: string;
    actor: Actor;
}): Promise<ApprovalResult> {
    const { approvalId, decision, comments, actor } = params;

    if (!APPROVAL_DECISIONS.includes(decision)) {
        return { ok: false, error: 'Invalid decision. Must be APPROVED, REJECTED, or ADJUSTMENT', status: 400 };
    }

    const approval = await prisma.approval.findUnique({
        where: { id: approvalId },
        include: {
            expense: { include: { user: { select: { name: true, email: true } } } },
            requisition: { include: { user: { select: { name: true, email: true } } } },
            invoice: { include: { createdBy: { select: { name: true, email: true } } } },
        },
    });

    if (!approval) return { ok: false, error: 'Approval not found', status: 404 };

    if (approval.approverId !== actor.id && !actor.isAdmin) {
        return { ok: false, error: 'Not authorized to approve this item', status: 403 };
    }

    if (decision === 'APPROVED' && !actor.isAdmin && approval.requisition) {
        if (approval.requisition.amount > actor.approvalLimit) {
            return {
                ok: false,
                error: `Amount ($${approval.requisition.amount}) exceeds your approval limit of $${actor.approvalLimit}. Please escalate to an administrator.`,
                status: 403,
            };
        }
    }

    if (approval.status !== 'PENDING') {
        return { ok: false, error: `This approval has already been ${approval.status.toLowerCase()}`, status: 400 };
    }

    await approvalWorkflow.processApproval(approvalId, decision, comments, actor.isAdmin, actor.id);

    return { ok: true };
}

/** Human-readable label for an item behind an approval, for bulk reporting. */
export function approvalItemLabel(a: {
    expense?: { title?: string | null } | null;
    requisition?: { title?: string | null } | null;
    invoice?: { invoiceNumber?: string | null } | null;
    monthlyBudget?: { month?: number | null; year?: number | null } | null;
}): string {
    if (a.expense?.title) return a.expense.title;
    if (a.requisition?.title) return a.requisition.title;
    if (a.invoice?.invoiceNumber) return `Invoice ${a.invoice.invoiceNumber}`;
    if (a.monthlyBudget) return `Budget ${a.monthlyBudget.month}/${a.monthlyBudget.year}`;
    return 'Item';
}
