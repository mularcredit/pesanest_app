import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Seeding policies...');

    await prisma.policy.deleteMany();

    const policies = [
        {
            name: "Global Spending Limit",
            description: "Flag expenses over $5,000 for review",
            type: "SPENDING_LIMIT",
            rules: JSON.stringify({ maxAmount: 5000, isBlocking: false }), // Warning/Approval only
            isActive: true
        },
        {
            name: "Mandatory Receipts > $50",
            description: "Require receipts for any expense over $50",
            type: "RECEIPT_REQUIREMENT",
            rules: JSON.stringify({ threshold: 50 }),
            isActive: true
        },
        {
            name: "No Weekend Expenses",
            description: "Block expenses incurred on weekends",
            type: "TIME_LIMIT",
            rules: JSON.stringify({ blockWeekends: true }),
            isActive: true
        },
        {
            name: "Blocked Vendors",
            description: "Prevent spending at restricted merchants",
            type: "VENDOR_RESTRICTION",
            rules: JSON.stringify({ blockedVendors: ["Gambling Site", "Unknown Vendor"] }),
            isActive: true
        },
        {
            name: "Travel Approval Needed",
            description: "Route all travel expenses > $200 for special approval",
            type: "APPROVAL_ROUTING",
            rules: JSON.stringify({ minAmount: 200, category: "Travel" }),
            isActive: true
        }
    ];

    for (const p of policies) {
        await prisma.policy.create({ data: p });
    }

    console.log('Policies seeded successfully!');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
