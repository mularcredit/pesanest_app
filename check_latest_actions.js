
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const assets = await prisma.asset.findMany({
        where: { status: 'ACTIVE' }
    });
    console.log('Active Assets Count:', assets.length);
    if (assets.length > 0) {
        console.log('Sample Asset:', {
            name: assets[0].name,
            currentValue: assets[0].currentValue,
            purchasePrice: assets[0].purchasePrice,
            depreciationMethod: assets[0].depreciationMethod
        });
    }

    const latestEntries = await prisma.journalEntry.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: {
            lines: true
        }
    });

    console.log('Latest 5 Journal Entries:');
    console.log(JSON.stringify(latestEntries, null, 2));
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
