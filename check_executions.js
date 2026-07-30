
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const latestExecutions = await prisma.scheduleExecution.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: {
            schedule: true
        }
    });

    console.log('Latest Schedule Executions:');
    console.log(JSON.stringify(latestExecutions, null, 2));
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
