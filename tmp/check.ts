import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const approvals = await prisma.approval.findMany({
        where: { status: 'PENDING' },
        include: {
            expense: true, requisition: true, invoice: true, monthlyBudget: true
        }
    });
    console.log(`Total Pending Approvals: ${approvals.length}`);
    let badCount = 0;
    for (const a of approvals) {
        if (a.expense && a.expense.status !== 'PENDING_APPROVAL') badCount++;
        if (a.requisition && a.requisition.status !== 'PENDING_APPROVAL') badCount++;
        if (a.invoice && a.invoice.status !== 'PENDING') badCount++;
        // budgets don't use PENDING_APPROVAL, wait, what status do they have?
    }
    console.log(`Approvals pointing to non-pending items: ${badCount}`);
}
main().catch(console.error).finally(() => prisma.$disconnect());
