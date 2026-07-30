import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const rmHash = await bcrypt.hash('RegionalManager123!', 10);
  const bmHash = await bcrypt.hash('BranchManager123!', 10);

  // Get the first available region and branch
  const region = await prisma.region.findFirst();
  const branch = await prisma.branch.findFirst({ where: { regionId: region?.id } });

  console.log('Region found:', region?.name, region?.id);
  console.log('Branch found:', branch?.name, branch?.id);

  // Update/Create RM
  await prisma.user.upsert({
    where: { email: 'regionalmanager@pesanest.com' },
    update: { 
        accountStatus: 'ACTIVE', 
        isActive: true, 
        regionId: region?.id || null, 
        password: rmHash,
        role: 'REGIONAL_MANAGER'
    },
    create: {
      email: 'regionalmanager@pesanest.com',
      name: 'Test Regional Manager',
      password: rmHash,
      role: 'REGIONAL_MANAGER',
      accountStatus: 'ACTIVE',
      isActive: true,
      regionId: region?.id || null,
    },
  });

  // Update/Create BM
  await prisma.user.upsert({
    where: { email: 'branchmanager@pesastack.com' },
    update: { 
        accountStatus: 'ACTIVE', 
        isActive: true, 
        branchId: branch?.id || null, 
        password: bmHash,
        role: 'TEAM_LEADER'
    },
    create: {
      email: 'branchmanager@pesastack.com',
      name: 'Test Branch Manager',
      password: bmHash,
      role: 'TEAM_LEADER',
      accountStatus: 'ACTIVE',
      isActive: true,
      branchId: branch?.id || null,
    },
  });

  console.log('✅ Credentials synchronized.');
  await prisma.$disconnect();
}

main().catch(console.error);
