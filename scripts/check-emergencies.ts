
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('--- COMPREHENSIVE PENDING EMERGENCY AUDIT ---');
    console.log('Date:', new Date().toLocaleString());
    console.log('');

    try {
        // 1. Audit Expenses (which the UI calls "Emergencies")
        // We look for DRAFT (Pending Submission) or PENDING_APPROVAL
        const pendingExpenses = await prisma.expense.findMany({
            where: {
                status: { in: ['DRAFT', 'PENDING_APPROVAL'] }
            },
            include: {
                user: { select: { name: true, email: true } }
            }
        });

        console.log(`[EXPENSES] Found ${pendingExpenses.length} pending items (Draft/Pending Approval)`);
        pendingExpenses.forEach(exp => {
            console.log(`  - ${exp.title} ($${exp.amount.toFixed(2)})`);
            console.log(`    Status: ${exp.status} | User: ${exp.user.name} (${exp.user.email})`);
            console.log(`    Category: ${exp.category} | Created: ${exp.createdAt.toLocaleDateString()}`);
            console.log('');
        });

        // 2. Audit Requisitions (specifically Expedited or Emergency category)
        const pendingRequisitions = await prisma.requisition.findMany({
            where: {
                OR: [
                    { status: 'PENDING' },
                    { type: { in: ['SOUTH_SUDAN', 'SOUTH_SUDAN_STRICT'] } },
                    { category: 'Emergency Field Expenses' }
                ],
                // But we only care about those that aren't already closed/paid if we want "pending"
                NOT: {
                    status: { in: ['PAID', 'CLOSED', 'REJECTED'] }
                }
            },
            include: {
                user: { select: { name: true, email: true } }
            }
        });

        console.log(`[REQUISITIONS] Found ${pendingRequisitions.length} pending/expedited items`);
        pendingRequisitions.forEach(req => {
            console.log(`  - ${req.title} ($${req.amount.toFixed(2)})`);
            console.log(`    Status: ${req.status} | Type: ${req.type} | Category: ${req.category}`);
            console.log(`    User: ${req.user.name} (${req.user.email}) | Created: ${req.createdAt.toLocaleDateString()}`);
            console.log('');
        });

        if (pendingExpenses.length === 0 && pendingRequisitions.length === 0) {
            console.log('✅ No pending emergencies found in the database.');
        }

    } catch (error) {
        console.error('Audit failed:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
