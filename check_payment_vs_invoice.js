
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
    console.log('--- CHECKING PAYMENT DATES VS INVOICE DATES ---');

    const payments = await prisma.customerPayment.findMany({
        take: 5,
        orderBy: { updatedAt: 'desc' },
        where: {
            saleId: { not: null }
        },
        include: {
            sale: true,
            customer: { select: { name: true } }
        }
    });

    if (payments.length === 0) {
        console.log('No payments linked to sales found.');
        return;
    }

    payments.forEach(p => {
        console.log(`\nPayment ID: ${p.id}`);
        console.log(`Customer: ${p.customer.name}`);
        console.log(`Amount: ${p.amount}`);
        console.log(`Payment Date (DB): ${p.paymentDate.toISOString()}`);
        console.log(`Invoice Number: ${p.sale.invoiceNumber}`);
        console.log(`Invoice Issue Date: ${p.sale.issueDate.toISOString()}`);
        console.log(`Invoice RECORDED (createdAt): ${p.sale.createdAt.toISOString()}`);

        const payTime = new Date(p.paymentDate).getTime();
        const invTime = new Date(p.sale.issueDate).getTime();
        const createdTime = new Date(p.sale.createdAt).getTime();

        const diffDays = (payTime - invTime) / (1000 * 3600 * 24);
        const diffCreatedDays = (payTime - createdTime) / (1000 * 3600 * 24);

        console.log(`Difference (Payment - Issue): ${diffDays.toFixed(2)} days`);
        console.log(`Difference (Payment - Recorded): ${diffCreatedDays.toFixed(2)} days`);

        if (payTime === invTime) {
            console.log('⚠️ ALERT: Payment Date is SAME as Invoice Issue Date');
        } else {
            console.log('✅ Payment Date is different from Invoice Issue Date');
        }

        // Check if Payment Date is suspiciously close to Recorded Date (e.g. same second/minute if automated)
        if (Math.abs(diffCreatedDays) < 0.01) {
            console.log('⚠️ ALERT: Payment Date is SAME as Invoice RECORDED Date (createdAt)');
        }
    });
}

check()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
