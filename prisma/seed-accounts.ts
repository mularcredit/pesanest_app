
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Seeding Chart of Accounts...');

    const accounts = [
        // ASSETS (1000-1999)
        { code: '1000', name: 'Cash on Hand', type: 'ASSET', subtype: 'CURRENT_ASSET' },
        { code: '1010', name: 'Petty Cash', type: 'ASSET', subtype: 'CURRENT_ASSET' },
        { code: '1020', name: 'Bank Account - USD (Equity)', type: 'ASSET', subtype: 'CURRENT_ASSET' },
        { code: '1200', name: 'Accounts Receivable', type: 'ASSET', subtype: 'CURRENT_ASSET' },
        { code: '1500', name: 'Office Equipment', type: 'ASSET', subtype: 'FIXED_ASSET' },

        // LIABILITIES (2000-2999)
        { code: '2000', name: 'Accounts Payable', type: 'LIABILITY', subtype: 'CURRENT_LIABILITY' },
        { code: '2100', name: 'VAT Payable', type: 'LIABILITY', subtype: 'CURRENT_LIABILITY' },
        { code: '2200', name: 'Payroll Liabilities', type: 'LIABILITY', subtype: 'CURRENT_LIABILITY' },

        // EQUITY (3000-3999)
        { code: '3000', name: 'Owner\'s Equity', type: 'EQUITY', subtype: 'EQUITY' },
        { code: '3100', name: 'Retained Earnings', type: 'EQUITY', subtype: 'EQUITY' },

        // REVENUE (4000-4999)
        { code: '4000', name: 'Sales Revenue', type: 'REVENUE', subtype: 'OPERATING_REVENUE' },
        { code: '4100', name: 'Service Income', type: 'REVENUE', subtype: 'OPERATING_REVENUE' },
        { code: '4200', name: 'Other Income', type: 'REVENUE', subtype: 'NON_OPERATING_REVENUE' },

        // EXPENSES (5000-5999)
        { code: '5000', name: 'Cost of Goods Sold', type: 'EXPENSE', subtype: 'COGS' },
        { code: '6000', name: 'Salaries & Wages', type: 'EXPENSE', subtype: 'OPERATING_EXPENSE' },
        { code: '6010', name: 'Rent Expense', type: 'EXPENSE', subtype: 'OPERATING_EXPENSE' },
        { code: '6020', name: 'Utilities', type: 'EXPENSE', subtype: 'OPERATING_EXPENSE' },
        { code: '6030', name: 'Travel & Accommodation', type: 'EXPENSE', subtype: 'OPERATING_EXPENSE' },
        { code: '6040', name: 'Office Supplies', type: 'EXPENSE', subtype: 'OPERATING_EXPENSE' },
        { code: '6050', name: 'Professional Fees', type: 'EXPENSE', subtype: 'OPERATING_EXPENSE' },
        { code: '6100', name: 'Bank Charges', type: 'EXPENSE', subtype: 'OPERATING_EXPENSE' },
    ];

    for (const acc of accounts) {
        await prisma.account.upsert({
            where: { code: acc.code },
            update: {},
            create: acc,
        });
    }

    console.log('Chart of Accounts seeded successfully.');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
