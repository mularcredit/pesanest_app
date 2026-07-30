import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const hash = await bcrypt.hash('RegionalManager123!', 10);

  // Get the first available region
  const region = await prisma.region.findFirst();
  console.log('Region found:', region?.name, region?.id);

  const user = await prisma.user.upsert({
    where: { email: 'regionalmanager@pesanest.com' },
    update: { accountStatus: 'ACTIVE', isActive: true, regionId: region?.id || null, password: hash },
    create: {
      email: 'regionalmanager@pesanest.com',
      name: 'Test Regional Manager',
      password: hash,
      role: 'REGIONAL_MANAGER',
      accountStatus: 'ACTIVE',
      isActive: true,
      regionId: region?.id || null,
    },
  });

  console.log('✅ Created user:', user.email, '| Role:', user.role, '| Region:', user.regionId);

  // Check the branch manager
  const branchManager = await prisma.user.findFirst({
      where: { role: 'TEAM_LEADER' },
      include: { leadBranch: true }
  });
  console.log('Branch Manager:', branchManager?.email, '| Branch:', branchManager?.leadBranch?.name, '| RegionId:', branchManager?.leadBranch?.regionId);

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
