
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const assets = await prisma.asset.findMany({
        where: {
            updatedAt: {
                gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
            }
        }
    });

    console.log('Assets updated in last 24h:', assets.length);
    assets.forEach(a => {
        console.log(`Asset: ${a.name}, CurrentValue: ${a.currentValue}, UpdatedAt: ${a.updatedAt}`);
    });
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
