const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const missingEmployees = [
    { name: 'Gabriel Chol Aruei', bank: 'Cooperative Bank', accountNumber: '02200004174001', amount: 750.00 },
    { name: 'Hamed Somi Hamed', bank: 'Cooperative Bank', accountNumber: '02200003847001', amount: 1045.00 },
    { name: 'Makuei James Maiak', bank: 'Cooperative Bank', accountNumber: '02109005480500', amount: 1045.00 },
    { name: 'Benjamin Pitia', bank: 'Cooperative Bank', accountNumber: '02200058786001', amount: 499.00 },
    { name: 'Christopher Wani', bank: 'Cooperative Bank', accountNumber: '02200003819001', amount: 1045.00 },
    { name: 'Ryan Stephen Rombe', bank: 'Cooperative Bank', accountNumber: '2200090815001', amount: 495.00 },
    { name: 'Stephen Yasir', bank: 'Stanbic Bank', accountNumber: '200000218021', amount: 1045.00 },
    { name: 'Bol Ring Gum', bank: 'Stanbic Bank', accountNumber: '200000213226', amount: 1600.00 },
    { name: 'Esther Gulliver Wani', bank: 'Ecobank', accountNumber: '6950019794', amount: 300.00 },
    { name: 'Suzi Kija Lukudu', bank: 'Ecobank', accountNumber: '6940056593', amount: 750.00 },
    { name: 'Kabbash Morris Badigo Cook', bank: 'KCB', accountNumber: '5590886406', amount: 1650.00 },
    { name: 'Joseph jaden Lado', bank: 'Cash', accountNumber: '', amount: 495.00 }
];

async function addMissingEmployees() {
    try {
        console.log('🔍 Adding missing employees to salary list...\n');

        // Find the most recent salary batch or create a new one
        const currentMonth = new Date().getMonth() + 1;
        const currentYear = new Date().getFullYear();

        // Try to find existing batch for current month
        let batch = await prisma.salaryBatch.findFirst({
            where: {
                month: currentMonth,
                year: currentYear
            },
            orderBy: {
                createdAt: 'desc'
            }
        });

        // If no batch exists, create one
        if (!batch) {
            const user = await prisma.user.findFirst();
            if (!user) {
                console.error('❌ No user found in database to assign as creator.');
                return;
            }

            const title = `SSCAA Salaries - ${new Date().toLocaleString('default', { month: 'long', year: 'numeric' })} (Missing Employees)`;

            batch = await prisma.salaryBatch.create({
                data: {
                    title: title,
                    month: currentMonth,
                    year: currentYear,
                    totalAmount: 0, // Will update later
                    currency: 'USD',
                    status: 'DRAFT',
                    createdById: user.id,
                    notes: 'Added missing employees from CSV'
                }
            });

            console.log(`✅ Created new batch: ${title} (ID: ${batch.id})\n`);
        } else {
            console.log(`📦 Using existing batch: ${batch.title} (ID: ${batch.id})\n`);
        }

        let added = 0;
        let skipped = 0;
        let totalAdded = 0;

        for (const emp of missingEmployees) {
            try {
                // Check if employee already exists in this batch
                const existing = await prisma.salaryRecord.findFirst({
                    where: {
                        batchId: batch.id,
                        employeeName: emp.name
                    }
                });

                if (existing) {
                    console.log(`⏭️  Skipped: ${emp.name} (already exists in batch)`);
                    skipped++;
                    continue;
                }

                // Add the employee to the batch
                await prisma.salaryRecord.create({
                    data: {
                        batchId: batch.id,
                        employeeName: emp.name,
                        bankName: emp.bank,
                        accountNumber: emp.accountNumber || '',
                        amount: emp.amount,
                        notes: 'Added from missing employees CSV'
                    }
                });

                console.log(`✅ Added: ${emp.name} - $${emp.amount.toFixed(2)} (${emp.bank})`);
                added++;
                totalAdded += emp.amount;
            } catch (error) {
                console.error(`❌ Error adding ${emp.name}:`, error.message);
            }
        }

        // Update batch total amount
        if (added > 0) {
            const currentTotal = batch.totalAmount || 0;
            await prisma.salaryBatch.update({
                where: { id: batch.id },
                data: {
                    totalAmount: currentTotal + totalAdded
                }
            });
        }

        console.log(`\n📊 Summary:`);
        console.log(`   ✅ Added: ${added} employees`);
        console.log(`   💰 Total Amount Added: $${totalAdded.toFixed(2)}`);
        console.log(`   ⏭️  Skipped: ${skipped}`);
        console.log(`   📝 Total Processed: ${missingEmployees.length}`);
        console.log(`\n✨ Done!`);

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

addMissingEmployees();
