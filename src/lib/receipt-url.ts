export function getReceiptViewerUrl(receiptUrl: string) {
    return receiptUrl;
}

export function getReceiptUrl(receiptId: string) {
    return `/api/uploads/receipts/${encodeURIComponent(receiptId)}`;
}
