import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  try {
    const req = await (prisma as any).requisition.findFirst({
      where: { id: { contains: 'CMO7Y990' } },
      include: { payment: true }
    });
    console.log(JSON.stringify(req, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
}
main();
