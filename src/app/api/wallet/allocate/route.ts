import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { auth } from '@/auth';
import { postWalletAllocation } from '@/lib/accounting/wallet-gl';

export async function POST(req: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();
        const { branchId, amount, description } = body;

        // Validate required fields
        if (!branchId || !amount) {
            return NextResponse.json(
                { error: 'Missing required fields: branchId, amount' },
                { status: 400 }
            );
        }

        const allocationAmount = parseFloat(amount);

        // Pre-fetch outside transaction to keep it short
        const wallet = await prisma.wallet.findUnique({ where: { userId: (session as any).user.id } });
        if (!wallet) throw new Error('Corporate wallet not found for your account.');
        if (wallet.balance < allocationAmount) throw new Error('Insufficient balance in Corporate wallet.');

        let branchWallet = await prisma.branchWallet.findUnique({ where: { branchId } });
        if (!branchWallet) {
            branchWallet = await prisma.branchWallet.create({
                data: { branchId, balance: 0, currency: wallet.currency }
            });
        }

        const allocRef = `ALLOC-${Date.now()}`;

        // Critical atomic block — balance moves only, no GL work
        const result = await prisma.$transaction([
            prisma.wallet.update({
                where: { id: wallet.id },
                data: { balance: { decrement: allocationAmount } }
            }),
            prisma.walletTransaction.create({
                data: {
                    walletId: wallet.id,
                    userId: (session as any).user.id,
                    type: 'DEDUCTION',
                    amount: -allocationAmount,
                    description: description || `Allocation to branch: ${branchId}`,
                    reference: allocRef
                }
            }),
            prisma.branchWallet.update({
                where: { id: branchWallet.id },
                data: { balance: { increment: allocationAmount } }
            }),
            prisma.branchWalletTransaction.create({
                data: {
                    branchWalletId: branchWallet.id,
                    type: 'FUNDING',
                    amount: allocationAmount,
                    description: `Internal allocation from HQ`,
                    reference: allocRef
                }
            }),
        ]);

        // Non-critical: GL journal — failure must not roll back the balance move
        try {
            await postWalletAllocation(prisma as any, {
                amount: allocationAmount,
                hqGlAccountId: (wallet as any).glAccountId,
                branchGlAccountId: (branchWallet as any).glAccountId,
                branchId,
                userId: (session as any).user.id,
                reference: allocRef,
            });
        } catch (glErr) {
            console.error('[Wallet GL] Allocation GL posting failed (non-critical):', glErr);
        }

        const updatedMainWallet = result[0];

        // Non-critical: SMS to branch Team Leader
        import('@/lib/sms/sms-service').then(async ({ smsService }) => {
            const branch = await prisma.branch.findUnique({
                where: { id: branchId },
                include: { teamLeader: { select: { name: true, phoneNumber: true } } },
            });
            if (branch?.teamLeader?.phoneNumber) {
                await smsService.sendBranchFunded(
                    branch.teamLeader.phoneNumber,
                    branch.teamLeader.name ?? 'Team Leader',
                    allocationAmount,
                );
            }
        }).catch(() => {});

        return NextResponse.json({
            success: true,
            balance: updatedMainWallet.balance,
            message: `Successfully allocated KSh ${amount} to branch`
        });

    } catch (error: any) {
        console.error('Wallet allocation error:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to allocate funds' },
            { status: 500 }
        );
    }
}

// GET endpoint to fetch wallet transactions
export async function GET(req: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const wallet = await prisma.wallet.findUnique({
            where: { userId: session.user.id },
            include: {
                transactions: {
                    orderBy: { createdAt: 'desc' },
                    take: 50
                }
            }
        });

        if (!wallet) {
            return NextResponse.json({ error: 'Wallet not found' }, { status: 404 });
        }

        return NextResponse.json({
            balance: wallet.balance,
            currency: wallet.currency,
            transactions: wallet.transactions
        });

    } catch (error) {
        console.error('Wallet fetch error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch wallet data' },
            { status: 500 }
        );
    }
}
