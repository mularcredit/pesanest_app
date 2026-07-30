import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const rm = await prisma.user.findUnique({ where: { email: 'regionalmanager@pesanest.com' } });
  const bm = await prisma.user.findUnique({ where: { email: 'branchmanager@pesastack.com' } });

  if (!rm || !bm) {
    console.log('Missing RM or BM accounts!');
    return;
  }

  const branch = await prisma.branch.findUnique({ where: { id: bm.branchId! } });
  if (!branch) {
      console.log('BM has no branch assigned');
      return;
  }

  console.log(`RM Region: ${rm.regionId}`);
  console.log(`BM Branch Region: ${branch.regionId}`);

  if (rm.regionId !== branch.regionId) {
    console.log('Misaligned Regions! Updating RM to match BM branch region...');
    await prisma.user.update({
        where: { email: 'regionalmanager@pesanest.com' },
        data: { regionId: branch.regionId }
    });
    console.log('Updated RM region to match BM.');
  } else {
    console.log('Regions are correctly aligned.');
  }

}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
