/**
 * Utility to estimate payout fees for various payment providers and currencies.
 */

export interface FeeEstimation {
    principal: number;
    fee: number;
    total: number;
    currency: string;
}

/**
 * Estimate the fee charged by Paystack for a payout (transfer).
 * Fees vary by currency and amount.
 */
export function estimatePaystackPayoutFee(amount: number, currency: string = 'KES'): number {
    if (currency === 'KES') {
        // Paystack Kenya Fees (Standard)
        if (amount <= 5000) return 10;
        if (amount <= 50000) return 25;
        return 50;
    }
    
    if (currency === 'USD') {
        // Placeholder for USD transfers (typically around $1 - $5 depending on volume)
        return 2.00;
    }

    // Default fallback (assuming 1% or flat minimum)
    return Math.max(amount * 0.01, 10);
}

/**
 * Calculate the total impact on the wallet for a batch of payments.
 */
export function calculateBatchTotalWithFees(items: { amount: number, currency: string }[]): { subtotal: number, totalFees: number, grandTotal: number } {
    let subtotal = 0;
    let totalFees = 0;

    for (const item of items) {
        subtotal += item.amount;
        totalFees += estimatePaystackPayoutFee(item.amount, item.currency);
    }

    return {
        subtotal,
        totalFees,
        grandTotal: subtotal + totalFees
    };
}
