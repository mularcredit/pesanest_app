import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import prisma from '@/lib/prisma';
import { loadActor, processApprovalDecision } from '@/lib/approvals/process-approval';

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

        const actor = await loadActor(session.user.id);
        if (!actor) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const result = await processApprovalDecision({ approvalId: id, decision, comments, actor });

        if (!result.ok) {
            return NextResponse.json({ error: result.error }, { status: result.status });
        }

        return NextResponse.json({
            success: true,
            message: `Successfully ${String(decision).toLowerCase()}`,
            approval: { id, status: decision, comments }
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
