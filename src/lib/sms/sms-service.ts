/**
 * PesaNest SMS Service
 *
 * High-level notification templates built on top of the Celcom adapter.
 * Every method is fire-and-forget — failures are logged but never thrown,
 * so a broken SMS gateway can never take down a financial transaction.
 * Every send (success or failure) is persisted to the SmsLog table.
 */

import { sendSMS, sendBulkSMS } from './celcom';

const APP = process.env.NEXT_PUBLIC_APP_NAME ?? 'PesaNest';
const URL = (process.env.NEXTAUTH_URL ?? '').replace(/\/$/, '');

function ksh(amount: number): string {
    return `KSh ${amount.toLocaleString('en-KE', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

async function fire(mobile: string, msg: string, event = 'MANUAL'): Promise<void> {
    try {
        const r = await sendSMS(mobile, msg);
        const status = String(r.messageId ?? '').startsWith('STUB') ? 'STUB' : r.success ? 'SENT' : 'FAILED';

        // Non-critical: persist log
        import('@/lib/prisma').then(({ default: prisma }) =>
            (prisma as any).smsLog.create({
                data: {
                    to: mobile,
                    message: msg,
                    status,
                    messageId: r.messageId ? String(r.messageId) : null,
                    errorReason: r.error ?? null,
                    event,
                },
            })
        ).catch(() => {});

        if (!r.success) console.warn(`[SMS] to ${mobile} failed: ${r.error}`);
    } catch (err) {
        console.error('[SMS] Unexpected error:', err);
    }
}

async function fireBulk(mobiles: string[], msg: string, event = 'BULK'): Promise<void> {
    if (!mobiles.length) return;
    try {
        const r = await sendBulkSMS(mobiles, msg);
        const status = String(r.messageId ?? '').startsWith('STUB') ? 'STUB' : r.success ? 'SENT' : 'FAILED';

        // Log one entry per recipient
        import('@/lib/prisma').then(({ default: prisma }) =>
            (prisma as any).smsLog.createMany({
                data: mobiles.map(to => ({
                    to,
                    message: msg,
                    status,
                    messageId: r.messageId ? String(r.messageId) : null,
                    errorReason: r.error ?? null,
                    event,
                })),
            })
        ).catch(() => {});

        if (!r.success) console.warn(`[SMS BULK] failed: ${r.error}`);
    } catch (err) {
        console.error('[SMS BULK] Unexpected error:', err);
    }
}

export const smsService = {
    /** Welcome message sent when admin creates a new user account */
    async sendWelcome(name: string, phone: string, email: string, plainPassword: string): Promise<void> {
        const first = name.split(' ')[0];
        const msg = `Welcome to ${APP}, ${first}!\nYour account is ready.\nEmail: ${email}\nPassword: ${plainPassword}\nLogin: ${URL}/login\nPlease change your password after first login.`;
        await fire(phone, msg, 'WELCOME');
    },

    /** Password reset link */
    async sendPasswordReset(phone: string, resetUrl: string): Promise<void> {
        const msg = `${APP}: Reset your password here:\n${resetUrl}\nLink expires in 1 hour. Ignore if you did not request this.`;
        await fire(phone, msg, 'PASSWORD_RESET');
    },

    /** Approval decision (approve/reject) to item submitter */
    async sendApprovalDecision(
        phone: string,
        name: string,
        itemType: 'EXPENSE' | 'REQUISITION' | 'BUDGET' | 'INVOICE',
        itemTitle: string,
        amount: number,
        action: 'APPROVE' | 'REJECT',
        comments?: string | null,
    ): Promise<void> {
        const labels: Record<string, string> = {
            EXPENSE: 'expense', REQUISITION: 'requisition', BUDGET: 'budget', INVOICE: 'invoice',
        };
        const label = labels[itemType] ?? itemType.toLowerCase();
        const verb  = action === 'APPROVE' ? 'APPROVED ✓' : 'REJECTED ✗';
        let msg = `${APP}: Your ${label} "${itemTitle}" (${ksh(amount)}) has been ${verb}.`;
        if (action === 'REJECT' && comments) msg += ` Reason: ${comments}.`;
        msg += ` Login to view details.`;
        await fire(phone, msg, 'APPROVAL_DECISION');
    },

    /** Payment batch authorized by checker */
    async sendPaymentAuthorized(phone: string, name: string, amount: number, ref: string): Promise<void> {
        const shortRef = ref.slice(-8).toUpperCase();
        const msg = `${APP}: Your payment batch (${ksh(amount)}) has been AUTHORIZED. Ref: ${shortRef}. Disbursement is in progress.`;
        await fire(phone, msg, 'PAYMENT_AUTHORIZED');
    },

    /** Payment batch rejected by checker */
    async sendPaymentRejected(phone: string, name: string, amount: number): Promise<void> {
        const msg = `${APP}: Your payment batch (${ksh(amount)}) was REJECTED by the checker. Please review and resubmit on the portal.`;
        await fire(phone, msg, 'PAYMENT_REJECTED');
    },

    /** Funds disbursed to a recipient */
    async sendPaymentDisbursed(phone: string, name: string, amount: number, ref: string): Promise<void> {
        const first = name.split(' ')[0];
        const msg = `${APP}: ${first}, your payment of ${ksh(amount)} has been disbursed. Ref: ${ref}. Contact finance if not received within 24 hrs.`;
        await fire(phone, msg, 'PAYMENT_DISBURSED');
    },

    /** Wallet top-up confirmed */
    async sendWalletTopup(phone: string, name: string, amount: number, newBalance: number): Promise<void> {
        const first = name.split(' ')[0];
        const msg = `${APP}: ${first}, wallet top-up confirmed! ${ksh(amount)} added. New balance: ${ksh(newBalance)}.`;
        await fire(phone, msg, 'WALLET_TOPUP');
    },

    /** Branch wallet funded by HQ */
    async sendBranchFunded(phone: string, name: string, amount: number): Promise<void> {
        const first = name.split(' ')[0];
        const msg = `${APP}: ${first}, your branch wallet has been funded with ${ksh(amount)}. Login to view your updated balance.`;
        await fire(phone, msg, 'BRANCH_FUNDED');
    },

    /** Bulk alert to approvers when a new item needs sign-off */
    async sendApprovalRequired(phones: string[], submitterName: string, itemType: string, amount: number): Promise<void> {
        const label = itemType === 'EXPENSE' ? 'expense' : itemType === 'REQUISITION' ? 'requisition' : itemType.toLowerCase();
        const msg = `${APP}: Action required. ${submitterName} submitted a ${label} of ${ksh(amount)} pending your approval. Login to review.`;
        await fireBulk(phones, msg, 'APPROVAL_REQUIRED');
    },

    /** One-off raw send */
    async send(phone: string, message: string): Promise<void> {
        await fire(phone, message, 'MANUAL');
    },
};
