import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
const prisma = new PrismaClient();
async function main() {
  const user = await prisma.user.findUnique({ where: { email: 'regionalmanager@pesanest.com' } });
  if (!user) { console.log('RESULT:NOT_FOUND'); return; }
  const match = await bcrypt.compare('RegionalManager123!', user.password);
  console.log(`RESULT:${match ? 'SUCCESS' : 'FAIL'}_STATUS:${user.accountStatus}_ACTIVE:${user.isActive}`);
}
main().finally(() => prisma.$disconnect());
