import { PrismaClient } from '@prisma/client';

async function main() {
    console.log('--- DB Connection Test ---');
    console.log('DATABASE_URL starts with:', process.env.DATABASE_URL?.substring(0, 40) + '...');
    
    const prisma = new PrismaClient();
    try {
        const user = await prisma.user.findFirst();
        console.log('Successfully connected! Found user:', user ? user.email : 'None');
    } catch (error) {
        console.error('Connection failed!');
        console.error(error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
