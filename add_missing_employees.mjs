import { PrismaClient } from '@prisma/client';

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
  console.log('🔍 Adding missing employees to salary list...\n');

  // Get the current month/year for the salary period
  const now = new Date();
  const month = now.toLocaleString('en-US', { month: 'long' });
  const year = now.getFullYear();
  const period = `${month} ${year}`;

  let added = 0;
  let skipped = 0;

  for (const emp of missingEmployees) {
    try {
      // Check if employee already exists in the current period
      const existing = await prisma.salary.findFirst({
        where: {
          employeeName: emp.name,
          period: period
        }
      });

      if (existing) {
        console.log(`⏭️  Skipped: ${emp.name} (already exists for ${period})`);
        skipped++;
        continue;
      }

      // Add the employee
      const salary = await prisma.salary.create({
        data: {
          employeeName: emp.name,
          bankName: emp.bank,
          accountNumber: emp.accountNumber,
          grossSalary: emp.amount,
          netSalary: emp.amount,
          period: period,
          status: 'PENDING',
          paymentMethod: emp.bank === 'Cash' ? 'CASH' : 'BANK_TRANSFER',
          uploadedAt: new Date()
        }
      });

      console.log(`✅ Added: ${emp.name} - $${emp.amount.toFixed(2)} (${emp.bank})`);
      added++;
    } catch (error) {
      console.error(`❌ Error adding ${emp.name}:`, error.message);
    }
  }

  console.log(`\n📊 Summary:`);
  console.log(`   ✅ Added: ${added}`);
  console.log(`   ⏭️  Skipped: ${skipped}`);
  console.log(`   📝 Total: ${missingEmployees.length}`);
}

addMissingEmployees()
  .then(() => {
    console.log('\n✨ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
