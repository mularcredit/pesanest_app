/**
 * Approval Workflow Automation Engine
 * Intelligent routing based on amount, category, department, and custom rules
 */

import prisma from '@/lib/prisma';

export interface ApprovalRule {
    id: string;
    name: string;
    priority: number;
    conditions: {
        amountMin?: number;
        amountMax?: number;
        categories?: string[];
        departments?: string[];
        requiresReceipt?: boolean;
        requisitionType?: string;
    };
    approvers: {
        level: number;
        role: string;
        required: boolean;
    }[];
}

export interface ApprovalRoute {
    levels: {
        level: number;
        approvers: {
            id: string;
            name: string;
            email: string;
            role: string;
        }[];
        required: boolean;
        status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'SKIPPED';
    }[];
    estimatedDays: number;
    autoApprove: boolean;
    reason: string;
}

export class ApprovalWorkflowEngine {
    private rules: ApprovalRule[] = [
        {
            id: 'rule-1',
            name: 'Small expenses auto-approve',
            priority: 1,
            conditions: {
                amountMax: 50
            },
            approvers: []
        },

        {
            id: 'rule-standard-approval',
            name: 'Standard Approval Chain',
            priority: 10, // Catch-all for everything else over $50
            conditions: {
                amountMin: 50
            },
            approvers: [
                { level: 1, role: 'REGIONAL_MANAGER', required: true },
                { level: 2, role: 'FINANCE_APPROVER', required: true },
                { level: 3, role: 'SYSTEM_ADMIN', required: true }
            ]
        }
    ];

    /**
     * Determine approval route for an expense
     */
    async determineRoute(
        userId: string,
        amount: number,
        category: string,
        hasReceipt: boolean,
        requisitionType?: string,
        regionId?: string
    ): Promise<ApprovalRoute> {


        // 1. Check for Dynamic Auto-Approval Policies in DB
        const autoApprovalPolicies = await prisma.policy.findMany({
            where: {
                type: 'AUTO_APPROVAL',
                isActive: true
            }
        });

        // Parallelize initial checks context
        const userPromise = prisma.user.findUnique({
            where: { id: userId },
            include: { manager: true }
        });

        for (const policy of autoApprovalPolicies) {
            try {
                const rules = JSON.parse(policy.rules);
                if (rules.amountMax !== undefined && amount <= rules.amountMax) {
                    return {
                        levels: [],
                        estimatedDays: 0,
                        autoApprove: true,
                        reason: `Auto-approved by policy: ${policy.name} (Threshold: KES ${rules.amountMax})`
                    };
                }
            } catch (e) {
                console.error(`Failed to parse rules for policy ${policy.id}`);
            }
        }

        // 2. Fallback to hardcoded rules (or find matching rule)
        const matchingRule = this.findMatchingRule(amount, category, hasReceipt, requisitionType);

        if (matchingRule) {
            if (matchingRule.approvers.length === 0) {
                return {
                    levels: [],
                    estimatedDays: 0,
                    autoApprove: true,
                    reason: `Auto-approved by rule: ${matchingRule.name}`
                };
            }
        }

        if (!matchingRule) {
            // If no rules match and no auto-approval policy was found, 
            // check if we should still auto-approve based on the legacy rule-1
            if (amount <= 50) {
                return {
                    levels: [],
                    estimatedDays: 0,
                    autoApprove: true,
                    reason: `Auto-approved: Legacy threshold ($50)`
                };
            }

            // If it's over $50 and no rules match, we probably need at least one approval or it's an error.
            // For safety, let's skip auto-approve if no policy/rule found for larger amounts.
            return {
                levels: [],
                estimatedDays: 0,
                autoApprove: false,
                reason: `No matching approval path found for $${amount}`
            };
        }

        // Get user context (we might have already started this promise above)
        const user = await userPromise;

        const levels = await Promise.all(
            matchingRule.approvers.map(async (approverRule) => {
                const approvers = await this.getApprovers(
                    approverRule.role,
                    user?.managerId || null,
                    user?.department || null,
                    regionId
                );

                return {
                    level: approverRule.level,
                    approvers: approvers.map(a => ({
                        id: a.id,
                        name: a.name,
                        email: a.email,
                        role: a.role
                    })),
                    required: approverRule.required,
                    status: 'PENDING' as const
                };
            })
        );

        const estimatedDays = levels.length * 1.5; // Estimate 1.5 days per level

        return {
            levels,
            estimatedDays,
            autoApprove: false,
            reason: `Matched rule: ${matchingRule.name}`
        };
    }

