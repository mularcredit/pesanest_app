'use server';

import prisma from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

/**
 * SMART CONNECTION LAYER: FINANCE STUDIO <-> DATABASE
 * 
 * This file acts as the bridge (Controller) between the Studio UI and your Data Layer.
 * It handles the business logic for creating financial documents and auto-updating the General Ledger.
 */

// --- 1. CREDIT NOTES ---

export async function createCreditNote(data: {
    cnNumber: string;
    invoiceRef: string;
    amount: number;
    reason: string;
    customerId: string; // We'll need to select a real customer ID from the DB
}) {
    try {
        // 1. Create the Credit Note Record (The "Document")
        const newCN = await prisma.creditNote.create({
            data: {
                cnNumber: data.cnNumber,
                invoiceRef: data.invoiceRef,
                amount: data.amount,
                reason: data.reason,
                customerId: data.customerId,
                status: 'ISSUED' // Changed from DRAFT to ISSUED so it posts to GL
            }
        });

        // 2. AUTO-POST TO GENERAL LEDGER
        try {
            const { AccountingEngine } = await import('@/lib/accounting/accounting-engine');
            await AccountingEngine.postCreditNote(newCN.id);
            console.log(`✅ Posted Credit Note ${data.cnNumber} to General Ledger`);
        } catch (error) {
            console.error(`❌ Failed to post Credit Note to GL:`, error);
            // Credit note is created but not posted to GL - manual journal entry may be needed
        }

        revalidatePath('/finance-studio');
        return { success: true, data: newCN };

    } catch (error) {
        console.error('Failed to create Credit Note:', error);
        return { success: false, error: 'Database connection failed' };
    }
}


// --- 2. RECEIPTS (PAYMENTS) ---

export async function createReceipt(data: {
    receiptNo: string;
    receivedFrom: string; // Currently text, should link to Customer
    amount: number;
    currency: string;
    method: string;
    invoiceRef: string;
}) {
    // In a real scenario, we'd lookup the Customer by name or pass an ID
    const customer = await prisma.customer.findFirst({
        where: { name: { contains: data.receivedFrom, mode: 'insensitive' } }
    });

    if (!customer) {
        return { success: false, error: 'Customer not found in database. Please ensure customer exists.' };
    }

    try {
        const payment = await prisma.customerPayment.create({
            data: {
                customerId: customer.id,
                amount: data.amount,
                currency: data.currency,
                paymentDate: new Date(),
                method: data.method,
                reference: data.receiptNo,
                notes: `Receipt for ${data.invoiceRef}`
            }
        });

        // ✨ NEW: Auto-post to General Ledger
        try {
            const { AccountingEngine } = await import('@/lib/accounting/accounting-engine');
            await AccountingEngine.postCustomerPayment(payment.id);
            console.log(`✅ Posted customer payment ${data.receiptNo} to General Ledger`);
        } catch (glError) {
            console.error(`❌ Failed to post customer payment to GL:`, glError);
            // Payment is created but not posted to GL - manual journal entry may be needed
        }

        revalidatePath('/finance-studio');
        return { success: true, data: payment };
    } catch (error) {
        console.error('Failed to create Receipt:', error);
        return { success: false, error: 'Database connection failed' };
    }
}


// --- 3. AUTO-GENERATE STATEMENT (The "Really Smart" Part) ---

export async function generateStatementData(customerName: string, startDate: Date, endDate: Date) {
    // This connects the Studio to the 'Single Source of Truth'

    // 1. Find Customer
    const customer = await prisma.customer.findFirst({
        where: { name: { contains: customerName, mode: 'insensitive' } },
        include: {
            sales: { // Get Invoices (Debits)
                where: {
                    issueDate: { gte: startDate, lte: endDate }
                }
            },
            payments: { // Get Payments (Credits)
                where: {
                    paymentDate: { gte: startDate, lte: endDate }
                }
            },
            creditNotes: { // Get Credit Notes (Credits)
                where: {
                    createdAt: { gte: startDate, lte: endDate }
                }
            }
        }
    });

    if (!customer) return null;

    // 2. Transform DB Data -> Studio Format
    const transactions = [
        ...customer.sales.map(sale => ({
            id: sale.id,
            date: sale.issueDate,
            operator: customer.name, // or specific contact
            invoiceRef: sale.invoiceNumber,
            period: 'N/A', // Derive from date
            debit: sale.totalAmount,
            credit: 0
        })),
        ...customer.payments.map(pay => ({
            id: pay.id,
            date: pay.paymentDate,
            operator: customer.name,
            invoiceRef: pay.reference || 'PAYMENT',
            period: 'N/A',
            debit: 0,
            credit: pay.amount
        })),
        ...customer.creditNotes.map(cn => ({
            id: cn.id,
            date: cn.createdAt,
            operator: customer.name,
            invoiceRef: cn.invoiceRef,
            period: 'N/A',
            debit: 0,
            credit: cn.amount
        }))
    ];

    // Sort by date
    transactions.sort((a, b) => a.date.getTime() - b.date.getTime());

    return {
        customer: {
            name: customer.name,
            address: customer.address,
            country: customer.country,
            taxId: customer.taxId,
        },
        transactions
    };
}
