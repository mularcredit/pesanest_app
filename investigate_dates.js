
// Simulate server logic
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
    console.log('--- DATES INVESTIGATION ---');

    // Find customers
    const customers = await prisma.customer.findMany({ select: { id: true, name: true } });
    const c = customers.find(x => x.name.includes("ETHIOPIAN"));
    if (!c) { console.log("Customer not found"); return; }

    console.log(`Checking Customer: ${c.name} (${c.id})`);

    // Get sales
    const sales = await prisma.sale.findMany({
        where: { customerId: c.id },
        orderBy: { issueDate: 'desc' },
        take: 3
    });

    // Get payments
    const payments = await prisma.customerPayment.findMany({
        where: { customerId: c.id },
        orderBy: { paymentDate: 'desc' },
        take: 3
    });

    console.log('\n--- SIMULATING STATEMENT FORMATTING (en-GB Locale) ---');
    // Using en-GB explicitly to mimic server action
    const options = { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' };
    // Usually server uses UTC timezone for formatting unless specified otherwise!

    sales.forEach(s => {
        console.log(`\nINVOICE: ${s.invoiceNumber}`);
        console.log(`  DB Value: ${s.issueDate.toISOString()}`);
        console.log(`  Formatted (UTC Locale): ${s.issueDate.toLocaleDateString('en-GB', { timeZone: 'UTC' })}`);
        console.log(`  Formatted (Wait, no timezone passed?): ${s.issueDate.toLocaleDateString('en-GB')}`);
        // Check if time component exists
        if (s.issueDate.toISOString().includes("T00:00:00.000Z")) {
            console.log("  Is Midnight UTC: YES");
        } else {
            console.log("  Is Midnight UTC: NO (" + s.issueDate.toISOString() + ")");
        }
    });

    payments.forEach(p => {
        console.log(`\nPAYMENT: ${p.id}`);
        console.log(`  DB Value: ${p.paymentDate.toISOString()}`);
        console.log(`  Formatted (UTC Locale): ${p.paymentDate.toLocaleDateString('en-GB', { timeZone: 'UTC' })}`);
        console.log(`  Formatted (Wait, no timezone passed?): ${p.paymentDate.toLocaleDateString('en-GB')}`);
        if (p.paymentDate.toISOString().includes("T00:00:00.000Z")) {
            console.log("  Is Midnight UTC: YES");
        } else {
            console.log("  Is Midnight UTC: NO (" + p.paymentDate.toISOString() + ")");
        }
    });
}

check()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
