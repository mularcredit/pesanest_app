import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const hash = await bcrypt.hash('BranchManager123!', 10);

  // Get the first available branch
  const branch = await prisma.branch.findFirst();
  console.log('Branch found:', branch?.name, branch?.id);

  const user = await prisma.user.upsert({
    where: { email: 'branchmanager@pesastack.com' },
    update: { accountStatus: 'ACTIVE', isActive: true },
    create: {
      email: 'branchmanager@pesastack.com',
      name: 'Test Branch Manager',
      password: hash,
      role: 'TEAM_LEADER',
      accountStatus: 'ACTIVE',
      isActive: true,
      branchId: branch?.id || null,
    },
  });

  console.log('✅ Created user:', user.email, '| Role:', user.role, '| Branch:', user.branchId);
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
