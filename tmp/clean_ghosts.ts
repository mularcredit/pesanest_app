import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const approvals = await prisma.approval.findMany({
        where: { status: 'PENDING' },
        include: {
            expense: { select: { id: true } },
            requisition: { select: { id: true } },
            invoice: { select: { id: true } },
            monthlyBudget: { select: { id: true } }
        }
    });
    
    const idsToDelete: string[] = [];
    for (const a of approvals) {
        if (!a.expense && !a.requisition && !a.invoice && !a.monthlyBudget) {
            idsToDelete.push(a.id);
        }
    }
    
    if (idsToDelete.length > 0) {
        const res = await prisma.approval.deleteMany({
            where: { id: { in: idsToDelete } }
        });
        console.log(`Deleted ${res.count} ghost approvals`);
    } else {
        console.log("No ghosts found");
    }
}
main().catch(console.error).finally(() => prisma.$disconnect());
