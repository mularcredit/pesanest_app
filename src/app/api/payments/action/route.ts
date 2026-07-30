import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";

// POST - Authorize or Reject a payment (Checker)
export async function POST(req: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();
        const { paymentId, action, paymentMethod, proofUrl } = body; // action: 'AUTHORIZE' | 'REJECT' | 'DISBURSE' | 'CLOSE', paymentMethod: 'WALLET' | 'BRANCH_WALLET' | 'CASH'

        if (!['AUTHORIZE', 'REJECT', 'DISBURSE', 'CLOSE'].includes(action)) {
            return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
        }

        // Fetch payment with relationships to update them if needed
        const payment = await (prisma as any).payment.findUnique({
            where: { id: paymentId },
            include: {
                invoices: {
                    include: { vendor: { select: { paystackRecipientCode: true, name: true } } }
                },
                expenses: {
                    include: { user: { select: { paystackRecipientCode: true, name: true, phoneNumber: true } } }
                },
                requisitions: { include: { user: { select: { name: true, email: true, paystackRecipientCode: true, phoneNumber: true } } } },
                monthlyBudgets: true
            }
        });

        if (!payment) {
            return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
        }

        if (action === 'DISBURSE' && !['AUTHORIZED', 'FAILED', 'PAID', 'PARTIALLY_PAID'].includes(payment.status)) {
            return NextResponse.json({ error: 'Payment must be authorized before disbursement' }, { status: 400 });
        }

        if (action === 'CLOSE' && payment.status !== 'PAID') {
            return NextResponse.json({ error: 'Payment must be disbursed before closing' }, { status: 400 });
        }

        if ((action === 'AUTHORIZE' || action === 'REJECT') && payment.status !== 'PENDING_AUTHORIZATION') {
            return NextResponse.json({ error: 'Payment is not pending authorization' }, { status: 400 });
        }

        // Segregation of duties: maker cannot authorise their own payment
        if ((action === 'AUTHORIZE') && payment.makerId === session.user.id) {
            return NextResponse.json({ error: 'Maker cannot authorise their own payment' }, { status: 403 });
        }

        if (action === 'AUTHORIZE') {
            await prisma.payment.update({
                where: { id: paymentId },
                data: { status: 'AUTHORIZED', checkerId: session.user.id, authorizedAt: new Date() }
            });

            // Non-critical: SMS to payment maker
            import('@/lib/sms/sms-service').then(async ({ smsService }) => {
                const maker = await prisma.user.findUnique({ where: { id: payment.makerId }, select: { name: true, phoneNumber: true } });
                if (maker?.phoneNumber) await smsService.sendPaymentAuthorized(maker.phoneNumber, maker.name ?? 'User', payment.amount, paymentId);
            }).catch(() => {});
        } else if (action === 'DISBURSE') {
            let p = payment as any;
            const { paystackService } = await import('@/lib/payments/paystack');
            const { AccountingEngine } = await import('@/lib/accounting/accounting-engine');

            // Robust fetch for items
            if (!p.requisitions || p.requisitions.length === 0) {
                p.requisitions = await (prisma as any).requisition.findMany({
                    where: { paymentId },
                    include: { user: { select: { name: true, email: true, paystackRecipientCode: true, phoneNumber: true } } }
                });
            }
            if (!p.expenses || p.expenses.length === 0) {
                p.expenses = await prisma.expense.findMany({
                    where: { paymentId },
                    include: { user: { select: { name: true, email: true, paystackRecipientCode: true, phoneNumber: true } } }
                });
            }
            if (!p.invoices || p.invoices.length === 0) {
                p.invoices = await prisma.invoice.findMany({ 
                    where: { paymentId },
                    include: { vendor: true }
                });
            }

            // Diagnostic logging
            console.log(`[Disbursement] PaymentID: ${paymentId} | Reqs: ${p.requisitions?.length || 0} | Exps: ${p.expenses?.length || 0} | Invs: ${p.invoices?.length || 0}`);

            const allItems = [...(p.requisitions || []), ...(p.expenses || []), ...(p.invoices || [])];
            
            if (allItems.length === 0) {
                return NextResponse.json({ 
                    error: 'No items (Requisitions, Invoices, or Expenses) were found linked to this payment batch. Disbursement cannot proceed.' 
                }, { status: 400 });
            }


            // CASH path: no gateway, no wallet movement — just mark everything paid
            if (paymentMethod === 'CASH') {
                const { AccountingEngine } = await import('@/lib/accounting/accounting-engine');
                const cashAccount = await prisma.account.findFirst({ where: { code: '1000' } });

                for (const req of p.requisitions) {
                    await (prisma as any).requisition.update({ where: { id: req.id }, data: { status: 'PAID' } });
                    if (cashAccount) await (AccountingEngine as any).postRequisitionPayment(req.id, cashAccount.id).catch(() => {});
                }
                for (const exp of p.expenses) {
                    await prisma.expense.update({ where: { id: exp.id }, data: { status: 'PAID', paidAt: new Date() } });
                    if (cashAccount) await (AccountingEngine as any).postExpensePayment(exp.id, cashAccount.id).catch(() => {});
                }
                for (const inv of p.invoices) {
                    await prisma.invoice.update({ where: { id: inv.id }, data: { status: 'PAID', paymentStatus: 'PAID', paidAt: new Date() } });
                    if (cashAccount) await (AccountingEngine as any).postInvoicePayment(inv.id, cashAccount.id).catch(() => {});
                }

                await prisma.payment.update({
                    where: { id: paymentId },
                    data: { status: 'PAID', processedAt: new Date(), method: 'CASH' }
                });

                return NextResponse.json({ success: true, summary: { success: allItems.length, failed: 0, errors: [], details: [] } });
            }

            const wallet = await prisma.wallet.findUnique({ where: { userId: session.user.id } });

            let liveBalance = wallet?.balance ?? 0;
            if (paymentMethod === 'WALLET') {
                try {
                    const paystackBalances = await paystackService.getBalance();
                    const kesBalanceData = paystackBalances.find((b: any) => b.currency === 'KES');
                    if (kesBalanceData) {
                        liveBalance = kesBalanceData.balance / 100;
                    }
                } catch (err) {
                    console.error('[Disbursement] Failed to fetch live Paystack balance, using DB fallback:', err);
                }
            }

            const { estimatePaystackPayoutFee } = await import('@/lib/payments/paymentFees');
            
            // Calculate total fees for the batch
            let estimatedTotalFees = 0;
            for (const item of allItems) {
                estimatedTotalFees += estimatePaystackPayoutFee(item.amount, item.currency || 'KES');
            }

            const totalNeeded = payment.amount + estimatedTotalFees;

            if (paymentMethod === 'WALLET' && liveBalance < totalNeeded) {
                return NextResponse.json({ 
                    error: `Insufficient Paystack balance. Total needed including fees: ${totalNeeded.toFixed(2)} (Amount: ${payment.amount.toFixed(2)} + Fees: ${estimatedTotalFees.toFixed(2)}). Your live Paystack balance is: ${liveBalance.toFixed(2)}` 
                }, { status: 400 });
            }

            const results = {
                success: 0,
                failed: 0,
                errors: [] as string[],
                details: [] as { id: string, title: string, error: string, type: string }[]
            };
            const smsQueue: Array<{ phone: string; name: string; amount: number; ref: string }> = [];

            // Process Requisitions
            for (const req of p.requisitions) {
                try {
                    let txId = `INT-${Date.now()}`;

                    if (paymentMethod === 'WALLET') {
                        let recipientCode = req.user?.paystackRecipientCode;
                        let bankCode = 'MPESA';
                        let type = 'mobile_money';
                        let accountNumber = req.paymentReference || '';
                        let accountReference = undefined;

                        if (req.paymentMethod === 'MPESA_PAYBILL' && req.paymentReference) {
                            const [pb, acc] = req.paymentReference.split('|');
                            bankCode = 'MPPAYBILL';
                            type = 'mobile_money_business';
                            accountNumber = pb;
                            accountReference = acc || 'Payment';
                        } else if (req.paymentMethod === 'MPESA_TILL' && req.paymentReference) {
                            bankCode = 'MPTILL';
                            type = 'mobile_money_business';
                            accountNumber = req.paymentReference;
                            accountReference = req.paymentReference;
                        }

                        if (!recipientCode && accountNumber) {
                            recipientCode = await paystackService.createTransferRecipient(
                                req.user?.name || 'Beneficiary',
                                accountNumber,
                                bankCode,
                                req.currency || 'KES',
                                type
                            );
                        }

                        if (recipientCode) {
                            const payout = await paystackService.processPayout(
                                req.amount,
                                req.currency || 'KES',
                                recipientCode,
                                `Requisition: ${req.title}`,
                                accountReference
                            );

                            if (payout.status !== 'COMPLETED' && payout.status !== 'PENDING') {
                                throw new Error(payout.error || 'Paystack payout failed');
                            }
                            txId = payout.transactionId || txId;
                        } else {
                            throw new Error('No recipient details available');
                        }

                        // Wallet updates
                        await prisma.wallet.update({
                            where: { id: wallet!.id },
                            data: { balance: { decrement: req.amount } }
                        });

                        await prisma.walletTransaction.create({
                            data: {
                                walletId: wallet!.id,
                                userId: session.user.id,
                                type: 'PAYOUT',
                                amount: -req.amount,
                                description: `Payout for Requisition: ${req.title}`,
                                reference: txId
                            }
                        });
                    } else if (paymentMethod === 'BRANCH_WALLET') {
                        const branchId = req.branchId || req.branch;
                        if (!branchId) throw new Error('No branch ID associated with this requisition for branch funding.');

                        await prisma.$transaction(async (tx) => {
                            await tx.wallet.update({
                                where: { id: wallet!.id },
                                data: { balance: { decrement: req.amount } }
                            });
                            await tx.walletTransaction.create({
                                data: {
                                    walletId: wallet!.id,
                                    userId: (session as any).user.id,
                                    type: 'DEDUCTION',
                                    amount: -req.amount,
                                    description: `Branch Funding: Requisition ${req.title}`,
                                    reference: `BRANCH-FUND-${Date.now()}`
                                }
                            });

                            let bWallet = await tx.branchWallet.findUnique({ where: { branchId } });
                            if (!bWallet) {
                                bWallet = await tx.branchWallet.create({
                                    data: { branchId, balance: 0, currency: req.currency || 'KES' }
                                });
                            }
                            await tx.branchWallet.update({
                                where: { id: bWallet.id },
                                data: { balance: { increment: req.amount } }
                            });
                            await tx.branchWalletTransaction.create({
                                data: {
                                    branchWalletId: bWallet.id,
                                    type: 'FUNDING',
                                    amount: req.amount,
                                    description: `Funding from HQ: Requisition - ${req.title}`,
                                    reference: txId
                                }
                            });
                        });
                    }

                    await (prisma as any).requisition.update({
                        where: { id: req.id },
                        data: { status: 'PAID' }
                    });

                    const cashAccount = await prisma.account.findFirst({ where: { code: '1000' } });
                    if (cashAccount) {
                        await (AccountingEngine as any).postRequisitionPayment(req.id, cashAccount.id);
                    }
                    if (req.user?.phoneNumber) smsQueue.push({ phone: req.user.phoneNumber, name: req.user.name ?? 'User', amount: req.amount, ref: txId });
                    results.success++;
                } catch (err: any) {
                    console.error(`Disbursement failed for req ${req.id}:`, err);
                    results.failed++;
                    results.errors.push(`${req.title}: ${err.message}`);
                    results.details.push({ id: req.id, title: req.title, error: err.message, type: 'REQUISITION' });
                }
            }

            // Process Expenses
            for (const exp of p.expenses) {
                try {
                    let txId = `INT-${Date.now()}`;
                    if (paymentMethod === 'WALLET') {
                        let recipientCode = exp.user?.paystackRecipientCode;
                        const accountNumber = exp.user?.phoneNumber || exp.paymentReference;

                        if (!recipientCode && accountNumber) {
                            recipientCode = await paystackService.createTransferRecipient(
                                exp.user?.name || 'Employee',
                                accountNumber,
                                'MPESA',
                                exp.currency || 'KES',
                                'mobile_money'
                            );
                        }

                        if (recipientCode) {
                            const payout = await paystackService.processPayout(
                                exp.amount,
                                exp.currency || 'KES',
                                recipientCode,
                                `Expense: ${exp.title}`,
                                undefined
                            );
                            if (payout.status !== 'COMPLETED' && payout.status !== 'PENDING') {
                                throw new Error(payout.error || 'Paystack payout failed');
                            }
                            txId = payout.transactionId || txId;
                        } else {
                            throw new Error('No recipient details available');
                        }

                        await prisma.wallet.update({
                            where: { id: wallet!.id },
                            data: { balance: { decrement: exp.amount } }
                        });

                        await prisma.walletTransaction.create({
                            data: {
                                walletId: wallet!.id,
                                userId: session.user.id,
                                type: 'PAYOUT',
                                amount: -exp.amount,
                                description: `Payout for Expense: ${exp.title}`,
                                reference: txId
                            }
                        });
                    }

                    await prisma.expense.update({
                        where: { id: exp.id },
                        data: { status: 'PAID', paidAt: new Date() }
                    });

                    const cashAccount = await prisma.account.findFirst({ where: { code: '1000' } });
                    if (cashAccount) {
                        await (AccountingEngine as any).postExpensePayment(exp.id, cashAccount.id);
                    }
                    if (exp.user?.phoneNumber) smsQueue.push({ phone: exp.user.phoneNumber, name: exp.user.name ?? 'User', amount: exp.amount, ref: txId });
                    results.success++;
                } catch (err: any) {
                    console.error(`Disbursement failed for exp ${exp.id}:`, err);
                    results.failed++;
                    results.errors.push(`${exp.title}: ${err.message}`);
                    results.details.push({ id: exp.id, title: exp.title, error: err.message, type: 'EXPENSE' });
                }
            }

            // Process Invoices
            for (const inv of p.invoices) {
                try {
                    let txId = `INT-${Date.now()}`;
                    if (paymentMethod === 'WALLET') {
                        let recipientCode = inv.vendor?.paystackRecipientCode;
                        const accountNumber = inv.vendor?.bankAccount || inv.vendor?.phone;

                        if (!recipientCode && accountNumber) {
                            // Vendors use mobile_money or nuban (bank)
                            const bankCode = inv.vendor?.bankAccount ? (inv.vendor?.bankName || 'BANK_CODE') : 'MPESA';
                            const recipientType = bankCode === 'MPESA' ? 'mobile_money' : 'nuban';

                            recipientCode = await paystackService.createTransferRecipient(
                                inv.vendor?.name || 'Vendor',
                                accountNumber,
                                bankCode,
                                inv.currency || 'KES',
                                recipientType
                            );
                        }

                        if (recipientCode) {
                            const payout = await paystackService.processPayout(
                                inv.amount,
                                inv.currency || 'KES',
                                recipientCode,
                                `Invoice: ${inv.invoiceNumber}`,
                                undefined
                            );
                            if (payout.status !== 'COMPLETED' && payout.status !== 'PENDING') {
                                throw new Error(payout.error || 'Paystack payout failed');
                            }
                            txId = payout.transactionId || txId;
                        } else {
                            throw new Error('No recipient details available for vendor');
                        }

                        await prisma.wallet.update({
                            where: { id: wallet!.id },
                            data: { balance: { decrement: inv.amount } }
                        });

                        await prisma.walletTransaction.create({
                            data: {
                                walletId: wallet!.id,
                                userId: session.user.id,
                                type: 'PAYOUT',
                                amount: -inv.amount,
                                description: `Payout for Invoice: ${inv.invoiceNumber}`,
                                reference: txId
                            }
                        });
                    }

                    await prisma.invoice.update({
                        where: { id: inv.id },
                        data: { status: 'PAID', paymentStatus: 'PAID', paidAt: new Date() }
                    });

                    const cashAccount = await prisma.account.findFirst({ where: { code: '1000' } });
                    if (cashAccount) {
                        await (AccountingEngine as any).postInvoicePayment(inv.id, cashAccount.id);
                    }
                    results.success++;
                } catch (err: any) {
                    console.error(`Disbursement failed for inv ${inv.id}:`, err);
                    results.failed++;
                    results.errors.push(`${inv.invoiceNumber}: ${err.message}`);
                    results.details.push({ id: inv.id, title: `Invoice ${inv.invoiceNumber}`, error: err.message, type: 'INVOICE' });
                }
            }

            await prisma.payment.update({
                where: { id: paymentId },
                data: {
                    status: results.failed === 0 ? 'PAID' : results.success > 0 ? 'PARTIALLY_PAID' : 'FAILED',
                    processedAt: new Date(),
                    method: paymentMethod || payment.method || 'WALLET',
                    notes: `${payment.notes || ''}\nSummary: ${results.success} success, ${results.failed} failed.\nErrors: ${results.errors.join('; ')}`.trim()
                }
            });

            // Non-critical: SMS to each successfully-disbursed recipient
            if (smsQueue.length > 0) {
                import('@/lib/sms/sms-service').then(({ smsService }) =>
                    Promise.allSettled(smsQueue.map(s =>
                        smsService.sendPaymentDisbursed(s.phone, s.name, s.amount, s.ref)
                    ))
                ).catch(() => {});
            }

            return NextResponse.json({
                success: true,
                summary: results
            });
        } else if (action === 'REJECT') {
            await prisma.payment.update({
                where: { id: paymentId },
                data: { status: 'REJECTED', checkerId: session.user.id }
            });

            // Non-critical: SMS to payment maker
            import('@/lib/sms/sms-service').then(async ({ smsService }) => {
                const maker = await prisma.user.findUnique({ where: { id: payment.makerId }, select: { name: true, phoneNumber: true } });
                if (maker?.phoneNumber) await smsService.sendPaymentRejected(maker.phoneNumber, maker.name ?? 'User', payment.amount);
            }).catch(() => {});

            // Disconnect items so they re-appear in the payables queue
            await prisma.expense.updateMany({
                where: { paymentId: paymentId },
                data: { paymentId: null }
            });
            await prisma.invoice.updateMany({
                where: { paymentId: paymentId },
                data: { paymentId: null }
            });
            await (prisma as any).requisition.updateMany({
                where: { paymentId: paymentId },
                data: { paymentId: null }
            });
            await (prisma as any).monthlyBudget.updateMany({
                where: { paymentId: paymentId },
                data: { paymentId: null }
            });
        } else if (action === 'CLOSE') {
            await prisma.payment.update({
                where: { id: paymentId },
                data: { status: 'CLOSED' }
            });

            let p = payment as any;
            if (p.expenses?.length > 0) {
                await prisma.expense.updateMany({
                    where: { id: { in: p.expenses.map((e: any) => e.id) } },
                    data: { status: 'CLOSED' }
                });
            }
            if (p.invoices?.length > 0) {
                await prisma.invoice.updateMany({
                    where: { id: { in: p.invoices.map((i: any) => i.id) } },
                    data: { status: 'CLOSED' }
                });
            }
            // Use paymentId-based fallback for requisitions (more reliable than in-memory array)
            if (p.requisitions?.length > 0) {
                await (prisma as any).requisition.updateMany({
                    where: { paymentId: paymentId },
                    data: { status: 'CLOSED' }
                });
            }
            if (p.monthlyBudgets?.length > 0) {
                await (prisma as any).monthlyBudget.updateMany({
                    where: { paymentId: paymentId },
                    data: { status: 'CLOSED' }
                });
            }
        }

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error('Payment authorization error:', error);
        return NextResponse.json({ error: 'Failed to process authorization' }, { status: 500 });
    }
}
