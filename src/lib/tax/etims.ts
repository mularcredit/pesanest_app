/**
 * eTIMS (Electronic Tax Invoice Management System) Service
 *
 * KRA requires all VAT-registered businesses to transmit invoices to the
 * eTIMS OSCU (Online Sales Control Unit) or VSCU (Virtual Sales Control Unit)
 * before or at the point of sale.
 *
 * Current status: SKELETON — API credentials and KRA sandbox/production
 * endpoints must be configured before live submission is enabled.
 * Set ETIMS_ENABLED=true in .env to activate real submissions.
 */

import prisma from "@/lib/prisma";

const ETIMS_ENABLED = process.env.ETIMS_ENABLED === 'true';
// OSCU sandbox base by default; override with ETIMS_BASE_URL for production (api.kra.go.ke)
const ETIMS_BASE_URL = process.env.ETIMS_BASE_URL || 'https://sbx.kra.go.ke/etims-oscu/api/v1';
const ETIMS_PIN = process.env.ETIMS_PIN || '';
const ETIMS_DEVICE_SERIAL = process.env.ETIMS_DEVICE_SERIAL || '';
const ETIMS_API_KEY = process.env.ETIMS_API_KEY || ''; // used as the cmcKey header
// --- GavaConnect OSCU integration config ---
const ETIMS_TOKEN_URL = process.env.ETIMS_TOKEN_URL || 'https://sbx.kra.go.ke/v1/token/generate?grant_type=client_credentials';
const ETIMS_CONSUMER_KEY = process.env.ETIMS_CONSUMER_KEY || '';
const ETIMS_CONSUMER_SECRET = process.env.ETIMS_CONSUMER_SECRET || '';
const ETIMS_APIGEE_APP_ID = process.env.ETIMS_APIGEE_APP_ID || '';
const ETIMS_ITEM_CODE = process.env.ETIMS_ITEM_CODE || 'KE2BGBX0000001';
const ETIMS_ITEM_CLS_CD = process.env.ETIMS_ITEM_CLS_CD || '1010150100';
const ETIMS_VAT_RATE = 16;
const round2 = (n: number) => Math.round(n * 100) / 100;
const pad2 = (n: number) => String(n).padStart(2, '0');
function etimsDateTime(d: Date) {
    return `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}${pad2(d.getHours())}${pad2(d.getMinutes())}${pad2(d.getSeconds())}`;
}

export type EtimsStatus = 'NOT_REQUIRED' | 'PENDING' | 'SUBMITTED' | 'ACCEPTED' | 'FAILED';

export interface EtimsSubmissionResult {
    success: boolean;
    etimsInvoiceNumber?: string;
    controlUnit?: string;
    qrCode?: string;
    status: EtimsStatus;
    error?: string;
}

export interface EtimsVerifyResult {
    valid: boolean;
    etimsInvoiceNumber?: string;
    controlUnit?: string;
    invoiceDate?: string;
    totalAmount?: number;
    taxAmount?: number;
    customerPin?: string;
    status: EtimsStatus;
    error?: string;
    raw?: any;
}

export interface EtrReceiptVerifyResult {
    valid: boolean;
    etrNumber: string;
    vendorPin?: string;
    vendorName?: string;
    receiptDate?: string;
    totalAmount?: number;
    taxAmount?: number;
    error?: string;
    raw?: any;
}

export class EtimsService {

    /**
     * Verify a submitted invoice against KRA eTIMS records.
     * In stub mode returns a simulated valid response based on local data.
     * In live mode queries KRA's selectTrnsSales endpoint.
     */
    static async verifyInvoice(saleId: string): Promise<EtimsVerifyResult> {
        const sale = await prisma.sale.findUnique({
            where: { id: saleId },
            include: { customer: true }
        });

        if (!sale) return { valid: false, status: 'FAILED', error: 'Sale not found' };

        if (sale.etimsStatus === 'NOT_REQUIRED') {
            return { valid: true, status: 'NOT_REQUIRED', error: 'No tax — eTIMS not required for this invoice' };
        }

        if (!sale.etimsInvoiceNumber) {
            return { valid: false, status: 'PENDING', error: 'Invoice has not been submitted to eTIMS yet' };
        }

        if (!ETIMS_ENABLED) {
            return this._stubVerify(sale);
        }

        return this._liveVerify(sale);
    }

