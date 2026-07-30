import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { approvalWorkflow } from '@/lib/approval-workflow';
import prisma from '@/lib/prisma';

/**
 * Approve or reject an approval
 */
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { decision, comments } = await request.json();

        if (!['APPROVED', 'REJECTED', 'ADJUSTMENT'].includes(decision)) {
            return NextResponse.json(
                { error: 'Invalid decision. Must be APPROVED, REJECTED, or ADJUSTMENT' },
                { status: 400 }
            );
        }

        // Verify the approval exists and user is the approver
        const approval = await prisma.approval.findUnique({
            where: { id },
            include: {
                expense: {
                    include: {
                        user: {
                            select: { name: true, email: true }
                        }
                    }
                },
                requisition: {
                    include: {
                        user: {
                            select: { name: true, email: true }
                        }
                    }
                },
                invoice: {
                    include: {
                        createdBy: {
                            select: { name: true, email: true }
                        }
                    }
                }
            }
        });

        if (!approval) {
            return NextResponse.json(
                { error: 'Approval not found' },
                { status: 404 }
            );
        }

        // Check if current user is admin and get approval limit
        const currentUser = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: {
                role: true,
                customRole: {
                    select: {
                        isSystem: true,
                        maxApprovalLimit: true
                    }
                }
            }
        });

        const isAdmin = currentUser?.role === 'SYSTEM_ADMIN' || currentUser?.customRole?.isSystem;

        // Determine approval limit
        // If user has a custom role:
        //   - null limit means unlimited (MAX_SAFE_INTEGER)
        //   - numeric limit is used
        // If user has NO custom role (legacy role):
        //   - Default limit is 100
        const customRole = currentUser?.customRole;
        const approvalLimit = customRole
            ? (customRole.maxApprovalLimit ?? Number.MAX_SAFE_INTEGER)
            : 100;

        if (approval.approverId !== session.user.id && !isAdmin) {
            return NextResponse.json(
                { error: 'Not authorized to approve this item' },
                { status: 403 }
            );
        }

        // Check Max Approval Limit for Requisitions (if approving)
        if (decision === 'APPROVED' && !isAdmin && approval.requisition) {
            if (approval.requisition.amount > approvalLimit) {
                return NextResponse.json(
                    { error: `Amount ($${approval.requisition.amount}) exceeds your approval limit of $${approvalLimit}. Please escalate to an administrator.` },
                    { status: 403 }
                );
            }
        }

        if (approval.status !== 'PENDING') {
            return NextResponse.json(
                { error: `This approval has already been ${approval.status.toLowerCase()}` },
                { status: 400 }
            );
        }

        // Process the approval using the workflow engine
        await approvalWorkflow.processApproval(
            id,
            decision,
            comments,
            isAdmin,
            session.user.id
        );

        // TODO: Send notification emails
        // if (decision === 'APPROVED') {
        //   await sendApprovalNotification(approval);
        // } else {
        //   await sendRejectionNotification(approval, comments);
        // }

        return NextResponse.json({
            success: true,
            message: `Successfully ${decision.toLowerCase()}`,
            approval: {
                id: approval.id,
                status: decision,
                comments
            }
        });

    } catch (error: any) {
        console.error('Approval action error:', error);
        return NextResponse.json(
            { error: 'Failed to process approval', details: error.message },
            { status: 500 }
        );
    }
}

/**
 * Get approval details
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const approval = await prisma.approval.findUnique({
            where: { id },
            include: {
                approver: {
                    select: { id: true, name: true, email: true, role: true }
                },
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
                invoice: {
                    include: {
                        vendor: true,
                        createdBy: {
                            select: { name: true, email: true }
                        }
                    }
                }
            }
        });

        if (!approval) {
            return NextResponse.json(
                { error: 'Approval not found' },
                { status: 404 }
            );
        }

        return NextResponse.json({ approval });

    } catch (error: any) {
        console.error('Get approval error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch approval', details: error.message },
            { status: 500 }
        );
    }
}
