
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const latestEntries = await prisma.journalEntry.findMany({
        where: {
            description: {
                contains: 'Depreciation'
            }
        },
        orderBy: {
            date: 'desc'
        },
        take: 10,
        include: {
            lines: {
                include: {
                    account: true
                }
            }
        }
    });

    console.log('Latest Depreciation Journal Entries:');
    console.log(JSON.stringify(latestEntries, null, 2));

    const totalDepreciation = await prisma.journalEntry.aggregate({
        where: {
            description: {
                contains: 'Depreciation'
            }
        },
        _count: true
    });
    console.log('Total Depreciation Entries:', totalDepreciation._count);
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
