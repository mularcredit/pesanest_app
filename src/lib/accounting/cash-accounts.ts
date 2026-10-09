/**
 * A single, shared definition of "is this account a cash/cash-equivalent
 * asset" — bank, petty cash, mobile money float, paybill, Paystack clearing,
 * etc. Two separate ad-hoc versions of this existed before (cash-flow/page.tsx
 * matched on name only and missed "paybill"/"paystack"; management-report's
 * getCashPosition matched on subtype only, and its subtype list included the
 * generic 'CURRENT_ASSET' bucket — which also covers Accounts Receivable,
 * Inventory and Prepaid Expenses, none of which are cash). They disagreed
 * with each other and with reality; this is the one place that decides it now.
 *
 * Paystack Settlement Clearing counts as cash by explicit business decision —
 * Paystack genuinely holds and disburses real cash the business spends
 * directly (it funds the Wallet), even though its GL balance and the live
 * Paystack account balance don't currently reconcile (a separate, real data
 * problem — see the Paystack reconciliation investigation — not a reason to
 * exclude it from this category).
 */
export function isCashEquivalentAccount(account: { type: string; subtype?: string | null; name: string }): boolean {
    if (account.type !== 'ASSET') return false;

    const n = account.name.toLowerCase();

    if (
        n.includes('bank') || n.includes('cash') || n.includes('wallet') ||
        n.includes('pesa') || n.includes('stripe') || n.includes('paybill') ||
        n.includes('paystack') || n.includes('mobile')
    ) {
        return true;
    }

    const subtype = (account.subtype || '').toUpperCase();
    return subtype === 'CASH' || subtype === 'BANK' || subtype === 'PAYBILL';
}