    /**
     * Find the matching approval rule
     */
    private findMatchingRule(
        amount: number,
        category: string,
        hasReceipt: boolean,
        requisitionType?: string
    ): ApprovalRule | null {
        // Sort by priority and find first match
        const sorted = [...this.rules].sort((a, b) => a.priority - b.priority);

        for (const rule of sorted) {
            const { conditions } = rule;

            // Check amount range
            if (conditions.amountMin !== undefined && amount < conditions.amountMin) continue;
            if (conditions.amountMax !== undefined && amount > conditions.amountMax) continue;

            // Check category
            if (conditions.categories && !conditions.categories.includes(category)) continue;

            // Check receipt requirement
            if (conditions.requiresReceipt && !hasReceipt) continue;

            // Check Requisition Type
            if (conditions.requisitionType && conditions.requisitionType !== requisitionType) continue;

            return rule;
        }

        return null;
    }

    /**
     * Get approvers based on role
     */
    private async getApprovers(
        role: string,
        managerId: string | null,
        department: string | null,
        regionId?: string
    ) {
        if (role === 'REGIONAL_MANAGER' && regionId) {
            // Find regional manager for this specific region
            return await prisma.user.findMany({
                where: {
                    role: 'REGIONAL_MANAGER',
                    regionId: regionId,
                    isActive: true
                }
            });
        }

        if (role === 'MANAGER' && managerId) {
            const manager = await prisma.user.findUnique({
                where: { id: managerId }
            });
            return manager ? [manager] : [];
        }

        // Get users by role
        return await prisma.user.findMany({
            where: {
                role,
                isActive: true,
                ...(department && role === 'FINANCE_TEAM' ? { department } : {})
            },
            take: 3
        });
    }

    /**
     * Create approval records for an expense
     */
    async createApprovals(expenseId: string, route: ApprovalRoute) {
        if (route.autoApprove) {
            // Auto-approve the expense
            await prisma.expense.update({
                where: { id: expenseId },
                data: { status: 'APPROVED' }
            });
            return [];
        }

        // Parallelize all approval creations
        const approvalPromises = route.levels.flatMap(level =>
            level.approvers.map(approver =>
                prisma.approval.create({
                    data: {
                        expenseId,
                        approverId: approver.id,
                        level: level.level,
                        status: 'PENDING'
                    }
                })
            )
        );

        const approvals = await Promise.all(approvalPromises);

        // Update expense status
        await prisma.expense.update({
            where: { id: expenseId },
            data: { status: 'PENDING_APPROVAL' }
        });

        return approvals;
    }

    /**
     * Create approval records for a requisition
     */
    async createRequisitionApprovals(requisitionId: string, route: ApprovalRoute) {
        if (route.autoApprove) {
            await prisma.requisition.update({
                where: { id: requisitionId },
                data: { status: 'APPROVED' }
            });
            return [];
        }

        // Parallelize all requisition approval creations
        const approvalPromises = route.levels.flatMap(level =>
            level.approvers.map(approver =>
                prisma.approval.create({
                    data: {
                        requisitionId,
                        approverId: approver.id,
                        level: level.level,
                        status: 'PENDING'
                    }
                })
            )
        );

        const approvals = await Promise.all(approvalPromises);

        return approvals;
    }

    /**
     * Create approval records for a budget plan
     */
    async createBudgetApprovals(budgetId: string, route: ApprovalRoute) {
        if (route.autoApprove) {
            await (prisma as any).monthlyBudget.update({
                where: { id: budgetId },
                data: { status: 'APPROVED' }
            });
            return [];
        }

        // Parallelize all budget approval creations
        const approvalPromises = route.levels.flatMap(level =>
            level.approvers.map(approver =>
                prisma.approval.create({
                    data: {
                        monthlyBudgetId: budgetId,
                        approverId: approver.id,
                        level: level.level,
                        status: 'PENDING'
                    }
                })
            )
        );

        const approvals = await Promise.all(approvalPromises);

        return approvals;
    }

