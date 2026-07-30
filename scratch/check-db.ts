
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const count = await prisma.account.count({
    where: { type: 'EXPENSE' }
  });
  console.log(`Current expense account count: ${count}`);
  
  const accounts = await prisma.account.findMany({
    where: { type: 'EXPENSE' },
    take: 5
  });
  console.log('Sample accounts:', JSON.stringify(accounts, null, 2));
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
