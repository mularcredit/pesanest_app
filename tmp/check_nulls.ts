import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const approvals = await prisma.approval.findMany({
        where: { status: 'PENDING' },
        include: {
            expense: true, requisition: true, invoice: true, monthlyBudget: true
        }
    });
    
    let nullCount = 0;
    for (const a of approvals) {
        if (!a.expense && !a.requisition && !a.invoice && !a.monthlyBudget) {
            nullCount++;
        }
    }
    console.log(`Approvals pointing to NOTHING: ${nullCount} out of ${approvals.length}`);
}
main().catch(console.error).finally(() => prisma.$disconnect());
