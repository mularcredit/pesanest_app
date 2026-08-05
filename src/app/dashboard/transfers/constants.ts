/** Shared between the server actions and the client UI — a "use server" module
 *  may only export async functions, so these live here. */

export const TRANSFER_TYPES = [
    { value: 'BANK_TO_BANK',   label: 'Bank → Bank',        hint: 'Between two of our own bank accounts' },
    { value: 'BANK_TO_MOBILE', label: 'Bank → Mobile',      hint: 'Out to a mobile money number' },
    { value: 'TO_PAYBILL',     label: 'Into our Paybill',   hint: 'Money received into our paybill' },
    { value: 'FROM_PAYBILL',   label: 'Out of our Paybill', hint: 'Money moved out of our paybill' },
] as const;

export const TRANSFER_STATUSES = ['PENDING', 'COMPLETED', 'FAILED', 'REVERSED'] as const;

export type TransferType = typeof TRANSFER_TYPES[number]['value'];
