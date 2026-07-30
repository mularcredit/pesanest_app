import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { auth } from '@/auth';
import { revalidatePath } from 'next/cache';

// GET - Fetch pending approvals assigned to current user
export async function GET(req: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const userId = session.user.id;

        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { role: true }
        });

        const isAdmin = user?.role === 'SYSTEM_ADMIN';

        // Fetch pending approvals specifically assigned to this user (or all if admin)
        const myPendingApprovals = await prisma.approval.findMany({
            where: {
                ...(isAdmin ? {} : { approverId: userId }),
                status: 'PENDING'
            },
            include: {
                expense: {
                    include: {
                        user: {
                            select: { name: true, email: true, department: true }
                        }
                    }
                },
                requisition: {
                    include: {
                        user: {
                            select: { name: true, email: true, department: true }
                        }
                    }
                },
                monthlyBudget: {
                    include: {
                        user: {
                            select: { name: true, email: true, department: true }
                        }
                    }
                },
                invoice: {
                    include: {
                        vendor: true,
                        createdBy: {
                            select: { name: true, email: true, department: true }
                        },
                        items: true
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        const expenses = myPendingApprovals.filter(a => a.expense).map(a => ({ ...a.expense!, approvalId: a.id }));
        const requisitions = myPendingApprovals.filter(a => a.requisition).map(a => ({ ...a.requisition!, approvalId: a.id }));
        const budgets = myPendingApprovals.filter(a => a.monthlyBudget).map(a => ({ ...a.monthlyBudget!, approvalId: a.id }));
        const invoices = myPendingApprovals.filter(a => a.invoice).map(a => ({ ...a.invoice!, approvalId: a.id }));

        return NextResponse.json({
            expenses,
            requisitions,
            budgets,
            invoices,
            counts: {
                expenses: expenses.length,
                requisitions: requisitions.length,
                budgets: budgets.length,
                invoices: invoices.length,
                total: expenses.length + requisitions.length + budgets.length + invoices.length
            }
        });

    } catch (error) {
        console.error('Approval fetch error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch approvals' },
            { status: 500 }
        );
    }
}

// POST - Approve or reject an expense/requisition
export async function POST(req: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();
        const { itemId, itemType, action, comments } = body;

        // Validate required fields
        if (!itemId || !itemType || !action) {
            return NextResponse.json(
                { error: 'Missing required fields: itemId, itemType, action' },
                { status: 400 }
            );
        }

        if (!['APPROVE', 'REJECT'].includes(action)) {
            return NextResponse.json(
                { error: 'Invalid action. Must be APPROVE or REJECT' },
                { status: 400 }
            );
        }

        let updatedItem;
        let approvalRecord;

        if (itemType === 'EXPENSE') {
            // Update expense status
            const newStatus = action === 'APPROVE' ? 'APPROVED' : 'REJECTED';

            updatedItem = await prisma.expense.update({
                where: { id: itemId },
                data: {
                    status: newStatus
                }
            });

            // Create approval record
            approvalRecord = await prisma.approval.create({
                data: {
                    expenseId: itemId,
                    approverId: session.user.id,
                    status: newStatus,
                    comments: comments || null,
                    level: 1 // Simple single-level approval for now
                }
            });

        } else if (itemType === 'REQUISITION') {
            // Update requisition status
            const newStatus = action === 'APPROVE' ? 'APPROVED' : 'REJECTED';

            updatedItem = await prisma.requisition.update({
                where: { id: itemId },
                data: {
                    status: newStatus
                }
            });

            // Create approval record
            approvalRecord = await prisma.approval.create({
                data: {
                    requisitionId: itemId,
                    approverId: session.user.id,
                    status: newStatus,
                    comments: comments || null,
                    level: 1
                }
            });

        } else if (itemType === 'BUDGET') {
            // Update budget status
            const newStatus = action === 'APPROVE' ? 'APPROVED' : 'REJECTED';

            updatedItem = await (prisma as any).monthlyBudget.update({
                where: { id: itemId },
                data: {
                    status: newStatus
                }
            });

            // Create approval record
            approvalRecord = await prisma.approval.create({
                data: {
                    monthlyBudgetId: itemId,
                    approverId: session.user.id,
                    status: newStatus,
                    comments: comments || null,
                    level: 1
                }
            });

        } else if (itemType === 'INVOICE') {
            // Update invoice status
            const newStatus = action === 'APPROVE' ? 'APPROVED' : 'REJECTED';

            updatedItem = await prisma.invoice.update({
                where: { id: itemId },
                data: {
                    status: newStatus
                }
            });

            // ✨ NEW: Auto-post to General Ledger when APPROVED
            if (action === 'APPROVE') {
                try {
                    const { AccountingEngine } = await import('@/lib/accounting/accounting-engine');
                    await AccountingEngine.postVendorInvoice(itemId);
                    console.log(`✅ Posted vendor invoice to General Ledger`);
                } catch (glError) {
                    console.error(`❌ Failed to post vendor invoice to GL:`, glError);
                    // Invoice is approved but not posted to GL - manual journal entry may be needed
                }
            }

            // Create approval record
            approvalRecord = await prisma.approval.create({
                data: {
                    invoiceId: itemId,
                    approverId: session.user.id,
                    status: newStatus,
                    comments: comments || null,
                    level: 1
                }
            });

        } else {
            return NextResponse.json(
                { error: 'Invalid itemType. Must be EXPENSE, REQUISITION, BUDGET or INVOICE' },
                { status: 400 }
            );
        }

        revalidatePath('/dashboard/approvals');
        revalidatePath('/dashboard/expenses');
        revalidatePath('/dashboard/requisitions');
        revalidatePath('/dashboard/requisitions/monthly');
        revalidatePath('/dashboard/invoices');
        revalidatePath('/dashboard');

        // Non-critical: SMS to submitter
        const submitterUserId = (updatedItem as any).userId ?? (updatedItem as any).createdById ?? null;
        if (submitterUserId) {
            import('@/lib/sms/sms-service').then(async ({ smsService }) => {
                const submitter = await prisma.user.findUnique({
                    where: { id: submitterUserId },
                    select: { name: true, phoneNumber: true },
                });
                if (submitter?.phoneNumber) {
                    const title = (updatedItem as any).title
                        ?? (updatedItem as any).invoiceNumber
                        ?? `${itemType.toLowerCase()} #${itemId.slice(-6).toUpperCase()}`;
                    await smsService.sendApprovalDecision(
                        submitter.phoneNumber,
                        submitter.name ?? 'User',
                        itemType as any,
                        title,
                        (updatedItem as any).amount ?? 0,
                        action as any,
                        body.comments ?? null,
                    );
                }
            }).catch(() => {});
        }

        return NextResponse.json({
            success: true,
            action,
            item: updatedItem,
            approval: approvalRecord,
            message: `${itemType} ${action === 'APPROVE' ? 'approved' : 'rejected'} successfully`
        });

    } catch (error) {
        console.error('Approval action error:', error);
        return NextResponse.json(
            { error: 'Failed to process approval' },
            { status: 500 }
        );
    }
}
