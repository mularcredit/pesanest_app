import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { approvalWorkflow } from '@/lib/approval-workflow';
import prisma from '@/lib/prisma';
import { z } from 'zod';
import { checkEnforceClosure } from '@/lib/closure-check';

// Base validation schema (for admins - no amount limit)
const createExpenseSchemaAdmin = z.object({
    title: z.string().min(3, 'Title must be at least 3 characters').max(100),
    description: z.string().optional(),
    amount: z.number().positive('Amount must be positive'), // No max for admins
    category: z.string().min(1, 'Category is required'),
    expenseDate: z.string().transform(str => new Date(str)),
    merchant: z.string().optional(),
    receiptUrl: z.string().url().optional().or(z.literal('')),
    paymentMethod: z.enum(['PERSONAL_CARD', 'CORPORATE_CARD', 'CASH', 'DIRECT_BILL', 'WALLET']).default('PERSONAL_CARD'),
    requisitionId: z.string().optional(),
    isReimbursable: z.boolean().default(true),
    isBillable: z.boolean().default(false),
    costCenter: z.enum(['OFFICE']).default('OFFICE'),
});

// Validation schema for regular users (Limit controlled by Policy Engine)
const createExpenseSchemaUser = z.object({
    title: z.string().min(3, 'Title must be at least 3 characters').max(100),
    description: z.string().optional(),
    amount: z.number().positive('Amount must be positive'),
    category: z.string().min(1, 'Category is required'),
    expenseDate: z.string().transform(str => new Date(str)),
    merchant: z.string().optional(),
    receiptUrl: z.string().url().optional().or(z.literal('')),
    paymentMethod: z.enum(['PERSONAL_CARD', 'CORPORATE_CARD', 'CASH', 'DIRECT_BILL', 'WALLET']).default('PERSONAL_CARD'),
    requisitionId: z.string().optional(),
    isReimbursable: z.boolean().default(true),
    isBillable: z.boolean().default(false),
    costCenter: z.enum(['OFFICE']).default('OFFICE'),
});

/**
 * Create a new expense with automatic workflow routing
 */
export async function POST(request: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Check if user is admin
        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: { role: true }
        });

        const isAdmin = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN' || user?.role === 'SYSTEM_ADMIN';

        const body = await request.json();

        // Validate input - use appropriate schema based on role
        const validatedData = isAdmin
            ? createExpenseSchemaAdmin.parse(body)
            : createExpenseSchemaUser.parse(body);

        const closureCheck = await checkEnforceClosure(session.user.id);
        if (closureCheck.blocked) {
            return NextResponse.json({ error: closureCheck.message }, { status: 403 });
        }

        // 1. Create the expense
        const expense = await prisma.expense.create({
            data: {
                userId: session.user.id,
                title: validatedData.title,
                description: validatedData.description,
                amount: validatedData.amount,
                category: validatedData.category,
                expenseDate: validatedData.expenseDate,
                merchant: validatedData.merchant,
                receiptUrl: validatedData.receiptUrl || null,
                paymentMethod: validatedData.paymentMethod,
                requisitionId: validatedData.requisitionId,
                isReimbursable: validatedData.isReimbursable,
                isBillable: validatedData.isBillable,
                costCenter: validatedData.costCenter,
                status: 'APPROVED',
            },
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        department: true
                    }
                }
            }
        });

        console.log(`✅ Emergency created: ${expense.id}`);

        return NextResponse.json({
            success: true,
            message: 'Emergency submitted and sent directly to payments',
            expense: {
                id: expense.id,
                title: expense.title,
                amount: expense.amount,
                status: expense.status,
                createdAt: expense.createdAt
            },
            workflow: {
                autoApproved: true,
                reason: 'Emergencies bypass approvals',
                estimatedDays: 0,
                approvalLevels: 0,
                approvers: []
            }
        }, { status: 201 });

    } catch (error: any) {
        console.error('Emergency creation error:', error);

        // Handle validation errors
        if (error instanceof z.ZodError) {
            return NextResponse.json(
                {
                    error: 'Validation failed',
                    details: error.issues.map((e: any) => ({
                        field: e.path.join('.'),
                        message: e.message
                    }))
                },
                { status: 400 }
            );
        }

        return NextResponse.json(
            { error: 'Failed to create emergency', details: error.message },
            { status: 500 }
        );
    }
}

/**
 * Get expenses for the current user
 */
export async function GET(request: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const status = searchParams.get('status');
        const limit = parseInt(searchParams.get('limit') || '50');
        const offset = parseInt(searchParams.get('offset') || '0');

        const expenses = await prisma.expense.findMany({
            where: {
                userId: session.user.id,
                ...(status ? { status } : {})
            },
            include: {
                approvals: {
                    include: {
                        approver: {
                            select: { name: true, email: true, role: true }
                        }
                    },
                    orderBy: { level: 'asc' }
                }
            },
            orderBy: { createdAt: 'desc' },
            take: limit,
            skip: offset
        });

        const total = await prisma.expense.count({
            where: {
                userId: session.user.id,
                ...(status ? { status } : {})
            }
        });

        return NextResponse.json({
            expenses,
            pagination: {
                total,
                limit,
                offset,
                hasMore: offset + limit < total
            }
        });

    } catch (error: any) {
        console.error('Get expenses error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch expenses', details: error.message },
            { status: 500 }
        );
    }
}
