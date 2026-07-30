import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkSale() {
    const searchTerm = 'ANS-EVT7Q';

    // Try to find by ID first
    let sale = await prisma.sale.findUnique({
        where: { id: searchTerm },
        include: {
            customer: {
                select: {
                    name: true,
                    currency: true
                }
            },
            payments: {
                orderBy: { paymentDate: 'desc' }
            },
            items: true
        }
    });

    // If not found by ID, try by invoice number
    if (!sale) {
        sale = await prisma.sale.findUnique({
            where: { invoiceNumber: searchTerm },
            include: {
                customer: {
                    select: {
                        name: true,
                        currency: true
                    }
                },
                payments: {
                    orderBy: { paymentDate: 'desc' }
                },
                items: true
            }
        });
    }

    if (!sale) {
        console.log(`❌ Sale with ID or Invoice Number "${searchTerm}" not found`);
        console.log('\nSearching for similar invoice numbers...');

        const similarSales = await prisma.sale.findMany({
            where: {
                invoiceNumber: {
                    contains: searchTerm.substring(0, 5)
                }
            },
            select: {
                id: true,
                invoiceNumber: true,
                status: true,
                totalAmount: true,
                customer: {
                    select: { name: true }
                }
            },
            take: 5
        });

        if (similarSales.length > 0) {
            console.log('\nFound similar invoices:');
            similarSales.forEach(s => {
                console.log(`  - ${s.invoiceNumber} (${s.status}) - ${s.customer.name} - $${s.totalAmount}`);
            });
        }

        await prisma.$disconnect();
        return;
    }

    console.log('\n📋 SALE DETAILS:');
    console.log('================');
    console.log(`ID: ${sale.id}`);
    console.log(`Invoice Number: ${sale.invoiceNumber}`);
    console.log(`Customer: ${sale.customer.name}`);
    console.log(`Total Amount: ${sale.currency} ${Number(sale.totalAmount).toFixed(2)}`);
    console.log(`Tax Amount: ${sale.currency} ${sale.taxAmount.toFixed(2)}`);
    console.log(`Status: ${sale.status}`);
    console.log(`Issue Date: ${sale.issueDate.toISOString().split('T')[0]}`);
    console.log(`Due Date: ${sale.dueDate.toISOString().split('T')[0]}`);

    console.log('\n💰 PAYMENTS RECEIVED:');
    console.log('=====================');

    if (sale.payments.length === 0) {
        console.log('⚠️  NO PAYMENTS FOUND for this sale');
    } else {
        let totalPaid = 0;
        sale.payments.forEach((payment, index) => {
            totalPaid += payment.amount;
            console.log(`\n  Payment ${index + 1}:`);
            console.log(`  - ID: ${payment.id}`);
            console.log(`  - Amount: ${payment.currency} ${payment.amount.toFixed(2)}`);
            console.log(`  - Date: ${payment.paymentDate.toISOString().split('T')[0]}`);
            console.log(`  - Method: ${payment.method}`);
            console.log(`  - Reference: ${payment.reference || 'N/A'}`);
        });

        console.log(`\n  📊 Total Paid: ${sale.currency} ${totalPaid.toFixed(2)}`);
        console.log(`  📊 Outstanding: ${sale.currency} ${(Number(sale.totalAmount) - totalPaid).toFixed(2)}`);
    }

    console.log('\n📦 LINE ITEMS:');
    console.log('==============');
    sale.items.forEach((item, index) => {
        console.log(`  ${index + 1}. ${item.description}`);
        console.log(`     Qty: ${item.quantity} × ${sale.currency} ${item.unitPrice.toFixed(2)} = ${sale.currency} ${item.total.toFixed(2)}`);
    });

    console.log('\n🔍 ANALYSIS:');
    console.log('============');
    const totalPaid = sale.payments.reduce((sum, p) => sum + p.amount, 0);
    const outstanding = Number(sale.totalAmount) - totalPaid;

    console.log(`Total Invoice Amount: ${sale.currency} ${Number(sale.totalAmount).toFixed(2)}`);
    console.log(`Total Paid: ${sale.currency} ${totalPaid.toFixed(2)}`);
    console.log(`Outstanding: ${sale.currency} ${outstanding.toFixed(2)}`);

    if (totalPaid >= Number(sale.totalAmount)) {
        console.log(`✅ Status should be: PAID (Fully paid)`);
    } else if (totalPaid > 0) {
        console.log(`⚠️  Status should be: PARTIAL (Partially paid)`);
    } else {
        console.log(`❌ Status should be: SENT or PENDING (No payments)`);
    }

    console.log(`📌 Current Status: ${sale.status}`);

    if (sale.status === 'PAID' && totalPaid < Number(sale.totalAmount)) {
        console.log('\n🚨 ISSUE DETECTED:');
        console.log('==================');
        console.log(`This sale is marked as PAID but only ${sale.currency} ${totalPaid.toFixed(2)} out of ${sale.currency} ${Number(sale.totalAmount).toFixed(2)} has been received.`);
        console.log(`There's a discrepancy of ${sale.currency} ${outstanding.toFixed(2)}`);
    } else if (sale.status === 'PAID' && totalPaid === 0) {
        console.log('\n🚨 CRITICAL ISSUE:');
        console.log('==================');
        console.log(`This sale is marked as PAID but NO PAYMENTS have been recorded!`);
        console.log(`This is likely a data integrity issue.`);
    }

    await prisma.$disconnect();
}

checkSale().catch(console.error);
