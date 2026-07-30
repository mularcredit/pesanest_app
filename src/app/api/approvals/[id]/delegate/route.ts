import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import prisma from '@/lib/prisma';

/**
 * Delegate an approval to another user
 */
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { delegateTo, reason, startDate, endDate } = await request.json();

        if (!delegateTo) {
            return NextResponse.json(
                { error: 'Delegate user ID is required' },
                { status: 400 }
            );
        }

        // Verify the approval exists and user is the current approver
        const approval = await prisma.approval.findUnique({
            where: { id },
            include: {
                expense: {
                    include: {
                        user: {
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

        if (approval.approverId !== session.user.id) {
            return NextResponse.json(
                { error: 'Not authorized to delegate this approval' },
                { status: 403 }
            );
        }

        if (approval.status !== 'PENDING') {
            return NextResponse.json(
                { error: 'Can only delegate pending approvals' },
                { status: 400 }
            );
        }

        // Verify delegate user exists
        const delegateUser = await prisma.user.findUnique({
            where: { id: delegateTo },
            select: { id: true, name: true, email: true, role: true }
        });

        if (!delegateUser) {
            return NextResponse.json(
                { error: 'Delegate user not found' },
                { status: 404 }
            );
        }

        // Update the approval
        const updatedApproval = await prisma.approval.update({
            where: { id },
            data: {
                approverId: delegateTo,
                comments: `Delegated from ${session.user.name} to ${delegateUser.name}. Reason: ${reason || 'Not specified'}`,
                // Store original approver in a custom field if needed
            }
        });

        // TODO: Send notification to delegate
        // await sendDelegationEmail(delegateUser, approval, session.user);

        return NextResponse.json({
            success: true,
            message: `Approval delegated to ${delegateUser.name}`,
            approval: {
                id: updatedApproval.id,
                newApprover: {
                    id: delegateUser.id,
                    name: delegateUser.name,
                    email: delegateUser.email
                }
            }
        });

    } catch (error: any) {
        console.error('Delegation error:', error);
        return NextResponse.json(
            { error: 'Failed to delegate approval', details: error.message },
            { status: 500 }
        );
    }
}

/**
 * Get delegation history for an approval
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
                }
            }
        });

        if (!approval) {
            return NextResponse.json(
                { error: 'Approval not found' },
                { status: 404 }
            );
        }

        // Parse delegation history from comments
        // In a production system, you'd have a separate DelegationHistory table
        const delegationHistory = approval.comments?.includes('Delegated from')
            ? [{
                from: approval.comments.match(/Delegated from (.*?) to/)?.[1] || 'Unknown',
                to: approval.approver.name,
                reason: approval.comments.match(/Reason: (.*)/)?.[1] || 'Not specified',
                date: approval.updatedAt
            }]
            : [];

        return NextResponse.json({
            approval: {
                id: approval.id,
                currentApprover: approval.approver,
                status: approval.status
            },
            delegationHistory
        });

    } catch (error: any) {
        console.error('Get delegation history error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch delegation history', details: error.message },
            { status: 500 }
        );
    }
}
