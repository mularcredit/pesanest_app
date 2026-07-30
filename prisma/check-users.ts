import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    where: {
      email: { in: ['regionalmanager@pesanest.com', 'branchmanager@pesastack.com'] }
    },
    select: {
      email: true,
      role: true,
      accountStatus: true,
      isActive: true,
      regionId: true,
      branchId: true
    }
  });

  console.log('Users found:', JSON.stringify(users, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
