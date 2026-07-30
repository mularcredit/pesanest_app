// Script to check and fix requisition/expense data
import prisma from './src/lib/prisma';

async function checkData() {
    console.log('\n=== Checking Requisitions ===');
    const requisitions = await prisma.requisition.findMany({
        orderBy: { createdAt: 'desc' },
        take: 10
    });

    console.log(`Total requisitions: ${requisitions.length}`);
    requisitions.forEach(req => {
        console.log(`- ${req.id.slice(0, 8)}: ${req.title} | Status: ${req.status} | Amount: $${req.amount}`);
    });

    console.log('\n=== Checking Expenses ===');
    const expenses = await prisma.expense.findMany({
        where: {
            status: 'APPROVED',
            isReimbursable: true
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: {
            user: {
                select: { name: true, email: true }
            }
        }
    });

    console.log(`Approved reimbursable expenses: ${expenses.length}`);
    expenses.forEach(exp => {
        console.log(`- ${exp.id.slice(0, 8)}: ${exp.title} | User: ${exp.user.name} | Amount: $${exp.amount} | Receipt: ${exp.receiptUrl ? 'Yes' : 'No'}`);
    });

    console.log('\n=== Checking for Requisitions with Expenses ===');
    const reqsWithExpenses = await prisma.requisition.findMany({
        where: {
            expenses: {
                some: {}
            }
        },
        include: {
            expenses: {
                select: {
                    id: true,
                    status: true,
                    amount: true
                }
            }
        }
    });

    console.log(`Requisitions with expenses: ${reqsWithExpenses.length}`);
    reqsWithExpenses.forEach(req => {
        console.log(`- Req ${req.id.slice(0, 8)} (${req.status}): ${req.expenses.length} expense(s)`);
        req.expenses.forEach(exp => {
            console.log(`  └─ Expense ${exp.id.slice(0, 8)}: ${exp.status} | $${exp.amount}`);
        });
    });

    await prisma.$disconnect();
}

checkData().catch(console.error);
