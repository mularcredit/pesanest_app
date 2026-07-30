const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const branches = await prisma.branch.findMany({ select: { name: true, code: true } });
  console.log('Branches:', branches);
  
  const regions = await prisma.region.findMany({ select: { name: true, code: true } });
  console.log('Regions:', regions);

  const customers = await prisma.customer.findMany({ select: { name: true } });
  console.log('Customers:', customers);
}

main().catch(console.error).finally(() => prisma.$disconnect());
