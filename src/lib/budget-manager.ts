/**
 * Budget Management and Alert System
 * Real-time budget tracking with overspend warnings and forecasting
 */

import prisma from '@/lib/prisma';
import { EXPENSE_CATEGORIES } from '@/lib/constants';

export interface Budget {
    id: string;
    category: string;
    amount: number;
    period: 'MONTHLY' | 'QUARTERLY' | 'YEARLY';
    startDate: Date;
    endDate: Date;
    spent: number;
    remaining: number;
    percentUsed: number;
    status: 'HEALTHY' | 'WARNING' | 'CRITICAL' | 'EXCEEDED';
}

export interface BudgetAlert {
    id: string;
    type: 'WARNING' | 'CRITICAL' | 'EXCEEDED' | 'FORECAST';
    category: string;
    message: string;
    currentSpend: number;
    budgetAmount: number;
    percentUsed: number;
    daysRemaining: number;
    projectedOverspend?: number;
    severity: 'low' | 'medium' | 'high' | 'critical';
}

export class BudgetManager {
    /**
     * Get all budgets for a user with current spending
     */
    async getUserBudgets(userId: string): Promise<Budget[]> {
        const now = new Date();
        const currentMonth = now.getMonth() + 1; // 1-12
        const currentYear = now.getFullYear();

        // 1. Fetch defined budgets from DB (Production Source)
        const dbBudget = await prisma.monthlyBudget.findFirst({
            where: {
                userId,
                month: currentMonth,
                year: currentYear
            },
            include: { items: true }
        });

        // 2. Define Default Limits (Fallback/Base)
        const defaultLimits: Record<string, number> = {
            "Operations": 10000,
            "Salaries & Wages": 50000,
            "Travel & Transport": 3000,
            "Meals & Hospitality": 1500,
            "Per Diem / Allowance": 3000,
            "Casual Labor": 2000,
            "Utilities (Water, Power)": 1500,
            "Rent / Premises": 5000,
            "Office Supplies": 800,
            "Medical & Welfare": 1200,
            "Vehicle Maintenance": 1500,
            "Security Services": 1000,
            "Permits & Licenses": 2500,
            "Marketing & Branding": 4000,
            "Software & Subscriptions": 2000,
            "Equipment & Repairs": 3500,
            "Professional Services": 5000,
            "Bank Charges": 300,
            "Other": 1000
        };

        // 3. Merge Defaults with DB Overrides
        const budgetMap = new Map<string, number>();

        // Initialize with defaults for all known categories
        EXPENSE_CATEGORIES.forEach(cat => {
            budgetMap.set(cat, defaultLimits[cat] || 1000);
        });

        // Override with DB values if available
        if (dbBudget?.items) {
            dbBudget.items.forEach(item => {
                if (item.category) {
                    budgetMap.set(item.category, item.amount);
                }
            });
        }

        const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

        const expenses = await prisma.expense.findMany({
            where: {
                userId,
                expenseDate: {
                    gte: firstDayOfMonth,
                    lte: lastDayOfMonth
                },
                status: { not: 'REJECTED' }
            }
        });

        // 4. Transform to Budget Objects
        const budgets: Budget[] = Array.from(budgetMap.entries()).map(([categoryName, limit]) => {
            const categoryExpenses = expenses.filter(e => e.category === categoryName);
            const spent = categoryExpenses.reduce((sum, e) => sum + e.amount, 0);
            const remaining = limit - spent;
            const percentUsed = (spent / limit) * 100;

            let status: Budget['status'] = 'HEALTHY';
            if (percentUsed >= 100) status = 'EXCEEDED';
            else if (percentUsed >= 90) status = 'CRITICAL';
            else if (percentUsed >= 75) status = 'WARNING';

            return {
                id: dbBudget?.id ? `db-${dbBudget.id}-${categoryName}` : `default-${categoryName}`,
                category: categoryName,
                amount: limit,
                period: 'MONTHLY',
                startDate: firstDayOfMonth,
                endDate: lastDayOfMonth,
                spent,
                remaining,
                percentUsed,
                status
            };
        });

        return budgets.sort((a, b) => b.percentUsed - a.percentUsed); // Sort by usage
    }

    /**
     * Check if an expense would exceed budget
     */
    async checkExpenseAgainstBudget(
        userId: string,
        category: string,
        amount: number
    ): Promise<{
        allowed: boolean;
        warning?: string;
        currentSpend: number;
        budgetAmount: number;
        remainingAfter: number;
        percentAfter: number;
    }> {
        const budgets = await this.getUserBudgets(userId);
        const budget = budgets.find(b => b.category === category);

        if (!budget) {
            return {
                allowed: true,
                currentSpend: 0,
                budgetAmount: 0,
                remainingAfter: 0,
                percentAfter: 0
            };
        }

        const newTotal = budget.spent + amount;
        const percentAfter = (newTotal / budget.amount) * 100;
        const remainingAfter = budget.amount - newTotal;

        let warning: string | undefined;
        let allowed = true;

        if (percentAfter >= 100) {
            if (process.env.NEXT_PUBLIC_APP_NAME === 'Capital Pay') {
                allowed = true;
                warning = `Notice: This expense exceeds your ${category} budget. (Overspend allowed for Capital Pay)`;
            } else {
                allowed = false;
                warning = `This expense would exceed your ${category} budget by $${Math.abs(remainingAfter).toFixed(2)}. Current: $${budget.spent.toFixed(2)} / $${budget.amount.toFixed(2)}`;
            }
        } else if (percentAfter >= 90) {
            warning = `⚠️ Warning: This expense will bring you to ${percentAfter.toFixed(0)}% of your ${category} budget. Only $${remainingAfter.toFixed(2)} remaining.`;
        } else if (percentAfter >= 75) {
            warning = `Notice: After this expense, you'll have used ${percentAfter.toFixed(0)}% of your ${category} budget.`;
        }

        return {
            allowed,
            warning,
            currentSpend: budget.spent,
            budgetAmount: budget.amount,
            remainingAfter,
            percentAfter
        };
    }

