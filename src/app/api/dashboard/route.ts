import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function GET() {
    try {
        // Get current user (hardcoded for now - will be from session later)
        const userId = 'john.doe@expense.sys'

        const user = await prisma.user.findUnique({
            where: { email: userId },
            include: {
                wallet: true,
                expenses: {
                    where: {
                        status: 'PENDING_APPROVAL'
                    }
                }
            }
        })

        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 })
        }

        // Get wallet balance
        const walletBalance = user.wallet?.balance || 0

        // Get pending approvals count (expenses waiting for approval)
        const pendingApprovalsCount = user.expenses.length

        // Get monthly spend (current month)
        const now = new Date()
        const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

        const monthlyExpenses = await prisma.expense.findMany({
            where: {
                userId: user.id,
                expenseDate: {
                    gte: firstDayOfMonth
                }
            }
        })

        const monthlySpend = monthlyExpenses.reduce((sum, exp) => sum + exp.amount, 0)

        // Get average reimbursement
        const reimbursedExpenses = await prisma.expense.findMany({
            where: {
                userId: user.id,
                status: 'REIMBURSED'
            },
            take: 10,
            orderBy: {
                createdAt: 'desc'
            }
        })

        const avgReimbursement = reimbursedExpenses.length > 0
            ? reimbursedExpenses.reduce((sum, exp) => sum + exp.amount, 0) / reimbursedExpenses.length
            : 0

        // Get recent transactions
        const recentTransactions = await prisma.expense.findMany({
            where: {
                userId: user.id
            },
            take: 5,
            orderBy: {
                expenseDate: 'desc'
            }
        })

        // Get spend analytics (last 12 months)
        const twelveMonthsAgo = new Date()
        twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12)

        const yearlyExpenses = await prisma.expense.findMany({
            where: {
                userId: user.id,
                expenseDate: {
                    gte: twelveMonthsAgo
                }
            }
        })

        // Group by month
        const monthlyData = Array.from({ length: 12 }, (_, i) => {
            const month = new Date()
            month.setMonth(month.getMonth() - (11 - i))
            const monthName = month.toLocaleString('default', { month: 'short' })

            const monthExpenses = yearlyExpenses.filter(exp => {
                const expDate = new Date(exp.expenseDate)
                return expDate.getMonth() === month.getMonth() &&
                    expDate.getFullYear() === month.getFullYear()
            })

            const total = monthExpenses.reduce((sum, exp) => sum + exp.amount, 0)

            return {
                month: monthName,
                expenses: total,
                limit: 5000 // This would come from policy/budget in production
            }
        })

        return NextResponse.json({
            stats: {
                walletBalance,
                pendingApprovals: pendingApprovalsCount,
                monthlySpend,
                avgReimbursement
            },
            recentTransactions: recentTransactions.map(tx => ({
                id: tx.id,
                name: tx.title,
                category: tx.category,
                date: tx.expenseDate,
                status: tx.status,
                amount: tx.amount
            })),
            spendAnalytics: monthlyData
        })
    } catch (error) {
        console.error('Dashboard API error:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
