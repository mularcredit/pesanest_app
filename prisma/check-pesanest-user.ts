import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const email = 'regionalmanager@pesanest.com';
    const user = await prisma.user.findUnique({
        where: { email },
        select: {
            email: true,
            role: true,
            accountStatus: true,
            isActive: true,
            regionId: true
        }
    });
    console.log('--- PESANEST DB USER CHECK ---');
    if (user) {
        console.log('User found:', JSON.stringify(user, null, 2));
    } else {
        console.log('User NOT FOUND in Pesanest DB');
    }
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
