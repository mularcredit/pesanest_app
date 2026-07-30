export const EXPENSE_CATEGORIES_WITH_GROUPS = [
    {
        group: "Fixed Recurring",
        items: ["Rent", "Internet & Connectivity", "Airtime & Communication", "Fuel Allocation", "Hired Bike Payments"]
    },
    {
        group: "Operational",
        items: ["Stationery", "Office Supplies", "Meetings & Conferences", "Accommodation", "Emergency Field Expenses"]
    },
    {
        group: "Petty Cash",
        items: ["Electricity", "Fuel", "Repairs", "Maintenance", "Water"]
    },
    {
        group: "Procurement",
        items: ["ICT Equipment", "Furniture", "Hardware"]
    },
    {
        group: "General / Other",
        items: [
            "Operations", "Salaries & Wages", "Travel & Transport", "Meals & Hospitality", 
            "Per Diem / Allowance", "Casual Labor", "Utilities (Water, Power)", 
            "Vehicle Maintenance", "Security Services", "Permits & Licenses", 
            "Marketing & Branding", "Software & Subscriptions", "Equipment & Repairs", 
            "Professional Services", "Medical & Welfare", "Bank Charges", "Other"
        ]
    }
];

export const EXPENSE_CATEGORIES = EXPENSE_CATEGORIES_WITH_GROUPS.flatMap(g => g.items);

export type ExpenseCategory = typeof EXPENSE_CATEGORIES[number];

// This will be used to get all categories including custom ones
export async function getAllCategories() {
    const prisma = (await import("@/lib/prisma")).default;

    try {
        const customCategories = await (prisma as any).customCategory.findMany({
            where: { isActive: true },
            select: { name: true },
            orderBy: { name: "asc" },
        });

        const customCategoryNames = customCategories.map((c: any) => c.name);

        // Merge built-in and custom categories, removing duplicates
        const allCategories = [...EXPENSE_CATEGORIES, ...customCategoryNames];
        return Array.from(new Set(allCategories));
    } catch (error) {
        console.error("Error fetching custom categories:", error);
        return EXPENSE_CATEGORIES;
    }
}

