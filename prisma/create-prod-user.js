const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const hash = await bcrypt.hash('BranchManager123!', 10);
  const branch = await prisma.branch.findFirst();
  console.log('Branch:', branch ? branch.name : 'NONE FOUND');

  const user = await prisma.user.upsert({
    where: { email: 'branchmanager@pesastack.com' },
    update: { accountStatus: 'ACTIVE', isActive: true, password: hash },
    create: {
      email: 'branchmanager@pesastack.com',
      name: 'Test Branch Manager',
      password: hash,
      role: 'TEAM_LEADER',
      accountStatus: 'ACTIVE',
      isActive: true,
      branchId: branch ? branch.id : null
    }
  });

  console.log('SUCCESS:', user.email, '|', user.role, '| Branch:', user.branchId);
  await prisma.$disconnect();
}

main().catch(e => { console.error('FAILED:', e.message); process.exit(1); });
