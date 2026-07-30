const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkData() {
    console.log('--- SYSTEM CHECK: CUSTOMER PAYMENTS & LEDGER ---');

    // 1. Check Accounts
    const cashAccount = await prisma.account.findUnique({ where: { code: '1000' } });
    const arAccount = await prisma.account.findUnique({ where: { code: '1200' } });
    console.log('Account 1000 (Cash/Bank):', cashAccount ? `✅ FOUND (ID: ${cashAccount.id})` : '❌ MISSING');
    console.log('Account 1200 (AR):', arAccount ? `✅ FOUND (ID: ${arAccount.id})` : '❌ MISSING');

    // 2. Query recorded payments
    const payments = await prisma.customerPayment.findMany({
        take: 10,
        orderBy: { updatedAt: 'desc' },
        include: {
            customer: {
                select: { name: true }
            }
        }
    });

    if (payments.length === 0) {
        console.log('\n❌ No customer payments found in the database.');
        return;
    }

    console.log(`\nFound ${payments.length} recent payments. Checking ledger status...`);

    for (const payment of payments) {
        const journalEntry = await prisma.journalEntry.findFirst({
            where: { paymentId: payment.id },
            include: {
                lines: {
                    include: { account: { select: { code: true, name: true } } }
                }
            }
        });

        console.log(`\nPayment ID: ${payment.id}`);
        console.log(`Customer: ${payment.customer.name}`);
        console.log(`Amount: ${payment.amount} ${payment.currency}`);
        console.log(`Date: ${payment.paymentDate}`);
        console.log(`Last Updated: ${payment.updatedAt}`);

        if (journalEntry) {
            console.log(`✅ FEDGER STATUS: POSTED (Entry ID: ${journalEntry.id})`);
            journalEntry.lines.forEach(line => {
                console.log(`   - [${line.account.code}] ${line.account.name}: Dr ${line.debit} | Cr ${line.credit}`);
            });
        } else {
            console.log(`❌ LEDGER STATUS: NOT POSTED`);
        }
    }
}

checkData()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
