
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log("Fetching payments...");
    const payments = await prisma.customerPayment.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        select: {
            id: true,
            paymentDate: true,
            createdAt: true,
            customer: { select: { name: true } }
        }
    });

    console.log("Last 10 Payments:");
    payments.forEach(p => {
        console.log(`Payment ID: ${p.id}`);
        console.log(`  Customer: ${p.customer.name}`);
        console.log(`  Payment Date: ${p.paymentDate} (Type: ${typeof p.paymentDate})`);
        console.log(`  Created At:   ${p.createdAt}`);
        console.log(`  Difference:   ${p.createdAt.getTime() - p.paymentDate.getTime()} ms`);
        console.log("------------------------------------------------");
    });
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
