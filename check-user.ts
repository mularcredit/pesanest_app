import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function checkUser() {
  const user = await prisma.user.findUnique({
    where: { email: 'branchmanager@pesastack.com' },
  });
  if (user) {
    console.log('User found:', JSON.stringify(user, null, 2));
  } else {
    console.log('User NOT found');
  }
  await prisma.$disconnect();
}

checkUser().catch(console.error);