    private static async _stubVerify(sale: any): Promise<EtimsVerifyResult> {
        const isStub = sale.etimsInvoiceNumber?.startsWith('ETIMS-STUB-');
        return {
            valid: true,
            status: 'ACCEPTED',
            etimsInvoiceNumber: sale.etimsInvoiceNumber,
            controlUnit: sale.etimsControlUnit,
            invoiceDate: new Date(sale.issueDate).toISOString().slice(0, 10),
            totalAmount: Number(sale.totalAmount),
            taxAmount: Number(sale.taxAmount),
            customerPin: sale.customer?.taxId || null,
            error: isStub ? 'Stub mode — not a real KRA record. Set ETIMS_ENABLED=true for live verification.' : undefined,
        };
    }

    private static async _liveVerify(sale: any): Promise<EtimsVerifyResult> {
        try {
            const payload = {
                tin: ETIMS_PIN,
                bhfId: '00',
                lastReqDt: '20200101000000',
            };

            const response = await fetch(`${ETIMS_BASE_URL}/selectTrnsSales`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'tin': ETIMS_PIN,
                    'bhfId': '00',
                    'cmcKey': ETIMS_API_KEY,
                },
                body: JSON.stringify(payload),
            });

            const data = await response.json();

            if (data.resultCd !== '000') {
                return { valid: false, status: 'FAILED', error: `KRA error ${data.resultCd}: ${data.resultMsg}`, raw: data };
            }

            // Find the matching invoice in the returned list
            const records: any[] = data.data?.saleList || [];
            const match = records.find((r: any) =>
                r.rcptNo === sale.etimsInvoiceNumber || r.invcNo === sale.invoiceNumber
            );

            if (!match) {
                return {
                    valid: false,
                    status: 'FAILED',
                    error: `Invoice ${sale.etimsInvoiceNumber} not found in KRA records`,
                    raw: data
                };
            }

