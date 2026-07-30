import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const EXPENSE_CATEGORIES = [
    "Rent",
    "Internet & Connectivity",
    "Airtime & Communication",
    "Fuel Allocation",
    "Hired Bike Payments",
    "Stationery",
    "Office Supplies",
    "Meetings & Conferences",
    "Accommodation",
    "Emergency Field Expenses",
    "Electricity",
    "Fuel",
    "Repairs",
    "Maintenance",
    "ICT Equipment",
    "Furniture",
    "Hardware",
    "Water",
    "Operations",
    "Salaries & Wages",
    "Travel & Transport",
    "Meals & Hospitality",
    "Per Diem / Allowance",
    "Casual Labor",
    "Utilities (Water, Power)",
    "Vehicle Maintenance",
    "Security Services",
    "Permits & Licenses",
    "Marketing & Branding",
    "Software & Subscriptions",
    "Equipment & Repairs",
    "Professional Services",
    "Medical & Welfare",
    "Bank Charges",
    "Other"
];

async function main() {
    console.log('--- Starting Category-to-Account Synchronization ---');

    // 1. Fetch custom categories from DB
    const customCategories = await prisma.customCategory.findMany({
        where: { isActive: true }
    });
    
    const allCategoryNames = Array.from(new Set([
        ...EXPENSE_CATEGORIES,
        ...customCategories.map(c => c.name)
    ]));

    console.log(`Found ${allCategoryNames.length} total categories.`);

    let createdCount = 0;
    let skippedCount = 0;
    let glCodeBase = 6000;

    // Get existing account codes to avoid collisions
    const existingAccounts = await prisma.account.findMany({
        select: { code: true, name: true }
    });
    const existingCodes = new Set(existingAccounts.map(a => a.code));
    const nameToAccount = new Map(existingAccounts.map(a => [a.name.toLowerCase(), a]));

    for (const catName of allCategoryNames) {
        const normalizedName = catName.toLowerCase();
        
        // Skip if account with this name already exists (case-insensitive)
        if (nameToAccount.has(normalizedName)) {
            skippedCount++;
            continue;
        }

        // Find a unique GL code
        while (existingCodes.has(glCodeBase.toString())) {
            glCodeBase++;
        }
        
        const code = glCodeBase.toString();
        
        try {
            await prisma.account.create({
                data: {
                    code: code,
                    name: catName,
                    type: 'EXPENSE',
                    subtype: 'OPERATING_EXPENSE',
                    isActive: true,
                    description: `Automatically created account for category: ${catName}`
                }
            });
            console.log(`Created account: ${code} - ${catName}`);
            existingCodes.add(code);
            createdCount++;
            glCodeBase++;
        } catch (error) {
            console.error(`Failed to create account for ${catName}:`, error);
        }
    }

    console.log('--- Synchronization Complete ---');
    console.log(`Summary: Created ${createdCount}, Skipped ${skippedCount} (already exists)`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
