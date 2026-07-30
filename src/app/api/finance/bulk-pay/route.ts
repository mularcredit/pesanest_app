import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import prisma from '@/lib/prisma';

export async function POST(request: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { expenseIds, paymentMethod } = await request.json();

        if (!expenseIds || !Array.isArray(expenseIds) || expenseIds.length === 0) {
            return NextResponse.json({ error: 'No expenses selected' }, { status: 400 });
        }

        // Process all payments in a transaction
        const results = await prisma.$transaction(
            expenseIds.map((expenseId: string) =>
                prisma.expense.update({
                    where: { id: expenseId },
                    data: {
                        status: 'PAID',
                        paymentMethod: paymentMethod || 'BANK_TRANSFER',
                        paidAt: new Date()
                    }
                })
            )
        );

        return NextResponse.json({
            success: true,
            message: `${results.length} payments processed successfully`,
            processedCount: results.length
        });
    } catch (error: any) {
        console.error('Bulk payment error:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to process bulk payment' },
            { status: 500 }
        );
    }
}
