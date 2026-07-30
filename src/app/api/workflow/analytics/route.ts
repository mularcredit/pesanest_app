import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import prisma from '@/lib/prisma';

/**
 * Get workflow analytics for the current user or system-wide
 */
export async function GET(request: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const scope = searchParams.get('scope') || 'personal'; // 'personal' or 'system'
        const days = parseInt(searchParams.get('days') || '30');

        const since = new Date();
        since.setDate(since.getDate() - days);

        // Base query conditions
        const baseWhere = scope === 'personal'
            ? { approverId: session.user.id, createdAt: { gte: since } }
            : { createdAt: { gte: since } };

        // Fetch all approvals in the time period
        const approvals = await prisma.approval.findMany({
            where: baseWhere,
            include: {
                approver: {
                    select: { name: true, role: true }
                },
                expense: {
                    select: { amount: true, category: true }
                }
            }
        });

        // Calculate metrics
        const total = approvals.length;
        const approved = approvals.filter(a => a.status === 'APPROVED').length;
        const rejected = approvals.filter(a => a.status === 'REJECTED').length;
        const pending = approvals.filter(a => a.status === 'PENDING').length;
        const delegated = approvals.filter(a => a.status === 'DELEGATED').length;

        // Calculate average response time (in hours)
        const completedApprovals = approvals.filter(a => a.approvedAt);
        const avgResponseTime = completedApprovals.length > 0
            ? completedApprovals.reduce((sum, a) => {
                const responseTime = a.approvedAt!.getTime() - a.createdAt.getTime();
                return sum + responseTime;
            }, 0) / completedApprovals.length / (1000 * 60 * 60)
            : 0;

        // Calculate approval rate
        const approvalRate = total > 0 ? (approved / total) * 100 : 0;

        // Group by level
        const byLevel = approvals.reduce((acc, a) => {
            const level = a.level || 1;
            if (!acc[level]) {
                acc[level] = { total: 0, approved: 0, rejected: 0, pending: 0 };
            }
            acc[level].total++;
            if (a.status === 'APPROVED') acc[level].approved++;
            if (a.status === 'REJECTED') acc[level].rejected++;
            if (a.status === 'PENDING') acc[level].pending++;
            return acc;
        }, {} as Record<number, any>);

        // Group by category (from expenses)
        const byCategory = approvals
            .filter(a => a.expense)
            .reduce((acc, a) => {
                const category = a.expense!.category;
                if (!acc[category]) {
                    acc[category] = { total: 0, approved: 0, rejected: 0, totalAmount: 0 };
                }
                acc[category].total++;
                if (a.status === 'APPROVED') acc[category].approved++;
                if (a.status === 'REJECTED') acc[category].rejected++;
                acc[category].totalAmount += a.expense!.amount;
                return acc;
            }, {} as Record<string, any>);

        // Daily trend (last 7 days)
        const last7Days = Array.from({ length: 7 }, (_, i) => {
            const date = new Date();
            date.setDate(date.getDate() - (6 - i));
            date.setHours(0, 0, 0, 0);
            return date;
        });

        const dailyTrend = last7Days.map(date => {
            const nextDay = new Date(date);
            nextDay.setDate(nextDay.getDate() + 1);

            const dayApprovals = approvals.filter(a =>
                a.createdAt >= date && a.createdAt < nextDay
            );

            return {
                date: date.toISOString().split('T')[0],
                total: dayApprovals.length,
                approved: dayApprovals.filter(a => a.status === 'APPROVED').length,
                rejected: dayApprovals.filter(a => a.status === 'REJECTED').length,
                pending: dayApprovals.filter(a => a.status === 'PENDING').length
            };
        });

        // Overdue approvals (pending for more than 2 days)
        const twoDaysAgo = new Date();
        twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

        const overdueApprovals = await prisma.approval.findMany({
            where: {
                ...(scope === 'personal' ? { approverId: session.user.id } : {}),
                status: 'PENDING',
                createdAt: { lt: twoDaysAgo }
            },
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
                            select: { name: true }
                        }
                    }
                }
            },
            orderBy: { createdAt: 'asc' }
        });

        // Top approvers (system-wide only)
        let topApprovers: any[] = [];
        if (scope === 'system') {
            const approverStats = approvals.reduce((acc, a) => {
                const approverId = a.approverId;
                if (!acc[approverId]) {
                    acc[approverId] = {
                        name: a.approver.name,
                        role: a.approver.role,
                        total: 0,
                        approved: 0,
                        avgTime: 0,
                        times: []
                    };
                }
                acc[approverId].total++;
                if (a.status === 'APPROVED') {
                    acc[approverId].approved++;
                    if (a.approvedAt) {
                        const time = (a.approvedAt.getTime() - a.createdAt.getTime()) / (1000 * 60 * 60);
                        acc[approverId].times.push(time);
                    }
                }
                return acc;
            }, {} as Record<string, any>);

            topApprovers = Object.values(approverStats)
                .map((stats: any) => ({
                    name: stats.name,
                    role: stats.role,
                    total: stats.total,
                    approved: stats.approved,
                    approvalRate: stats.total > 0 ? (stats.approved / stats.total) * 100 : 0,
                    avgResponseTime: stats.times.length > 0
                        ? stats.times.reduce((a: number, b: number) => a + b, 0) / stats.times.length
                        : 0
                }))
                .sort((a, b) => b.total - a.total)
                .slice(0, 10);
        }

        return NextResponse.json({
            summary: {
                total,
                approved,
                rejected,
                pending,
                delegated,
                approvalRate: Math.round(approvalRate * 10) / 10,
                avgResponseTimeHours: Math.round(avgResponseTime * 10) / 10,
                overdueCount: overdueApprovals.length
            },
            byLevel,
            byCategory,
            dailyTrend,
            overdueApprovals: overdueApprovals.map(a => ({
                id: a.id,
                type: a.expense ? 'expense' : a.requisition ? 'requisition' : 'other',
                title: a.expense?.title || a.requisition?.title || 'Unknown',
                amount: a.expense?.amount || 0,
                submitter: a.expense?.user?.name || a.requisition?.user?.name || 'Unknown',
                createdAt: a.createdAt,
                daysOverdue: Math.floor((Date.now() - a.createdAt.getTime()) / (1000 * 60 * 60 * 24))
            })),
            topApprovers,
            period: {
                days,
                since,
                scope
            }
        });

    } catch (error: any) {
        console.error('Analytics error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch analytics', details: error.message },
            { status: 500 }
        );
    }
}
