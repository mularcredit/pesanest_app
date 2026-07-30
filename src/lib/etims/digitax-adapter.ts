/**
 * DigiTax Invoice Verification Adapter
 *
 * API docs: https://ke.docs.digitax.tech/docs/invoice-verification
 * Base URL:  https://api.digitax.tech
 * Endpoint:  POST /ke/v2/invoice-verifications
 * Auth:      X-API-Key header
 *
 * Required env vars (already set in .env):
 *   DIGITAX_API_KEY     — KEN_LIVE_api_key_...
 *   DIGITAX_BUSINESS_ID — BUSINESSKEY_... (sent as X-Business-ID header)
 *
 * Live mode activates automatically — no DIGITAX_BASE_URL toggle needed.
 * Set DIGITAX_STUB=true to force stub mode during local dev/testing.
 */

const DIGITAX_BASE_URL = 'https://api.digitax.tech';
const DIGITAX_API_KEY = process.env.DIGITAX_API_KEY || '';
const DIGITAX_BUSINESS_ID = process.env.DIGITAX_BUSINESS_ID || '';
const DIGITAX_STUB = process.env.DIGITAX_STUB === 'true';

export interface DigiTaxVerifyInput {
    fiscalInvoiceNo: string;   // maps to invoice_number
    supplierPin?: string;      // maps to supplier_pin
    totalAmount?: number;      // maps to amount (integer pence/cents)
    referenceNumber?: string;  // maps to reference_number
    supplierName?: string;     // informational only, not sent to API
    invoiceDate?: string;      // informational only, not sent to API
    vatAmount?: number;        // informational only, not sent to API
}

export type VerificationStatus = 'VERIFIED' | 'FAILED' | 'NEEDS_REVIEW';

export interface DigiTaxVerifyResult {
    verified: boolean;
    status: VerificationStatus;
    referenceId?: string;
    supplierName?: string;
    supplierPin?: string;
    invoiceDate?: string;
    totalAmount?: number;
    vatAmount?: number;
    failureReason?: string;
    raw?: any;
}

export class DigiTaxAdapter {
    static async verifyInvoice(input: DigiTaxVerifyInput): Promise<DigiTaxVerifyResult> {
        const invoiceNo = input.fiscalInvoiceNo?.trim();

        if (!invoiceNo) {
            return {
                verified: false,
                status: 'NEEDS_REVIEW',
                failureReason: 'Fiscal invoice number is required for verification.',
            };
        }

        if (DIGITAX_STUB || !DIGITAX_API_KEY) {
            return DigiTaxAdapter._stubVerify(input, invoiceNo);
        }

        return DigiTaxAdapter._liveVerify(input, invoiceNo);
    }

    private static _stubVerify(input: DigiTaxVerifyInput, invoiceNo: string): DigiTaxVerifyResult {
        const looksValid = /^[A-Z0-9\-]{4,}/i.test(invoiceNo);

        if (!looksValid) {
            return {
                verified: false,
                status: 'NEEDS_REVIEW',
                failureReason: 'Stub mode — invoice number format looks invalid.',
            };
        }

        return {
            verified: true,
            status: 'VERIFIED',
            referenceId: `DTX-STUB-${Date.now()}`,
            supplierName: input.supplierName,
            supplierPin: input.supplierPin,
            invoiceDate: input.invoiceDate,
            totalAmount: input.totalAmount,
            vatAmount: input.vatAmount,
            failureReason: !DIGITAX_API_KEY
                ? 'Stub mode — DIGITAX_API_KEY not set. Add it to .env for live verification.'
                : 'Stub mode — DIGITAX_STUB=true. Remove it for live verification.',
        };
    }

    private static async _liveVerify(input: DigiTaxVerifyInput, invoiceNo: string): Promise<DigiTaxVerifyResult> {
        try {
            // Build request body per DigiTax API spec
            const payload: Record<string, any> = {
                invoice_number: invoiceNo,
            };
            if (input.supplierPin) payload.supplier_pin = input.supplierPin;
            if (input.totalAmount !== undefined) payload.amount = Math.round(input.totalAmount); // API expects integer
            if (input.referenceNumber) payload.reference_number = input.referenceNumber;

            const res = await fetch(`${DIGITAX_BASE_URL}/ke/v2/invoice-verifications`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-API-Key': DIGITAX_API_KEY,
                    'X-Business-ID': DIGITAX_BUSINESS_ID,
                },
                body: JSON.stringify(payload),
            });

            const data = await res.json();

            if (!res.ok) {
                return {
                    verified: false,
                    status: res.status === 404 ? 'FAILED' : 'NEEDS_REVIEW',
                    failureReason: data.message || data.error || `DigiTax API error: HTTP ${res.status}`,
                    raw: data,
                };
            }

            // 201 = verified successfully
            const verified = res.status === 201 || data.verified === true || data.status === 'verified';

            if (verified) {
                return {
                    verified: true,
                    status: 'VERIFIED',
                    referenceId: data.id || data.reference_id || data.reference,
                    supplierName: data.supplier_name || data.supplierName || input.supplierName,
                    supplierPin: data.supplier_pin || data.supplierPin || input.supplierPin,
                    invoiceDate: data.invoice_date || data.invoiceDate || input.invoiceDate,
                    totalAmount: data.amount ?? input.totalAmount,
                    vatAmount: data.vat_amount ?? input.vatAmount,
                    raw: data,
                };
            }

            return {
                verified: false,
                status: 'FAILED',
                failureReason: data.message || data.reason || 'Invoice could not be verified by DigiTax.',
                raw: data,
            };
        } catch (err: any) {
            return {
                verified: false,
                status: 'FAILED',
                failureReason: err.message || 'Failed to connect to DigiTax verification service.',
            };
        }
    }
}
