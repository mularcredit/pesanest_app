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
const ETIMS_BASE_URL = process.env.ETIMS_BASE_URL || 'https://etims-api.kra.go.ke/etims-api';
const ETIMS_PIN = process.env.ETIMS_PIN || '';
const ETIMS_DEVICE_SERIAL = process.env.ETIMS_DEVICE_SERIAL || '';
const ETIMS_API_KEY = process.env.ETIMS_API_KEY || '';

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

    /**
     * Live KRA eTIMS OSCU/VSCU submission.
     * Implements the KRA eTIMS API v1 invoice transmission endpoint.
     */
    private static async _liveSubmit(saleId: string, sale: any): Promise<EtimsSubmissionResult> {
        try {
            await prisma.sale.update({ where: { id: saleId }, data: { etimsStatus: 'PENDING' } });

            const payload = {
                tin: ETIMS_PIN,
                bhfId: '00',
                dvcSrlNo: ETIMS_DEVICE_SERIAL,
                tyCd: 'S',
                invcNo: sale.invoiceNumber,
                salesDt: sale.issueDate.toISOString().slice(0, 10).replace(/-/g, ''),
                custTin: sale.customer?.taxId || null,
                custNm: sale.customer?.name || null,
                taxblAmtA: Number(sale.subtotal),
                taxblAmtB: 0,
                taxblAmtC: 0,
                taxblAmtD: 0,
                taxAmtA: Number(sale.taxAmount),
                taxAmtB: 0,
                taxAmtC: 0,
                taxAmtD: 0,
                totTaxblAmt: Number(sale.subtotal),
                totTaxAmt: Number(sale.taxAmount),
                totAmt: Number(sale.totalAmount),
                itemList: sale.items.map((item: any, i: number) => ({
                    itemSeq: i + 1,
                    itemNm: item.description,
                    qty: item.quantity,
                    prc: Number(item.unitPrice),
                    totAmt: Number(item.total),
                    taxTyCd: 'A',
                }))
            };

            const response = await fetch(`${ETIMS_BASE_URL}/trnsSalesSaveWr`, {
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

            if (data.resultCd === '000') {
                const etimsInvoiceNumber = data.data?.rcptNo || sale.invoiceNumber;
                const controlUnit = data.data?.intrlData || ETIMS_DEVICE_SERIAL;

                await prisma.sale.update({
                    where: { id: saleId },
                    data: { etimsInvoiceNumber, etimsControlUnit: controlUnit, etimsStatus: 'ACCEPTED' }
                });

                return { success: true, status: 'ACCEPTED', etimsInvoiceNumber, controlUnit };
            } else {
                await prisma.sale.update({ where: { id: saleId }, data: { etimsStatus: 'FAILED' } });
                return { success: false, status: 'FAILED', error: `KRA eTIMS error ${data.resultCd}: ${data.resultMsg}` };
            }

        } catch (error: any) {
            await prisma.sale.update({ where: { id: saleId }, data: { etimsStatus: 'FAILED' } }).catch(() => {});
            return { success: false, status: 'FAILED', error: error.message };
        }
    }
}
