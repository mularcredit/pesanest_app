'use server';

import prisma from "@/lib/prisma";

export async function getCustomersForStudio() {
    try {
        const customers = await prisma.customer.findMany({
            where: { isActive: true },
            select: {
                id: true,
                name: true,
                address: true,
                city: true,
                country: true,
                taxId: true,
                currency: true
            },
            orderBy: { name: 'asc' }
        });
        return customers;
    } catch (error) {
        console.error("Failed to fetch customers for studio:", error);
        return [];
    }
}

export async function getStatementData(customerId: string, fromDate: string, toDate: string) {
    try {
        const startDate = new Date(fromDate);
        const endDate = new Date(toDate);
        const endDateInclusive = new Date(endDate);
        endDateInclusive.setHours(23, 59, 59, 999);

        // 1. Calculate Opening Balance
        const prevSales = await prisma.sale.aggregate({
            where: {
                customerId: customerId,
                issueDate: { lt: startDate }
            },
            _sum: { totalAmount: true }
        });

        const prevPayments = await prisma.customerPayment.aggregate({
            where: {
                customerId: customerId,
                paymentDate: { lt: startDate }
            },
            _sum: { amount: true }
        });

        const prevCreditNotes = await prisma.creditNote.aggregate({
            where: {
                customerId: customerId,
                createdAt: { lt: startDate },
                status: { not: 'VOIDED' }
            },
            _sum: { amount: true }
        });

        const openingBalance = Number(prevSales._sum.totalAmount || 0) - Number(prevPayments._sum.amount || 0) - Number(prevCreditNotes._sum.amount || 0);

        // 2. Fetch Customer and Transactions
        const customer = await prisma.customer.findUnique({
            where: { id: customerId },
            include: {
                sales: {
                    where: {
                        issueDate: {
                            gte: startDate,
                            lte: endDateInclusive
                        }
                    },
                    orderBy: { issueDate: 'asc' },
                    include: { items: true }
                },
                payments: {
                    where: {
                        paymentDate: {
                            gte: startDate,
                            lte: endDateInclusive
                        }
                    },
                    orderBy: { paymentDate: 'asc' },
                    include: { sale: { select: { invoiceNumber: true } } }
                },
                creditNotes: {
                    where: {
                        createdAt: {
                            gte: startDate,
                            lte: endDateInclusive
                        },
                        status: { not: 'VOIDED' }
                    },
                    orderBy: { createdAt: 'asc' }
                }
            }
        });

        if (!customer) return null;

        // 3. Format Transactions
        const transactions = [
            ...customer.sales.map((s: any) => ({
                id: s.id,
                date: s.issueDate,
                type: 'INVOICE',
                reference: s.invoiceNumber,
                description: 'Sales Invoice',
                debit: s.totalAmount,
                credit: 0
            })),
            ...customer.payments.map((p: any) => ({
                id: p.id,
                date: p.paymentDate,
                type: 'PAYMENT',
                reference: p.reference || 'PAYMENT',
                description: `Payment ${p.sale?.invoiceNumber ? `for ${p.sale.invoiceNumber} ` : ''}via ${p.method.replace('_', ' ')}`,
                debit: 0,
                credit: p.amount
            })),
            ...customer.creditNotes.map((cn: any) => ({
                id: cn.id,
                date: cn.createdAt,
                type: 'CREDIT_NOTE',
                reference: cn.cnNumber,
                description: `Credit Note issued against ${cn.invoiceRef}`,
                debit: 0,
                credit: cn.amount
            }))
        ].sort((a: any, b: any) => {
            const getTimestamp = (d: any) => {
                if (d instanceof Date) return d.getTime();
                if (typeof d === 'string') return new Date(d).getTime();
                return 0;
            };
            return getTimestamp(a.date) - getTimestamp(b.date);
        });

        // 4. Calculate Running Balances
        let runningBalance = openingBalance;
        const formattedTransactions = transactions.map((t, idx) => {
            runningBalance += t.debit - t.credit;

            // Get the actual sale to extract operator/description
            let operator = customer.name;
            if (t.type === 'INVOICE') {
                const sale = customer.sales.find((s: any) => s.id === t.id);
                if (sale && sale.items && sale.items.length > 0) {
                    // Use first item description as operator
                    operator = sale.items[0].description || customer.name;
                } else {
                    operator = t.description || customer.name;
                }
            } else if (t.type === 'CREDIT_NOTE') {
                operator = t.description;
            } else {
                // For payments, show payment method
                operator = t.description;
            }

            return {
                id: idx + 1,
                operator: operator,
                invoiceRef: t.reference,
                period: new Date(t.date).toLocaleDateString('en-GB'),
                debit: t.debit,
                credit: t.credit,
                balance: runningBalance
            };
        });

        const periodInvoiced = customer.sales.reduce((sum, s) => sum + Number(s.totalAmount), 0);
        const periodPaid = customer.payments.reduce((sum, p) => sum + p.amount, 0);
        const periodCreditNotes = customer.creditNotes.reduce((sum: number, cn: any) => sum + cn.amount, 0);
        const endingBalance = openingBalance + periodInvoiced - periodPaid - periodCreditNotes;

        return {
            customer: {
                name: customer.name,
                group: customer.contactPerson || 'Individual',
                country: customer.country || 'South Sudan',
                accountType: 'Standard Account'
            },
            summary: {
                openingBalance,
                totalCharges: periodInvoiced,
                totalPayments: periodPaid,
                outstandingBalance: endingBalance
            },
            transactions: formattedTransactions
        };

    } catch (error) {
        console.error("Error generating statement data:", error);
        return null;
    }
}

export async function checkCreditNoteNumberUniqueness(cnNumber: string) {
    try {
        const existing = await prisma.creditNote.findUnique({
            where: { cnNumber }
        });
        return { exists: !!existing };
    } catch (error) {
        console.error("Error checking credit note uniqueness:", error);
        return { error: "Failed to verify uniqueness" };
    }
}

