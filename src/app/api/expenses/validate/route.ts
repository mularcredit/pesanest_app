/**
 * Smart Expense Validation API
 * Validates expenses using ML categorization, budget checks, policy enforcement, and approval routing
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getCategorizationEngine } from '@/lib/categorization-engine';
import { budgetManager } from '@/lib/budget-manager';
import { policyEngine } from '@/lib/policy-engine';
import { approvalWorkflow } from '@/lib/approval-workflow';
import prisma from '@/lib/prisma';

export async function POST(request: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const {
            title,
            amount,
            category,
            expenseDate,
            merchant,
            description,
            hasReceipt,
            requisitionId
        } = body;

        const userId = session.user.id;

        // 1. Smart Categorization
        const categorizationEngine = await getCategorizationEngine();
        const categorySuggestions = categorizationEngine.suggestCategory(
            title,
            merchant,
            amount,
            description
        );

        // 2. Budget Check
        const budgetCheck = await budgetManager.checkExpenseAgainstBudget(
            userId,
            category || categorySuggestions[0]?.category || 'Other',
            amount
        );

        // 3. Policy Validation
        const policyCheck = await policyEngine.validateExpense(userId, {
            amount,
            category: category || categorySuggestions[0]?.category || 'Other',
            expenseDate: new Date(expenseDate),
            title,
            description,
            merchant,
            hasReceipt: hasReceipt || false,
            requisitionId
        });

        // Resolve regionId for approval routing
        const userWithBranch = await prisma.user.findUnique({
            where: { id: userId },
            include: { leadBranch: true }
        });
        const userRegionId = userWithBranch?.regionId || userWithBranch?.leadBranch?.regionId;

        // 4. Approval Route Determination
        const approvalRoute = await approvalWorkflow.determineRoute(
            userId,
            amount,
            category || categorySuggestions[0]?.category || 'Other',
            hasReceipt || false,
            undefined, // No requisitionType for expenses
            userRegionId || undefined
        );

        // Determine overall status
        const canSubmit = policyCheck.canSubmit && budgetCheck.allowed;
        const requiresAttention = !canSubmit || budgetCheck.warning || policyCheck.warnings.length > 0;

        return NextResponse.json({
            success: true,
            validation: {
                canSubmit,
                requiresAttention,

                // Smart Categorization Results
                categorization: {
                    suggestions: categorySuggestions,
                    confidence: categorySuggestions[0]?.confidence || 0,
                    recommended: categorySuggestions[0]?.category
                },

                // Budget Analysis
                budget: {
                    allowed: budgetCheck.allowed,
                    warning: budgetCheck.warning,
                    currentSpend: budgetCheck.currentSpend,
                    budgetAmount: budgetCheck.budgetAmount,
                    remainingAfter: budgetCheck.remainingAfter,
                    percentAfter: budgetCheck.percentAfter
                },

                // Policy Compliance
                policy: {
                    compliant: policyCheck.compliant,
                    violations: policyCheck.violations,
                    warnings: policyCheck.warnings,
                    info: policyCheck.info
                },

                // Approval Workflow
                approval: {
                    autoApprove: approvalRoute.autoApprove,
                    levels: approvalRoute.levels,
                    estimatedDays: approvalRoute.estimatedDays,
                    reason: approvalRoute.reason
                }
            }
        });

    } catch (error: any) {
        console.error('Expense validation error:', error);
        return NextResponse.json(
            { error: 'Validation failed', details: error.message },
            { status: 500 }
        );
    }
}