    /**
     * Generate budget alerts based on spending patterns
     */
    async generateAlerts(userId: string): Promise<BudgetAlert[]> {
        const budgets = await this.getUserBudgets(userId);
        const alerts: BudgetAlert[] = [];
        const now = new Date();

        budgets.forEach(budget => {
            const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
            const daysPassed = now.getDate();
            const daysRemaining = daysInMonth - daysPassed;
            const expectedSpendByNow = (budget.amount / daysInMonth) * daysPassed;
            const dailyBurnRate = budget.spent / daysPassed;
            const projectedMonthEnd = dailyBurnRate * daysInMonth;

            // Alert: Budget exceeded
            if (budget.status === 'EXCEEDED') {
                alerts.push({
                    id: `alert-exceeded-${budget.category}`,
                    type: 'EXCEEDED',
                    category: budget.category,
                    message: `${budget.category} budget exceeded by $${Math.abs(budget.remaining).toFixed(2)}`,
                    currentSpend: budget.spent,
                    budgetAmount: budget.amount,
                    percentUsed: budget.percentUsed,
                    daysRemaining,
                    severity: 'critical'
                });
            }
            // Alert: Critical (90%+)
            else if (budget.status === 'CRITICAL') {
                alerts.push({
                    id: `alert-critical-${budget.category}`,
                    type: 'CRITICAL',
                    category: budget.category,
                    message: `${budget.category} budget at ${budget.percentUsed.toFixed(0)}% - only $${budget.remaining.toFixed(2)} remaining`,
                    currentSpend: budget.spent,
                    budgetAmount: budget.amount,
                    percentUsed: budget.percentUsed,
                    daysRemaining,
                    severity: 'high'
                });
            }
            // Alert: Warning (75%+)
            else if (budget.status === 'WARNING') {
                alerts.push({
                    id: `alert-warning-${budget.category}`,
                    type: 'WARNING',
                    category: budget.category,
                    message: `${budget.category} budget at ${budget.percentUsed.toFixed(0)}% with ${daysRemaining} days remaining`,
                    currentSpend: budget.spent,
                    budgetAmount: budget.amount,
                    percentUsed: budget.percentUsed,
                    daysRemaining,
                    severity: 'medium'
                });
            }

            // Alert: Forecast overspend
            if (projectedMonthEnd > budget.amount && budget.status !== 'EXCEEDED') {
                const projectedOverspend = projectedMonthEnd - budget.amount;
                alerts.push({
                    id: `alert-forecast-${budget.category}`,
                    type: 'FORECAST',
                    category: budget.category,
                    message: `At current rate, ${budget.category} will exceed budget by $${projectedOverspend.toFixed(2)} by month end`,
                    currentSpend: budget.spent,
                    budgetAmount: budget.amount,
                    percentUsed: budget.percentUsed,
                    daysRemaining,
                    projectedOverspend,
                    severity: 'medium'
                });
            }

            // Alert: Spending ahead of schedule
            if (budget.spent > expectedSpendByNow * 1.2 && budget.status === 'HEALTHY') {
                alerts.push({
                    id: `alert-pace-${budget.category}`,
                    type: 'WARNING',
                    category: budget.category,
                    message: `${budget.category} spending ${((budget.spent / expectedSpendByNow - 1) * 100).toFixed(0)}% ahead of expected pace`,
                    currentSpend: budget.spent,
                    budgetAmount: budget.amount,
                    percentUsed: budget.percentUsed,
                    daysRemaining,
                    severity: 'low'
                });
            }
        });

        // Sort by severity
        const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        return alerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
    }

    /**
     * Get budget summary statistics
     */
    async getBudgetSummary(userId: string) {
        const budgets = await this.getUserBudgets(userId);
        const totalBudget = budgets.reduce((sum, b) => sum + b.amount, 0);
        const totalSpent = budgets.reduce((sum, b) => sum + b.spent, 0);
        const totalRemaining = totalBudget - totalSpent;

        const healthyCount = budgets.filter(b => b.status === 'HEALTHY').length;
        const warningCount = budgets.filter(b => b.status === 'WARNING').length;
        const criticalCount = budgets.filter(b => b.status === 'CRITICAL').length;
        const exceededCount = budgets.filter(b => b.status === 'EXCEEDED').length;

        return {
            totalBudget,
            totalSpent,
            totalRemaining,
            percentUsed: (totalSpent / totalBudget) * 100,
            budgetCount: budgets.length,
            healthyCount,
            warningCount,
            criticalCount,
            exceededCount,
            overallStatus: exceededCount > 0 ? 'EXCEEDED'
                : criticalCount > 0 ? 'CRITICAL'
                    : warningCount > 0 ? 'WARNING'
                        : 'HEALTHY'
        };
    }
}

// Singleton instance
export const budgetManager = new BudgetManager();
