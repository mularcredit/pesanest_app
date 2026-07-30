import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { auth } from '@/auth';

export async function POST(req: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Ideally check if user has FINANCE role here
        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: { role: true }
        });

        // Simplified role check for now
        const canPay = ['FINANCE_TEAM', 'FINANCE_APPROVER', 'SYSTEM_ADMIN'].includes(user?.role || '');
        if (!canPay && user?.role !== 'MANAGER') { // Allow managers for testing if needed
            // return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
        }

        const body = await req.json();
        const { expenseId, paymentMethod, reference } = body;

        if (!expenseId) {
            return NextResponse.json({ error: 'Missing expenseId' }, { status: 400 });
        }

        // Fetch the expense
        const expense = await prisma.expense.findUnique({
            where: { id: expenseId },
            include: { user: true }
        });

        if (!expense) {
            return NextResponse.json({ error: 'Expense not found' }, { status: 404 });
        }

        if (expense.status !== 'APPROVED') {
            return NextResponse.json({ error: 'Only approved expenses can be paid' }, { status: 400 });
        }

        // process payment via external gateways
        let gatewayResponse: any = null;

        if (paymentMethod === 'PAYSTACK' || paymentMethod === 'STRIPE') {
            const { paystackService } = await import('@/lib/payments/paystack');
            
            // For now, if there's no recipient code, it will fail gracefully.
            // A recipient code is expected from the updated User schema on Paystack connect.
            const recipientCode = expense.user.paystackRecipientCode;

            if (!recipientCode) {
                return NextResponse.json({ error: 'User has no connected Paystack Wallet/Account' }, { status: 400 });
            }

            gatewayResponse = await paystackService.processPayout(
                expense.amount,
                expense.currency.toUpperCase() || 'KES',
                recipientCode,
                `Reimbursement for: ${expense.title}`
            );
        } else if (paymentMethod === 'PESALINK') {
            const { pesalink } = await import('@/lib/payments/pesalink');
            gatewayResponse = await pesalink.sendMoney({
                amount: expense.amount,
                phoneNumber: expense.user.phoneNumber || undefined,
                accountNumber: expense.user.bankAccount || undefined,
                reason: `Reimbursement: ${expense.title}`,
                reference: reference || `REF-${Date.now()}`
            });
        }

        // Update expense status to PAID or REIMBURSED
        const newStatus = expense.isReimbursable ? 'REIMBURSED' : 'PAID';

        await prisma.expense.update({
            where: { id: expenseId },
            data: {
                status: newStatus,
                updatedAt: new Date()
            }
        });

        // Create wallet transaction if applicable
        if (paymentMethod === 'WALLET' || gatewayResponse) {
            const wallet = await prisma.wallet.findUnique({
                where: { userId: expense.userId }
            });

            if (wallet) {
                await prisma.walletTransaction.create({
                    data: {
                        walletId: wallet.id,
                        userId: expense.userId,
                        type: 'REIMBURSEMENT',
                        amount: expense.amount,
                        description: `Reimbursement via ${paymentMethod}: ${expense.title}`,
                        reference: reference || gatewayResponse?.id || gatewayResponse?.transactionId || `PAY-${Date.now()}`
                    }
                });

                if (paymentMethod === 'WALLET') {
                    await prisma.wallet.update({
                        where: { id: wallet.id },
                        data: { balance: { increment: expense.amount } }
                    });
                }
            }
        }

        return NextResponse.json({
            success: true,
            status: newStatus,
            gateway: gatewayResponse,
            message: `Expense ${newStatus.toLowerCase()} successfully via ${paymentMethod}`
        });


    } catch (error) {
        console.error('Payment processing error:', error);
        return NextResponse.json(
            { error: 'Failed to process payment' },
            { status: 500 }
        );
    }
}
