import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const res = await prisma.approval.updateMany({
        where: {
            status: 'ADJUSTMENT',
            requisition: {
                status: 'PENDING'
            }
        },
        data: {
            status: 'PENDING'
        }
    });
    console.log(`Updated ${res.count} approval records to PENDING.`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
