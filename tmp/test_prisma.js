const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function test() {
  try {
    const expenses = await prisma.expense.findMany({ take: 1 });
    console.log('Successfully queried expenses:', expenses);
  } catch (err) {
    console.error('Prisma Error:', err);
  } finally {
    await prisma.$disconnect();
  }
}

test();
