/**
 * Paystack Payment Service
 * Handles processing transactions and managing transfer recipients in Paystack.
 */

if (!process.env.PAYSTACK_SECRET_KEY) {
    console.warn('PAYSTACK_SECRET_KEY is missing');
}

export class PaystackService {
    private secretKey = process.env.PAYSTACK_SECRET_KEY || '';
    private baseUrl = 'https://api.paystack.co';

    private getHeaders() {
        return {
            Authorization: `Bearer ${this.secretKey}`,
            'Content-Type': 'application/json',
        };
    }

    /**
     * Resolve a Bank Account (Confirm details before creating recipient)
     */
    async resolveAccount(accountNumber: string, bankCode: string) {
        const response = await fetch(`${this.baseUrl}/bank/resolve?account_number=${accountNumber}&bank_code=${bankCode}`, {
            method: 'GET',
            headers: this.getHeaders(),
        });
        
        const data = await response.json();
        if (!data.status) {
            throw new Error(data.message || 'Could not resolve bank account');
        }
        return data.data;
    }

    /**
     * Create a Transfer Recipient for payouts
     * Returns the recipient_code to be saved on the user profile
     */
    async createTransferRecipient(name: string, accountNumber: string, bankCode: string, currency: string = 'KES', type: string = 'nuban') {
        const response = await fetch(`${this.baseUrl}/transferrecipient`, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify({
                type,
                name,
                account_number: accountNumber,
                bank_code: bankCode,
                currency
            })
        });

        const data = await response.json();
        if (!data.status) {
            throw new Error(data.message || 'Failed to create transfer recipient');
        }
        return data.data.recipient_code;
    }

    /**
     * Handle payout via Paystack Transfers API
     */
    async processPayout(amount: number, currency: string, recipientCode: string, reason: string = 'Payment Disbursement', accountReference?: string, metadata: any = null) {
        console.log(`[Paystack] Processing payout of ${amount} ${currency} to recipient ${recipientCode}${accountReference ? ` with reference ${accountReference}` : ''}`);
        
        // Amount is passed in subunits (cents/kobo)
        const amountInSubunits = Math.round(amount * 100);

        const body: any = {
            source: 'balance',
            amount: amountInSubunits,
            recipient: recipientCode,
            reason,
            currency,
            ...(accountReference ? { account_reference: accountReference } : {}),
            ...(metadata ? { metadata } : {})
        };

        const response = await fetch(`${this.baseUrl}/transfer`, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify(body)
        });

        const data = await response.json();

        if (!data.status) {
            console.error('[Paystack] Payout Failed:', data.message);
            return {
                amount,
                currency,
                status: 'FAILED',
                transactionId: null,
                error: data.message
            };
        }

        // Transfers are asynchronous — the call succeeding (data.status: true) only means Paystack
        // accepted the request, not that money moved. The real outcome is data.data.status, which can be:
        //   success    — done, funds sent
        //   pending    — still processing, may still succeed or fail
        //   otp        — held pending a one-time-PIN confirmation (can't be satisfied headlessly —
        //                treat as failed so it isn't silently marked paid; must be confirmed manually
        //                in the Paystack dashboard, or OTP-for-transfers disabled on the account)
        //   abandoned  — an OTP was requested but never confirmed in time
        //   failed     — Paystack rejected it (bad recipient/account details, insufficient balance, etc.)
        //   reversed   — it went through then bounced back
        const transferStatus = data.data.status;
        const transactionId = data.data.reference || data.data.transfer_code;

        if (transferStatus === 'success') {
            return { amount, currency, status: 'COMPLETED', transactionId };
        }
        if (transferStatus === 'pending') {
            return { amount, currency, status: 'PENDING', transactionId };
        }

        const reasonByStatus: Record<string, string> = {
            otp: 'Paystack is holding this transfer for a one-time-PIN confirmation. Confirm it in the Paystack dashboard, or ask Paystack to disable OTP for Transfers so automated payouts go through.',
            abandoned: 'The transfer was held for OTP confirmation and timed out unconfirmed.',
        };
        console.error('[Paystack] Payout did not complete:', transferStatus, data.data.reason || '');
        return {
            amount,
            currency,
            status: 'FAILED',
            transactionId,
            error: reasonByStatus[transferStatus] || data.data.reason || `Paystack transfer status: ${transferStatus}`,
        };
    }

    /**
     * Initialize a Top-Up transaction (receives payment from user)
     */
    async initializeTransaction(amount: number, email: string, reference?: string, callbackUrl?: string) {
        const amountInSubunits = Math.round(amount * 100);
        const payload: any = {
            amount: amountInSubunits,
            email,
            currency: 'KES',
            callback_url: callbackUrl || `${process.env.NEXTAUTH_URL}/dashboard/wallet`,
        };

        if (reference) {
            payload.reference = reference;
        }

        const response = await fetch(`${this.baseUrl}/transaction/initialize`, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify(payload)
        });

        const data = await response.json();
        if (!data.status) {
            throw new Error(data.message || 'Failed to initialize transaction');
        }
        return data.data; // { authorization_url, access_code, reference }
    }

    /**
     * Verify a completed Top-Up transaction
     */
    async verifyTransaction(reference: string) {
        const response = await fetch(`${this.baseUrl}/transaction/verify/${encodeURIComponent(reference)}`, {
            method: 'GET',
            headers: this.getHeaders(),
        });

        const data = await response.json();
        if (!data.status) {
            throw new Error(data.message || 'Failed to verify transaction');
        }
        return data.data; // { status, amount, gateway_response, etc. }
    }

    /**
     * Get the current balance of the Paystack account
     */
    async getBalance() {
        const response = await fetch(`${this.baseUrl}/balance`, {
            method: 'GET',
            headers: this.getHeaders(),
        });

        const data = await response.json();
        if (!data.status) {
            throw new Error(data.message || 'Failed to fetch balance');
        }
        return data.data; // Array of balances [{ currency: 'KES', balance: 5000 }, ...]
    }
}

export const paystackService = new PaystackService();
