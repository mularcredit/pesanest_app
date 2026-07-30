import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { auth } from '@/auth';
import { postWalletAllocation } from '@/lib/accounting/wallet-gl';

interface AllocationLine {
    branchId: string;
    amount: number;
    description?: string;
}

export async function POST(req: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const userId = (session.user as any).id as string;

        const body = await req.json();
        const { allocations }: { allocations: AllocationLine[] } = body;

        if (!Array.isArray(allocations) || allocations.length === 0) {
            return NextResponse.json({ error: 'No allocations provided' }, { status: 400 });
        }

        // Validate each line
        for (const line of allocations) {
            if (!line.branchId || !line.amount || line.amount <= 0) {
                return NextResponse.json(
                    { error: `Invalid allocation: branchId and amount > 0 are required for every line` },
                    { status: 400 }
                );
            }
        }

        const totalAmount = allocations.reduce((s, l) => s + l.amount, 0);

        const results = await prisma.$transaction(async (tx) => {
            // Lock & validate corporate wallet
            const wallet = await tx.wallet.findUnique({
                where: { userId }
            });
            if (!wallet) throw new Error('Corporate wallet not found.');
            if (wallet.balance < totalAmount) {
                throw new Error(
                    `Insufficient balance. Wallet has ${wallet.currency} ${wallet.balance.toFixed(2)} but total allocation is ${wallet.currency} ${totalAmount.toFixed(2)}.`
                );
            }

            const timestamp = Date.now();
            const processed: { branchId: string; amount: number; reference: string }[] = [];

            for (let i = 0; i < allocations.length; i++) {
                const { branchId, amount, description } = allocations[i];
                const ref = `BULK-${timestamp}-${i}`;

                // Upsert branch wallet
                let branchWallet = await tx.branchWallet.findUnique({ where: { branchId } });
                if (!branchWallet) {
                    branchWallet = await tx.branchWallet.create({
                        data: { branchId, balance: 0, currency: wallet.currency }
                    });
                }

                // Deduct from corporate wallet
                await tx.wallet.update({
                    where: { id: wallet.id },
                    data: { balance: { decrement: amount } }
                });

                // Corporate wallet debit transaction
                await tx.walletTransaction.create({
                    data: {
                        walletId: wallet.id,
                        userId,
                        type: 'DEDUCTION',
                        amount: -amount,
                        description: description || `Bulk allocation to branch`,
                        reference: `${ref}-OUT`
                    }
                });

                // Credit branch wallet
                await tx.branchWallet.update({
                    where: { id: branchWallet.id },
                    data: { balance: { increment: amount } }
                });

                // Branch wallet credit transaction
                await tx.branchWalletTransaction.create({
                    data: {
                        branchWalletId: branchWallet.id,
                        type: 'FUNDING',
                        amount,
                        description: description || `Bulk allocation from HQ`,
                        reference: `${ref}-IN`,
                    }
                });

                // GL entry
                await postWalletAllocation(tx as any, {
                    amount,
                    hqGlAccountId: (wallet as any).glAccountId,
                    branchGlAccountId: (branchWallet as any).glAccountId,
                    branchId,
                    userId,
                    reference: ref,
                });

                processed.push({ branchId, amount, reference: ref });
            }

            // Fetch updated wallet balance
            const updated = await tx.wallet.findUnique({ where: { id: wallet.id } });
            return { balance: updated?.balance ?? 0, currency: wallet.currency, processed };
        });

        return NextResponse.json({
            success: true,
            message: `Successfully allocated to ${allocations.length} branch${allocations.length > 1 ? 'es' : ''}`,
            balance: results.balance,
            currency: results.currency,
            processed: results.processed,
        });

    } catch (error: any) {
        console.error('Bulk allocation error:', error);
        return NextResponse.json({ error: error.message || 'Bulk allocation failed' }, { status: 500 });
    }
}
