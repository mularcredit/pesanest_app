import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
    console.log("Expenses count:", await prisma.expense.count());
    console.log("Pending count:", await prisma.expense.count({ where: { status: 'PENDING_APPROVAL' } }));
    console.log("Submitted count:", await prisma.expense.count({ where: { status: 'SUBMITTED' } }));
    const expenses = await prisma.expense.findMany({ take: 2, orderBy: { createdAt: 'desc' }, select: { amount: true, createdAt: true, status: true } });
    console.log("Recent expenses:", expenses);
}
main().catch(console.error).finally(() => prisma.$disconnect());
