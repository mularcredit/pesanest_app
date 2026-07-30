import prisma from './src/lib/prisma';

async function test() {
    try {
        const userCount = await prisma.user.count();
        console.log('User count:', userCount);
        const users = await prisma.user.findMany({ select: { email: true } });
        console.log('Users:', users);
    } catch (e) {
        console.error('Prisma Error:', e);
    } finally {
        await prisma.$disconnect();
    }
}

test();
