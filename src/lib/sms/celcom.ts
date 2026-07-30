/**
 * Celcom Africa SMS Adapter
 *
 * Docs:     https://www.celcomafrica.com/developers-center
 * Endpoint: POST https://isms.celcomafrica.com/api/services/sendsms
 * Auth:     apikey + partnerID in JSON body
 *
 * Set CELCOM_SMS_STUB=true to log messages without sending (dev/test).
 * Live mode activates automatically when CELCOM_API_KEY is set.
 */

const CELCOM_ENDPOINT = 'https://isms.celcomafrica.com/api/services/sendsms';
const CELCOM_API_KEY   = process.env.CELCOM_API_KEY   || '';
const CELCOM_PARTNER_ID = process.env.CELCOM_PARTNER_ID || '';
const CELCOM_SHORTCODE  = process.env.CELCOM_SHORTCODE  || 'MularCredit';
const CELCOM_STUB       = process.env.CELCOM_SMS_STUB === 'true';

export interface CelcomSendResult {
    success: boolean;
    messageId?: string | number;
    error?: string;
    raw?: unknown;
}

/**
 * Normalise phone numbers to international format (254XXXXXXXXX).
 * Handles: 07XXXXXXXX → 2547XXXXXXXX, +254 → 254, 9-digit numbers.
 */
export function normalisePhone(phone: string): string {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.startsWith('254') && cleaned.length === 12) return cleaned;           // already correct
    if (cleaned.startsWith('0')   && cleaned.length === 10) return `254${cleaned.slice(1)}`; // 07XXXXXXXX
    if (cleaned.length === 9)                               return `254${cleaned}`;    // 7XXXXXXXX
    // Strip a leading extra zero if someone typed 007XXXXXXXX
    if (cleaned.startsWith('00254') && cleaned.length === 14) return cleaned.slice(2);
    if (cleaned.startsWith('0')    && cleaned.length === 11) return `254${cleaned.slice(2)}`; // 007XXXXXXXX
    return cleaned;
}

/** Send a single SMS */
export async function sendSMS(mobile: string, message: string): Promise<CelcomSendResult> {
    const to = normalisePhone(mobile);

    if (CELCOM_STUB || !CELCOM_API_KEY) {
        console.info(`[SMS STUB] → ${to}: ${message}`);
        return { success: true, messageId: `STUB-${Date.now()}` };
    }

    try {
        const res = await fetch(CELCOM_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                apikey: CELCOM_API_KEY,
                partnerID: CELCOM_PARTNER_ID,
                shortcode: CELCOM_SHORTCODE,
                mobile: to,
                message,
                pass_type: 'plain',
            }),
        });

        const data: any = await res.json();
        const resp = data?.responses?.[0];
        const code  = resp?.['respose-code'] ?? resp?.['response-code'];

        if (code === 200) {
            return { success: true, messageId: resp?.messageid, raw: data };
        }

        return {
            success: false,
            error: resp?.['response-description'] ?? `HTTP ${res.status}`,
            raw: data,
        };
    } catch (err: any) {
        return { success: false, error: err?.message ?? 'Failed to reach Celcom' };
    }
}

/** Send the same message to multiple recipients (comma-separated in one API call) */
export async function sendBulkSMS(mobiles: string[], message: string): Promise<CelcomSendResult> {
    if (mobiles.length === 0) return { success: true };

    const toList = mobiles.map(normalisePhone).join(',');

    if (CELCOM_STUB || !CELCOM_API_KEY) {
        console.info(`[SMS STUB BULK] → ${toList}: ${message}`);
        return { success: true, messageId: `STUB-BULK-${Date.now()}` };
    }

    try {
        const res = await fetch(CELCOM_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                apikey: CELCOM_API_KEY,
                partnerID: CELCOM_PARTNER_ID,
                shortcode: CELCOM_SHORTCODE,
                mobile: toList,
                message,
                pass_type: 'plain',
            }),
        });

        const data: any = await res.json();
        const allOk = (data?.responses as any[])?.every(
            (r: any) => (r['respose-code'] ?? r['response-code']) === 200
        );

        return { success: allOk ?? true, raw: data };
    } catch (err: any) {
        return { success: false, error: err?.message ?? 'Bulk SMS failed' };
    }
}