    async processApproval(
        approvalId: string,
        decision: 'APPROVED' | 'REJECTED' | 'ADJUSTMENT',
        comments?: string,
        isOverride: boolean = false,
        actualApproverId?: string
    ) {
        const updateData: any = {
            status: decision,
            comments,
            approvedAt: new Date()
        };

        // If an admin is overriding the approval, update the approverId so 
        // the audit log reflects exactly who performed the action.
        if (isOverride && actualApproverId) {
            updateData.approverId = actualApproverId;
        }

        const approval = await prisma.approval.update({
            where: { id: approvalId },
            data: updateData,
            include: {
                expense: {
                    include: {
                        approvals: true
                    }
                },
                requisition: {
                    include: {
                        approvals: true
                    }
                },
                monthlyBudget: {
                    include: {
                        approvals: true
                    }
                }
            }
        });

        // Handle Expense Approval
        if (approval.expense) {
            if (decision === 'REJECTED' || decision === 'ADJUSTMENT' || isOverride) {
                const finalStatus = decision === 'APPROVED' ? 'APPROVED' : (decision === 'ADJUSTMENT' ? 'ADJUSTMENT_REQUIRED' : 'REJECTED');
                await prisma.expense.update({
                    where: { id: approval.expenseId! },
                    data: { status: finalStatus }
                });

                if (isOverride) {
                    // Mark all other pending approvals as SKIPPED
                    await prisma.approval.updateMany({
                        where: {
                            expenseId: approval.expenseId!,
                            status: 'PENDING'
                        },
                        data: { status: 'SKIPPED' }
                    });
                }
                return;
            }

            const pendingApprovals = approval.expense.approvals.filter(a => a.status === 'PENDING');
            if (pendingApprovals.length === 0) {
                await prisma.expense.update({
                    where: { id: approval.expenseId! },
                    data: { status: 'APPROVED' }
                });
            }
        }

        // Handle Requisition Approval
        if (approval.requisition) {
            if (decision === 'REJECTED' || decision === 'ADJUSTMENT' || isOverride) {
                const finalStatus = decision === 'APPROVED' ? 'APPROVED' : (decision === 'ADJUSTMENT' ? 'ADJUSTMENT_REQUIRED' : 'REJECTED');
                await prisma.requisition.update({
                    where: { id: approval.requisitionId! },
                    data: { status: finalStatus }
                });

                if (isOverride) {
                    await prisma.approval.updateMany({
                        where: {
                            requisitionId: approval.requisitionId!,
                            status: 'PENDING'
                        },
                        data: { status: 'SKIPPED' }
                    });
                }
                return;
            }

            const pendingApprovals = approval.requisition.approvals.filter(a => a.status === 'PENDING');
            if (pendingApprovals.length === 0) {
                await prisma.requisition.update({
                    where: { id: approval.requisitionId! },
                    data: { status: 'APPROVED' }
                });
            }
        }

        // Handle Budget Approval
        if (approval.monthlyBudget) {
            if (decision === 'REJECTED' || decision === 'ADJUSTMENT' || isOverride) {
                const finalStatus = decision === 'APPROVED' ? 'APPROVED' : (decision === 'ADJUSTMENT' ? 'ADJUSTMENT_REQUIRED' : 'REJECTED');
                await (prisma as any).monthlyBudget.update({
                    where: { id: approval.monthlyBudgetId! },
                    data: { status: finalStatus }
                });

                if (isOverride) {
                    await prisma.approval.updateMany({
                        where: {
                            monthlyBudgetId: approval.monthlyBudgetId!,
                            status: 'PENDING'
                        },
                        data: { status: 'SKIPPED' }
                    });
                }
                return;
            }

            const pendingApprovals = (approval.monthlyBudget as any).approvals.filter((a: any) => a.status === 'PENDING');
            if (pendingApprovals.length === 0) {
                await (prisma as any).monthlyBudget.update({
                    where: { id: approval.monthlyBudgetId! },
                    data: { status: 'APPROVED' }
                });
            }
        }
    }

    /**
     * Get pending approvals for a user
     */
    async getPendingApprovals(approverId: string) {
        return await prisma.approval.findMany({
            where: {
                approverId,
                status: 'PENDING'
            },
            include: {
                expense: {
                    include: {
                        user: true
                    }
                }
            },
            orderBy: {
                createdAt: 'asc'
            }
        });
    }

    /**
     * Get approval statistics
     */
    async getApprovalStats(approverId: string, days: number = 30) {
        const since = new Date();
        since.setDate(since.getDate() - days);

        const approvals = await prisma.approval.findMany({
            where: {
                approverId,
                createdAt: { gte: since }
            }
        });

        const total = approvals.length;
        const approved = approvals.filter(a => a.status === 'APPROVED').length;
        const rejected = approvals.filter(a => a.status === 'REJECTED').length;
        const pending = approvals.filter(a => a.status === 'PENDING').length;

        // Calculate average response time
        const completedApprovals = approvals.filter(a => a.approvedAt);
        const avgResponseTime = completedApprovals.length > 0
            ? completedApprovals.reduce((sum, a) => {
                const responseTime = a.approvedAt!.getTime() - a.createdAt.getTime();
                return sum + responseTime;
            }, 0) / completedApprovals.length / (1000 * 60 * 60) // Convert to hours
            : 0;

        return {
            total,
            approved,
            rejected,
            pending,
            approvalRate: total > 0 ? (approved / total) * 100 : 0,
            avgResponseTimeHours: avgResponseTime
        };
    }
}

// Singleton instance
export const approvalWorkflow = new ApprovalWorkflowEngine();
