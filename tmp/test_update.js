const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testUpdate() {
  try {
    // Find a draft expense
    const draft = await prisma.expense.findFirst({ where: { status: 'DRAFT' } });
    if (!draft) {
      console.log('No draft expense found to test update.');
      return;
    }
    console.log('Found draft expense:', draft.id);

    // Try to update it
    const updated = await prisma.expense.update({
      where: { id: draft.id },
      data: { title: draft.title + ' (Updated Test)' }
    });
    console.log('Successfully updated expense:', updated.id);
  } catch (err) {
    console.error('Update Error:', err);
  } finally {
    await prisma.$disconnect();
  }
}

testUpdate();
