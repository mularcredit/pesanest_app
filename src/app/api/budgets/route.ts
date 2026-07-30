/**
 * Budget Dashboard API
 * Real-time budget tracking with alerts and forecasting
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { budgetManager } from '@/lib/budget-manager';

export async function GET(request: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const userId = session.user.id;

        // Get comprehensive budget data
        const [budgets, alerts, summary] = await Promise.all([
            budgetManager.getUserBudgets(userId),
            budgetManager.generateAlerts(userId),
            budgetManager.getBudgetSummary(userId)
        ]);

        return NextResponse.json({
            success: true,
            data: {
                budgets,
                alerts,
                summary
            }
        });

    } catch (error: any) {
        console.error('Budget fetch error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch budget data', details: error.message },
            { status: 500 }
        );
    }
}
