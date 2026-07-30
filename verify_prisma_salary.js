
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        console.log("Checking Prisma Client connection...");

        // Check if salaryBatch model exists on the client instance
        if (!prisma.salaryBatch) {
            console.error("❌ ERROR: prisma.salaryBatch is undefined. The generated client does not have the new model yet.");
            console.error("Please restart your development server or run `npx prisma generate` again.");
            process.exit(1);
        }

        console.log("✅ prisma.salaryBatch exists on the client.");

        // Try a simple count query
        const count = await prisma.salaryBatch.count();
        console.log(`✅ Database connection successful. Found ${count} existing salary batches.`);

    } catch (e) {
        console.error("❌ Database Error:", e);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

main();
