import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";

// GET - List payments (filtered by role/status)
export async function GET(req: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const status = searchParams.get('status');
        
        const userProfile = await prisma.user.findUnique({
            where: { id: session.user.id }
        });
        const isBranchManager = userProfile?.role === 'TEAM_LEADER';

        // Build query based on status and role
        const whereClause: any = {};
        if (status) whereClause.status = status;
        if (isBranchManager) whereClause.makerId = session.user.id;

        const payments = await (prisma as any).payment.findMany({
            where: whereClause,
            include: {
                maker: { select: { name: true, email: true } },
                checker: { select: { name: true, email: true } },
                _count: {
                    select: {
                        invoices: true,
                        expenses: true,
                        requisitions: true,
                        monthlyBudgets: true
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        // Also fetch items available for payment (only if requesting potential new batches)
        // This might be better as a separate call or part of the page load.

        return NextResponse.json({ payments });

    } catch (error) {
        console.error('Payment fetch error:', error);
        return NextResponse.json({ error: 'Failed' }, { status: 500 });
    }
}

// POST - Create a new payment request (Maker)
export async function POST(req: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();
        const {
            expenseIds = [],
            invoiceIds = [],
            requisitionIds = [],
            budgetIds = [],
            method = "BANK_TRANSFER",
            notes,
            skipAuthorization = false
        } = body;

        if (expenseIds.length === 0 && invoiceIds.length === 0 && requisitionIds.length === 0 && budgetIds.length === 0) {
            return NextResponse.json({ error: 'No items selected' }, { status: 400 });
        }

        // Calculate total and determine currency
        let totalAmount = 0;
        let currency = 'KES';
        let currencyDetected = false;

        // Verify expenses
        if (expenseIds.length > 0) {
            const expenses = await prisma.expense.findMany({
                where: { id: { in: expenseIds }, status: 'APPROVED' }
            });
            if (expenses.length > 0 && !currencyDetected) {
                currency = expenses[0].currency;
                currencyDetected = true;
            }
            totalAmount += expenses.reduce((sum, e) => sum + e.amount, 0);
        }

        // Verify invoices
        if (invoiceIds.length > 0) {
            const invoices = await prisma.invoice.findMany({
                where: { id: { in: invoiceIds }, status: 'APPROVED' }
            });
            if (invoices.length > 0 && !currencyDetected) {
                currency = invoices[0].currency;
                currencyDetected = true;
            }
            totalAmount += invoices.reduce((sum, i) => sum + Number(i.amount), 0);
        }

        // Verify Requisitions
        if (requisitionIds.length > 0) {
            const requisitions = await prisma.requisition.findMany({
                where: { id: { in: requisitionIds }, status: 'APPROVED' }
            });
            if (requisitions.length > 0 && !currencyDetected) {
                currency = requisitions[0].currency;
                currencyDetected = true;
            }
            totalAmount += requisitions.reduce((sum, r) => sum + r.amount, 0);
        }

        // Verify Budgets
        if (budgetIds.length > 0) {
            const budgets = await (prisma as any).monthlyBudget.findMany({
                where: { id: { in: budgetIds }, status: 'APPROVED' }
            });
            // Budgets are currently KES only in schema usually, but let's be safe
            if (budgets.length > 0 && !currencyDetected) {
                // If monthlyBudget doesn't have a currency field, it defaults to KES in calculations
                currency = 'KES';
                currencyDetected = true;
            }
            totalAmount += budgets.reduce((sum: number, b: any) => sum + b.totalAmount, 0);
        }

        // Check Admin Identity for authorization bypass
        let finalStatus = 'PENDING_AUTHORIZATION';
        let checkerId = undefined;
        let authorizedAt = undefined;

        if (skipAuthorization) {
            const userProfile = await prisma.user.findUnique({ 
                where: { id: session.user.id },
                include: { customRole: true }
            });
            if (userProfile?.role !== 'EMPLOYEE') {
                finalStatus = 'AUTHORIZED';
                checkerId = session.user.id;
                authorizedAt = new Date();
            }
        }

        // Create Payment with core items
        const createData: any = {
            makerId: session.user.id,
            amount: totalAmount,
            currency,
            method,
            notes,
            status: finalStatus,
            ...(checkerId ? { checkerId } : {}),
            ...(authorizedAt ? { authorizedAt } : {}),
            expenses: {
                connect: expenseIds.map((id: string) => ({ id }))
            },
            invoices: {
                connect: invoiceIds.map((id: string) => ({ id }))
            }
        };

        if (requisitionIds.length > 0) {
            createData.requisitions = {
                connect: requisitionIds.map((id: string) => ({ id }))
            };
        }

        if (budgetIds.length > 0) {
            createData.monthlyBudgets = {
                connect: budgetIds.map((id: string) => ({ id }))
            };
        }

        const payment = await prisma.payment.create({
            data: createData
        });

        return NextResponse.json({ success: true, payment });

    } catch (error) {
        console.error('Payment creation error:', error);
        return NextResponse.json({ error: 'Failed to create payment' }, { status: 500 });
    }
}