            return {
                valid: true,
                status: 'ACCEPTED',
                etimsInvoiceNumber: match.rcptNo || sale.etimsInvoiceNumber,
                controlUnit: match.intrlData || sale.etimsControlUnit,
                invoiceDate: match.salesDt,
                totalAmount: match.totAmt,
                taxAmount: match.totTaxAmt,
                customerPin: match.custTin,
                raw: match,
            };
        } catch (error: any) {
            return { valid: false, status: 'FAILED', error: error.message };
        }
    }

    /**
     * Re-submit a failed or pending invoice to KRA eTIMS.
     */
    static async resubmitInvoice(saleId: string): Promise<EtimsSubmissionResult> {
        // Reset status so submitInvoice doesn't skip it
        await prisma.sale.update({
            where: { id: saleId },
            data: { etimsStatus: 'PENDING', etimsInvoiceNumber: null, etimsControlUnit: null }
        });
        return this.submitInvoice(saleId);
    }

    /**
     * Verify a vendor-issued ETR/eTIMS number on a purchase receipt.
     * Called when an employee uploads a receipt for an expense or requisition.
     * In stub mode returns a simulated valid response.
     * In live mode queries KRA selectTrnsPurchaseSales endpoint.
     */
    static async verifyVendorReceipt(etrNumber: string): Promise<EtrReceiptVerifyResult> {
        if (!etrNumber || etrNumber.trim().length === 0) {
            return { valid: false, etrNumber, error: 'ETR number is required' };
        }

        const normalized = etrNumber.trim().toUpperCase();

        if (!ETIMS_ENABLED) {
            return this._stubReceiptVerify(normalized);
        }

        return this._liveReceiptVerify(normalized);
    }

    private static async _stubReceiptVerify(etrNumber: string): Promise<EtrReceiptVerifyResult> {
        const isStubLike = /^(ETIMS|ETR|CU|KRA)/i.test(etrNumber);
        return {
            valid: true,
            etrNumber,
            vendorPin: 'A001000001A',
            vendorName: 'Stub Vendor Ltd',
            receiptDate: new Date().toISOString().slice(0, 10),
            totalAmount: 0,
            taxAmount: 0,
            error: isStubLike
                ? 'Stub mode — not verified against live KRA. Set ETIMS_ENABLED=true for real validation.'
                : 'Stub mode — ETR format looks valid. Set ETIMS_ENABLED=true for real validation.',
        };
    }

    private static async _liveReceiptVerify(etrNumber: string): Promise<EtrReceiptVerifyResult> {
        try {
            const payload = {
                tin: ETIMS_PIN,
                bhfId: '00',
                lastReqDt: '20200101000000',
            };

            const response = await fetch(`${ETIMS_BASE_URL}/selectTrnsPurchaseSales`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'tin': ETIMS_PIN,
                    'bhfId': '00',
                    'cmcKey': ETIMS_API_KEY,
                },
                body: JSON.stringify(payload),
            });

            const data = await response.json();

            if (data.resultCd !== '000') {
                return { valid: false, etrNumber, error: `KRA error ${data.resultCd}: ${data.resultMsg}`, raw: data };
            }

            const records: any[] = data.data?.saleList || [];
            const match = records.find((r: any) =>
                r.rcptNo === etrNumber || r.intrlData === etrNumber
            );

            if (!match) {
                return {
                    valid: false,
                    etrNumber,
                    error: `ETR number ${etrNumber} not found in KRA purchase records`,
                    raw: data,
                };
            }

            return {
                valid: true,
                etrNumber,
                vendorPin: match.spplrTin,
                vendorName: match.spplrNm,
                receiptDate: match.salesDt,
                totalAmount: match.totAmt,
                taxAmount: match.totTaxAmt,
                raw: match,
            };
        } catch (error: any) {
            return { valid: false, etrNumber, error: error.message };
        }
    }

    /**
     * Submit a sale invoice to KRA eTIMS.
     * Returns the eTIMS invoice number and control-unit reference on success.
     * In stub mode (ETIMS_ENABLED=false), generates a locally-sequenced placeholder.
     */
    static async submitInvoice(saleId: string): Promise<EtimsSubmissionResult> {
        const sale = await prisma.sale.findUnique({
            where: { id: saleId },
            include: { customer: true, items: true }
        });

        if (!sale) return { success: false, status: 'FAILED', error: 'Sale not found' };

        // Only submit if there is a tax component
        if (Number(sale.taxAmount) === 0) {
            return { success: true, status: 'NOT_REQUIRED' };
        }

        // Already accepted — don't double-submit
        if (sale.etimsStatus === 'ACCEPTED' && sale.etimsInvoiceNumber) {
            return {
                success: true,
                status: 'ACCEPTED',
                etimsInvoiceNumber: sale.etimsInvoiceNumber,
                controlUnit: sale.etimsControlUnit || undefined,
            };
        }

        if (!ETIMS_ENABLED) {
            return this._stubSubmit(saleId, sale);
        }

        return this._liveSubmit(saleId, sale);
    }

    /**
     * Stub implementation: generates a sequential local reference.
     * Use in dev/staging until KRA credentials are in place.
     */
    private static async _stubSubmit(saleId: string, sale: any): Promise<EtimsSubmissionResult> {
        const seq = await (prisma as any).documentSequence.upsert({
            where: { prefix: 'ETIMS' },
            update: { lastNumber: { increment: 1 } },
            create: { prefix: 'ETIMS', lastNumber: 1 },
        });

        const etimsInvoiceNumber = `ETIMS-STUB-${String(seq.lastNumber).padStart(8, '0')}`;
        const controlUnit = `CU-STUB-${ETIMS_DEVICE_SERIAL || '00000'}`;

        await prisma.sale.update({
            where: { id: saleId },
            data: { etimsInvoiceNumber, etimsControlUnit: controlUnit, etimsStatus: 'ACCEPTED' }
        });

        console.warn(`[eTIMS STUB] Invoice ${sale.invoiceNumber} assigned stub number ${etimsInvoiceNumber}. Set ETIMS_ENABLED=true for live submission.`);

        return { success: true, status: 'ACCEPTED', etimsInvoiceNumber, controlUnit };
    }

    private static async _getToken(): Promise<string> {
        const basic = Buffer.from(`${ETIMS_CONSUMER_KEY}:${ETIMS_CONSUMER_SECRET}`).toString('base64');
        const res = await fetch(ETIMS_TOKEN_URL, { method: 'GET', headers: { Authorization: `Basic ${basic}` } });
        const data = await res.json();
        if (!data.access_token) throw new Error('eTIMS token request failed');
        return data.access_token as string;
    }

    /**
     * Live KRA eTIMS OSCU submission via GavaConnect (sbx.kra.go.ke/etims-oscu/api/v1).
     * Posts /saveTrnsSalesOsdc and stores the returned KRA receipt number + signature.
     * PesaNest amounts are VAT-EXCLUSIVE, so each line is grossed up by 16% (tax type B):
     * taxblAmt = net, taxAmt = net*0.16, totAmt = net*1.16.
     */
    private static async _liveSubmit(saleId: string, sale: any): Promise<EtimsSubmissionResult> {
        try {
            await prisma.sale.update({ where: { id: saleId }, data: { etimsStatus: 'PENDING' } });

            const token = await this._getToken();
            const headers: Record<string, string> = {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
                'tin': ETIMS_PIN,
                'bhfId': '00',
                'cmcKey': ETIMS_API_KEY,
                'apigee_app_id': ETIMS_APIGEE_APP_ID,
            };

            const now = new Date();
            const dt = etimsDateTime(now);
            const salesDt = dt.slice(0, 8);

            const itemList = sale.items.map((item: any, i: number) => {
                // PesaNest stores amounts VAT-EXCLUSIVE: item.total is the NET (pre-VAT) line total.
                // eTIMS expects VAT-inclusive figures, so gross up by 16% (tax type B).
                const lineNet = round2(Number(item.total));                       // taxable base
                const lineTax = round2(lineNet * (ETIMS_VAT_RATE / 100));         // VAT
                const lineGross = round2(lineNet + lineTax);                      // VAT-inclusive total
                const grossUnitPrice = round2(Number(item.unitPrice) * (1 + ETIMS_VAT_RATE / 100));
                return {
                    itemSeq: i + 1,
                    itemCd: ETIMS_ITEM_CODE,
                    itemClsCd: ETIMS_ITEM_CLS_CD,
                    itemNm: item.description,
                    bcd: null,
                    pkgUnitCd: 'BG', pkg: Number(item.quantity),
                    qtyUnitCd: 'BX', qty: Number(item.quantity),
                    prc: grossUnitPrice,
                    splyAmt: lineGross, dcRt: 0, dcAmt: 0,
                    isrccCd: null, isrccNm: null, isrcRt: null, isrcAmt: null,
                    taxTyCd: 'B', taxblAmt: lineNet, taxAmt: lineTax, totAmt: lineGross,
                };
            });
            const totAmt = round2(itemList.reduce((s: number, it: any) => s + it.totAmt, 0));
            const totTaxblAmt = round2(itemList.reduce((s: number, it: any) => s + it.taxblAmt, 0));
            const totTaxAmt = round2(totAmt - totTaxblAmt);

            const buildPayload = (invcNo: number) => ({
                invcNo, orgInvcNo: 0,
                custTin: sale.customer?.taxId || null,
                custNm: sale.customer?.name || 'Walk-in Customer',
                salesTyCd: 'N', rcptTyCd: 'S', pmtTyCd: '01', salesSttsCd: '02',
                cfmDt: dt, salesDt, stockRlsDt: dt,
                totItemCnt: itemList.length,
                taxblAmtA: 0, taxblAmtB: totTaxblAmt, taxblAmtC: 0, taxblAmtD: 0, taxblAmtE: 0,
                taxRtA: 0, taxRtB: ETIMS_VAT_RATE, taxRtC: 0, taxRtD: 0, taxRtE: 0,
                taxAmtA: 0, taxAmtB: totTaxAmt, taxAmtC: 0, taxAmtD: 0, taxAmtE: 0,
                totTaxblAmt, totTaxAmt, totAmt, prchrAcptcYn: 'N',
                regrId: 'Admin', regrNm: 'Admin', modrId: 'Admin', modrNm: 'Admin',
                receipt: {
                    custTin: sale.customer?.taxId || null, custMblNo: null,
                    rptNo: invcNo, rcptPbctDt: dt,
                    trdeNm: process.env.NEXT_PUBLIC_APP_NAME || 'PesaNest',
                    adrs: 'Nairobi', topMsg: 'Thank you', btmMsg: 'Powered by PesaNest', prchrAcptcYn: 'N',
                },
                itemList,
            });

            // Device invoice numbers are sequential; start from a local counter and
            // self-correct if KRA reports the expected next number.
            const seq = await (prisma as any).documentSequence.upsert({
                where: { prefix: 'ETIMS_OSCU' },
                update: { lastNumber: { increment: 1 } },
                create: { prefix: 'ETIMS_OSCU', lastNumber: 1 },
            });
            let invcNo: number = seq.lastNumber;
            let data: any = null;
            for (let attempt = 0; attempt < 6; attempt++) {
                const response = await fetch(`${ETIMS_BASE_URL}/saveTrnsSalesOsdc`, {
                    method: 'POST', headers, body: JSON.stringify(buildPayload(invcNo)),
                });
                data = await response.json();
                const body = data.responseBody || data;
                if (body?.resultCd === '000') {
                    const info = body.data || {};
                    const etimsInvoiceNumber = String(info.curRcptNo ?? invcNo);
                    const controlUnit = info.rcptSign || info.intrlData || ETIMS_DEVICE_SERIAL;
                    await (prisma as any).documentSequence.update({ where: { prefix: 'ETIMS_OSCU' }, data: { lastNumber: invcNo } });
                    await prisma.sale.update({
                        where: { id: saleId },
                        data: { etimsInvoiceNumber, etimsControlUnit: controlUnit, etimsStatus: 'ACCEPTED' },
                    });
                    return { success: true, status: 'ACCEPTED', etimsInvoiceNumber, controlUnit, qrCode: info.intrlData };
                }
                const msg = data.responseHeader?.customerMessage || body?.resultMsg || '';
                const expected = /expected:\s*(\d+)/i.exec(msg);
                if (expected) { invcNo = parseInt(expected[1], 10); continue; }
                if (/already exists/i.test(msg)) { invcNo += 1; continue; }
                await prisma.sale.update({ where: { id: saleId }, data: { etimsStatus: 'FAILED' } });
                return { success: false, status: 'FAILED', error: `KRA eTIMS: ${msg || 'submission failed'}` };
            }
            await prisma.sale.update({ where: { id: saleId }, data: { etimsStatus: 'FAILED' } });
            return { success: false, status: 'FAILED', error: 'Could not resolve eTIMS invoice sequence' };
        } catch (error: any) {
            await prisma.sale.update({ where: { id: saleId }, data: { etimsStatus: 'FAILED' } }).catch(() => {});
            return { success: false, status: 'FAILED', error: error.message };
        }
    }

    /**
     * Register a new item with KRA eTIMS OSCU (saveItem). Item codes must be
     * sequential per taxpayer (KE2BGBX + 7-digit seq); we self-correct if KRA
     * reports the expected next sequence number.
     */
    static async registerItem(opts: { name: string; unitPrice: number; taxTyCd?: string }): Promise<{ success: boolean; itemCd?: string; itemClsCd?: string; taxTyCd?: string; error?: string }> {
        const name = (opts.name || '').toString().trim().slice(0, 200);
        const unitPrice = Number(opts.unitPrice) || 0;
        const taxTyCd = opts.taxTyCd || 'B';
        if (!name) return { success: false, error: 'Item name is required' };

        if (!ETIMS_ENABLED) {
            const seq = await (prisma as any).documentSequence.upsert({ where: { prefix: 'ETIMS_ITEM' }, update: { lastNumber: { increment: 1 } }, create: { prefix: 'ETIMS_ITEM', lastNumber: 1 } });
            return { success: true, itemCd: `KE2BGBX${String(seq.lastNumber + 1).padStart(7, '0')}`, itemClsCd: ETIMS_ITEM_CLS_CD, taxTyCd };
        }

        try {
            const token = await this._getToken();
            const headers: Record<string, string> = {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
                'tin': ETIMS_PIN,
                'bhfId': '00',
                'cmcKey': ETIMS_API_KEY,
                'apigee_app_id': ETIMS_APIGEE_APP_ID,
            };
            const seq = await (prisma as any).documentSequence.upsert({
                where: { prefix: 'ETIMS_ITEM' },
                update: { lastNumber: { increment: 1 } },
                create: { prefix: 'ETIMS_ITEM', lastNumber: 1 },
            });
            let n: number = (seq.lastNumber || 1) + 1; // existing seed item is 0000001
            let data: any = null;
            for (let attempt = 0; attempt < 8; attempt++) {
                const itemCd = `KE2BGBX${String(n).padStart(7, '0')}`;
                const payload = {
                    tin: ETIMS_PIN, bhfId: '00', itemCd, itemClsCd: ETIMS_ITEM_CLS_CD,
                    itemTyCd: '2', itemNm: name, orgnNatCd: 'KE', pkgUnitCd: 'BG', qtyUnitCd: 'BX',
                    taxTyCd, dftPrc: unitPrice, grpPrcL1: unitPrice, grpPrcL2: unitPrice, grpPrcL3: unitPrice, grpPrcL4: unitPrice,
                    isrcAplcbYn: 'N', useYn: 'Y', regrNm: 'Admin', regrId: 'Admin', modrNm: 'Admin', modrId: 'Admin',
                };
                const response = await fetch(`${ETIMS_BASE_URL}/saveItem`, { method: 'POST', headers, body: JSON.stringify(payload) });
                data = await response.json();
                const body = data.responseBody || data;
                const msg = data.responseHeader?.customerMessage || data.responseHeader?.debugMessage || body?.resultMsg || '';
                if (body?.resultCd === '000' || /success/i.test(data.responseHeader?.customerMessage || '')) {
                    await (prisma as any).documentSequence.update({ where: { prefix: 'ETIMS_ITEM' }, data: { lastNumber: n } });
                    return { success: true, itemCd, itemClsCd: ETIMS_ITEM_CLS_CD, taxTyCd };
                }
                const expected = /ending with[^0-9]*(\d+)/i.exec(msg) || /expected:?\s*(\d+)/i.exec(msg);
                if (expected) { n = parseInt(expected[1], 10); continue; }
                if (/already exist/i.test(msg)) { n += 1; continue; }
                return { success: false, error: `KRA eTIMS: ${msg || 'item registration failed'}` };
            }
            return { success: false, error: 'Could not resolve item code sequence' };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    }

    /**
     * Submit a CREDIT NOTE to KRA eTIMS OSCU (rcptTyCd "R") against the original invoice.
     * KRA quirks handled: amounts must be POSITIVE (the R type marks it a credit),
     * a refund date (rfdDt) is required, and KRA's rfdDt parser reads the hour as
     * 12-hour — so we send it at noon (120000) to stay in the 1–12 range.
     */
    static async submitCreditNote(creditNoteId: string): Promise<EtimsSubmissionResult> {
        const cn = await (prisma as any).creditNote.findUnique({ where: { id: creditNoteId }, include: { customer: true } });
        if (!cn) return { success: false, status: 'FAILED', error: 'Credit note not found' };
        if (cn.etimsStatus === 'ACCEPTED' && cn.etimsReceiptNo) {
            return { success: true, status: 'ACCEPTED', etimsInvoiceNumber: cn.etimsReceiptNo, controlUnit: cn.etimsControlUnit || undefined };
        }
        if (!ETIMS_ENABLED) {
            const seq = await (prisma as any).documentSequence.upsert({ where: { prefix: 'ETIMS' }, update: { lastNumber: { increment: 1 } }, create: { prefix: 'ETIMS', lastNumber: 1 } });
            const receiptNo = `ETIMS-STUB-${String(seq.lastNumber).padStart(8, '0')}`;
            await (prisma as any).creditNote.update({ where: { id: creditNoteId }, data: { etimsStatus: 'ACCEPTED', etimsReceiptNo: receiptNo, etimsControlUnit: `CU-STUB-${ETIMS_DEVICE_SERIAL || '00000'}` } });
            return { success: true, status: 'ACCEPTED', etimsInvoiceNumber: receiptNo };
        }
        try {
            await (prisma as any).creditNote.update({ where: { id: creditNoteId }, data: { etimsStatus: 'PENDING' } });

            // A credit note reverses the ORIGINAL invoice. KRA requires the line unit
            // price + customer details to match the original exactly, so we rebuild the
            // lines from the original sale rather than from the free-form credit amount.
            const origSale = await prisma.sale.findUnique({
                where: { invoiceNumber: cn.invoiceRef },
                include: { items: true, customer: true },
            });
            if (!origSale || !origSale.etimsInvoiceNumber || origSale.etimsStatus !== 'ACCEPTED') {
                await (prisma as any).creditNote.update({ where: { id: creditNoteId }, data: { etimsStatus: 'FAILED' } });
                return { success: false, status: 'FAILED', error: `Original invoice ${cn.invoiceRef} is not an eTIMS-accepted sale, so it cannot be credited` };
            }
            const orgInvcNo = parseInt(origSale.etimsInvoiceNumber, 10) || 0;
            const cust = origSale.customer;

            const token = await this._getToken();
            const headers: Record<string, string> = {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
                'tin': ETIMS_PIN,
                'bhfId': '00',
                'cmcKey': ETIMS_API_KEY,
                'apigee_app_id': ETIMS_APIGEE_APP_ID,
            };

            const now = new Date();
            const dt = etimsDateTime(now);
            const salesDt = dt.slice(0, 8);
            const rfdDt = `${salesDt}120000`; // noon — dodges KRA's 12-hour rfdDt parser bug

            // Rebuild the original invoice's lines (VAT-exclusive net grossed up 16%, tax type B).
            const itemList = origSale.items.map((item: any, i: number) => {
                const lineNet = round2(Number(item.total));
                const lineTax = round2(lineNet * (ETIMS_VAT_RATE / 100));
                const lineGross = round2(lineNet + lineTax);
                const grossUnitPrice = round2(Number(item.unitPrice) * (1 + ETIMS_VAT_RATE / 100));
                return {
                    itemSeq: i + 1, itemCd: ETIMS_ITEM_CODE, itemClsCd: ETIMS_ITEM_CLS_CD,
                    itemNm: item.description,
                    bcd: null, pkgUnitCd: 'BG', pkg: Number(item.quantity), qtyUnitCd: 'BX', qty: Number(item.quantity),
                    prc: grossUnitPrice, splyAmt: lineGross, dcRt: 0, dcAmt: 0,
                    isrccCd: null, isrccNm: null, isrcRt: null, isrcAmt: null,
                    taxTyCd: 'B', taxblAmt: lineNet, taxAmt: lineTax, totAmt: lineGross,
                };
            });
            const totAmt = round2(itemList.reduce((s: number, it: any) => s + it.totAmt, 0));
            const totTaxblAmt = round2(itemList.reduce((s: number, it: any) => s + it.taxblAmt, 0));
            const totTaxAmt = round2(totAmt - totTaxblAmt);

            const buildPayload = (invcNo: number) => ({
                invcNo, orgInvcNo,
                custTin: cust?.taxId || null,
                custNm: cust?.name || 'Walk-in Customer',
                salesTyCd: 'N', rcptTyCd: 'R', pmtTyCd: '01', salesSttsCd: '02',
                cfmDt: dt, salesDt, stockRlsDt: dt, rfdDt, rfdRsnCd: '05',
                totItemCnt: itemList.length,
                taxblAmtA: 0, taxblAmtB: totTaxblAmt, taxblAmtC: 0, taxblAmtD: 0, taxblAmtE: 0,
                taxRtA: 0, taxRtB: ETIMS_VAT_RATE, taxRtC: 0, taxRtD: 0, taxRtE: 0,
                taxAmtA: 0, taxAmtB: totTaxAmt, taxAmtC: 0, taxAmtD: 0, taxAmtE: 0,
                totTaxblAmt, totTaxAmt, totAmt, prchrAcptcYn: 'N',
                regrId: 'Admin', regrNm: 'Admin', modrId: 'Admin', modrNm: 'Admin',
                receipt: {
                    custTin: cust?.taxId || null, custMblNo: null,
                    rptNo: invcNo, rcptPbctDt: dt,
                    trdeNm: process.env.NEXT_PUBLIC_APP_NAME || 'PesaNest',
                    adrs: 'Nairobi', topMsg: 'Thank you', btmMsg: 'Powered by PesaNest', prchrAcptcYn: 'N',
                },
                itemList,
            });

            const seq = await (prisma as any).documentSequence.upsert({
                where: { prefix: 'ETIMS_OSCU' },
                update: { lastNumber: { increment: 1 } },
                create: { prefix: 'ETIMS_OSCU', lastNumber: 1 },
            });
            let invcNo: number = seq.lastNumber;
            let data: any = null;
            for (let attempt = 0; attempt < 6; attempt++) {
                const response = await fetch(`${ETIMS_BASE_URL}/saveTrnsSalesOsdc`, {
                    method: 'POST', headers, body: JSON.stringify(buildPayload(invcNo)),
                });
                data = await response.json();
                const body = data.responseBody || data;
                if (body?.resultCd === '000') {
                    const info = body.data || {};
                    const receiptNo = String(info.curRcptNo ?? invcNo);
                    const controlUnit = info.rcptSign || info.intrlData || ETIMS_DEVICE_SERIAL;
                    await (prisma as any).documentSequence.update({ where: { prefix: 'ETIMS_OSCU' }, data: { lastNumber: invcNo } });
                    await (prisma as any).creditNote.update({
                        where: { id: creditNoteId },
                        data: { etimsReceiptNo: receiptNo, etimsControlUnit: controlUnit, etimsStatus: 'ACCEPTED' },
                    });
                    return { success: true, status: 'ACCEPTED', etimsInvoiceNumber: receiptNo, controlUnit, qrCode: info.intrlData };
                }
                const msg = data.responseHeader?.customerMessage || body?.resultMsg || '';
                const expected = /expected:\s*(\d+)/i.exec(msg);
                if (expected) { invcNo = parseInt(expected[1], 10); continue; }
                if (/already exists/i.test(msg)) { invcNo += 1; continue; }
                await (prisma as any).creditNote.update({ where: { id: creditNoteId }, data: { etimsStatus: 'FAILED' } });
                return { success: false, status: 'FAILED', error: `KRA eTIMS: ${msg || 'submission failed'}` };
            }
            await (prisma as any).creditNote.update({ where: { id: creditNoteId }, data: { etimsStatus: 'FAILED' } });
            return { success: false, status: 'FAILED', error: 'Could not resolve eTIMS invoice sequence' };
        } catch (error: any) {
            await (prisma as any).creditNote.update({ where: { id: creditNoteId }, data: { etimsStatus: 'FAILED' } }).catch(() => {});
            return { success: false, status: 'FAILED', error: error.message };
        }
    }
}
