import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import prisma from '@/lib/prisma';

/**
 * Check for overdue approvals and escalate them
 * This should be called by a cron job or manually
 */
export async function POST(request: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Only admins or system can trigger escalation
        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: { role: true }
        });

        if (!user || !['SYSTEM_ADMIN', 'FINANCE_APPROVER', 'EXECUTIVE'].includes(user.role)) {
            return NextResponse.json(
                { error: 'Not authorized to trigger escalation' },
                { status: 403 }
            );
        }

        const { daysOverdue = 2, action = 'notify' } = await request.json();

        const overdueDate = new Date();
        overdueDate.setDate(overdueDate.getDate() - daysOverdue);

        // Find overdue approvals
        const overdueApprovals = await prisma.approval.findMany({
            where: {
                status: 'PENDING',
                createdAt: { lt: overdueDate }
            },
            include: {
                approver: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        managerId: true,
                        manager: {
                            select: {
                                id: true,
                                name: true,
                                email: true,
                                role: true
                            }
                        }
                    }
                },
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
                            select: { name: true }
                        }
                    }
                }
            },
            orderBy: { createdAt: 'asc' }
        });

        const results = {
            total: overdueApprovals.length,
            notified: 0,
            escalated: 0,
            autoApproved: 0,
            details: [] as any[]
        };

        for (const approval of overdueApprovals) {
            const daysOld = Math.floor(
                (Date.now() - approval.createdAt.getTime()) / (1000 * 60 * 60 * 24)
            );

            let actionTaken = 'none';

            if (action === 'notify' || daysOld < 5) {
                // Send reminder notification
                // TODO: await sendReminderEmail(approval.approver, approval);
                actionTaken = 'notified';
                results.notified++;
            } else if (action === 'escalate' && daysOld >= 5 && approval.approver.manager) {
                // Escalate to manager
                await prisma.approval.update({
                    where: { id: approval.id },
                    data: {
                        approverId: approval.approver.manager.id,
                        comments: `Escalated from ${approval.approver.name} to ${approval.approver.manager.name} after ${daysOld} days of inactivity.`
                    }
                });

                // TODO: await sendEscalationEmail(approval.approver.manager, approval);
                actionTaken = 'escalated';
                results.escalated++;
            } else if (action === 'auto-approve' && daysOld >= 7) {
                // Auto-approve after 7 days
                await prisma.approval.update({
                    where: { id: approval.id },
                    data: {
                        status: 'APPROVED',
                        approvedAt: new Date(),
                        comments: `Auto-approved after ${daysOld} days of inactivity (system escalation).`
                    }
                });

                // Check if all approvals are complete
                if (approval.expenseId) {
                    const allApprovals = await prisma.approval.findMany({
                        where: { expenseId: approval.expenseId }
                    });

                    const allComplete = allApprovals.every(a =>
                        a.status === 'APPROVED' || a.status === 'REJECTED'
                    );

                    if (allComplete) {
                        await prisma.expense.update({
                            where: { id: approval.expenseId },
                            data: { status: 'APPROVED' }
                        });
                    }
                }

                actionTaken = 'auto-approved';
                results.autoApproved++;
            }

            results.details.push({
                approvalId: approval.id,
                type: approval.expense ? 'expense' : approval.requisition ? 'requisition' : 'other',
                title: approval.expense?.title || approval.requisition?.title || 'Unknown',
                approver: approval.approver.name,
                daysOverdue: daysOld,
                actionTaken
            });
        }

        return NextResponse.json({
            success: true,
            message: `Processed ${results.total} overdue approvals`,
            results
        });

    } catch (error: any) {
        console.error('Escalation error:', error);
        return NextResponse.json(
            { error: 'Failed to process escalation', details: error.message },
            { status: 500 }
        );
    }
}

/**
 * Get overdue approvals summary
 */
export async function GET(request: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const daysOverdue = parseInt(searchParams.get('days') || '2');

        const overdueDate = new Date();
        overdueDate.setDate(overdueDate.getDate() - daysOverdue);

        const overdueApprovals = await prisma.approval.findMany({
            where: {
                status: 'PENDING',
                createdAt: { lt: overdueDate }
            },
            include: {
                approver: {
                    select: { name: true, email: true, role: true }
                },
                expense: {
                    select: { title: true, amount: true }
                },
                requisition: {
                    select: { title: true, amount: true }
                }
            },
            orderBy: { createdAt: 'asc' }
        });

        const summary = {
            total: overdueApprovals.length,
            byDays: {
                '2-4': 0,
                '5-6': 0,
                '7+': 0
            },
            byApprover: {} as Record<string, number>
        };

        overdueApprovals.forEach(approval => {
            const daysOld = Math.floor(
                (Date.now() - approval.createdAt.getTime()) / (1000 * 60 * 60 * 24)
            );

            if (daysOld >= 7) summary.byDays['7+']++;
            else if (daysOld >= 5) summary.byDays['5-6']++;
            else summary.byDays['2-4']++;

            const approverName = approval.approver.name;
            summary.byApprover[approverName] = (summary.byApprover[approverName] || 0) + 1;
        });

        return NextResponse.json({
            summary,
            approvals: overdueApprovals.map(a => ({
                id: a.id,
                type: a.expense ? 'expense' : a.requisition ? 'requisition' : 'other',
                title: a.expense?.title || a.requisition?.title || 'Unknown',
                amount: a.expense?.amount || a.requisition?.amount || 0,
                approver: a.approver.name,
                createdAt: a.createdAt,
                daysOverdue: Math.floor((Date.now() - a.createdAt.getTime()) / (1000 * 60 * 60 * 24))
            }))
        });

    } catch (error: any) {
        console.error('Get overdue approvals error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch overdue approvals', details: error.message },
            { status: 500 }
        );
    }
}
