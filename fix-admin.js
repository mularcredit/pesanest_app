const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixAdmin() {
  await prisma.user.update({
    where: { email: 'admin@pesastack.com' },
    data: { role: 'SYSTEM_ADMIN' }
  });
  console.log("Updated admin@pesastack.com role to SYSTEM_ADMIN");
}

fixAdmin().catch(console.error).finally(() => prisma.$disconnect());
