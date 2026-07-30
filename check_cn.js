
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const cn = await prisma.creditNote.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5
    });
    console.log('Latest Credit Notes:', cn);
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
