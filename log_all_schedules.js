
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const schedules = await prisma.schedule.findMany();
    console.log('Total Schedules:', schedules.length);
    console.log(JSON.stringify(schedules, null, 2));
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
