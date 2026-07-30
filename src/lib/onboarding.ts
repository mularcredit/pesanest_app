'use server';

import prisma from '@/lib/prisma';

/**
 * Check if the system has been properly set up
 * Returns setup status and missing components
 */
export async function checkSystemSetup() {
    try {
        // 1. Check Chart of Accounts
        const accountCount = await prisma.account.count();
        const hasChartOfAccounts = accountCount >= 7; // Minimum 7 core accounts

        // Check for essential accounts
        const essentialAccounts = await prisma.account.findMany({
            where: {
                code: {
                    in: ['1000', '1200', '2000', '3000', '4000', '4100', '6000']
                }
            }
        });

        const missingAccounts = [];
        const requiredAccounts = [
            { code: '1000', name: 'Cash & Bank', type: 'ASSET' },
            { code: '1200', name: 'Accounts Receivable', type: 'ASSET' },
            { code: '2000', name: 'Accounts Payable', type: 'LIABILITY' },
            { code: '3000', name: 'Retained Earnings', type: 'EQUITY' },
            { code: '4000', name: 'Sales Revenue', type: 'REVENUE' },
            { code: '4100', name: 'Sales Returns', type: 'REVENUE' },
            { code: '6000', name: 'Operating Expenses', type: 'EXPENSE' }
        ];

        for (const required of requiredAccounts) {
            const exists = essentialAccounts.find(acc => acc.code === required.code);
            if (!exists) {
                missingAccounts.push(required);
            }
        }

        // 2. Check if any customers exist
        const customerCount = await prisma.customer.count();
        const hasCustomers = customerCount > 0;

        // 3. Check if any vendors exist
        const vendorCount = await prisma.vendor.count();
        const hasVendors = vendorCount > 0;

        // 4. Check if any transactions exist
        const journalEntryCount = await prisma.journalEntry.count();
        const hasTransactions = journalEntryCount > 0;

        return {
            isSetupComplete: hasChartOfAccounts && missingAccounts.length === 0,
            chartOfAccounts: {
                isComplete: hasChartOfAccounts && missingAccounts.length === 0,
                accountCount,
                missingAccounts
            },
            hasCustomers,
            hasVendors,
            hasTransactions,
            setupProgress: calculateSetupProgress({
                hasChartOfAccounts: hasChartOfAccounts && missingAccounts.length === 0,
                hasCustomers,
                hasVendors,
                hasTransactions
            })
        };
    } catch (error) {
        console.error('Error checking system setup:', error);
        return {
            isSetupComplete: false,
            chartOfAccounts: {
                isComplete: false,
                accountCount: 0,
                missingAccounts: []
            },
            hasCustomers: false,
            hasVendors: false,
            hasTransactions: false,
            setupProgress: 0
        };
    }
}

function calculateSetupProgress(status: {
    hasChartOfAccounts: boolean;
    hasCustomers: boolean;
    hasVendors: boolean;
    hasTransactions: boolean;
}) {
    let progress = 0;
    if (status.hasChartOfAccounts) progress += 40; // Most important
    if (status.hasCustomers) progress += 20;
    if (status.hasVendors) progress += 20;
    if (status.hasTransactions) progress += 20;
    return progress;
}

/**
 * Auto-create standard Chart of Accounts
 */
export async function createStandardChartOfAccounts() {
    try {
        const standardAccounts = [
            // Assets
            { code: '1000', name: 'Cash & Bank', type: 'ASSET', subtype: 'CURRENT_ASSET', description: 'Main operating bank account' },
            { code: '1100', name: 'Petty Cash', type: 'ASSET', subtype: 'CURRENT_ASSET', description: 'Cash on hand for small expenses' },
            { code: '1200', name: 'Accounts Receivable', type: 'ASSET', subtype: 'CURRENT_ASSET', description: 'Money owed by customers' },
            { code: '1300', name: 'Inventory', type: 'ASSET', subtype: 'CURRENT_ASSET', description: 'Goods for sale' },
            { code: '1500', name: 'Prepaid Expenses', type: 'ASSET', subtype: 'CURRENT_ASSET', description: 'Expenses paid in advance' },
            { code: '1700', name: 'Fixed Assets', type: 'ASSET', subtype: 'FIXED_ASSET', description: 'Property, plant, and equipment' },
            { code: '1750', name: 'Accumulated Depreciation', type: 'ASSET', subtype: 'FIXED_ASSET', description: 'Contra-asset for depreciation' },

            // Liabilities
            { code: '2000', name: 'Accounts Payable', type: 'LIABILITY', subtype: 'CURRENT_LIABILITY', description: 'Money owed to vendors' },
            { code: '2100', name: 'Accrued Expenses', type: 'LIABILITY', subtype: 'CURRENT_LIABILITY', description: 'Expenses incurred but not yet paid' },
            { code: '2200', name: 'Unearned Revenue', type: 'LIABILITY', subtype: 'CURRENT_LIABILITY', description: 'Advance payments from customers' },
            { code: '2500', name: 'Long-term Debt', type: 'LIABILITY', subtype: 'LONG_TERM_LIABILITY', description: 'Loans and bonds payable' },

            // Equity
            { code: '3000', name: 'Retained Earnings', type: 'EQUITY', description: 'Accumulated profits/losses' },
            { code: '3100', name: 'Owner\'s Capital', type: 'EQUITY', description: 'Owner investments' },
            { code: '3200', name: 'Drawings', type: 'EQUITY', description: 'Owner withdrawals' },

            // Revenue
            { code: '4000', name: 'Sales Revenue', type: 'REVENUE', description: 'Income from sales' },
            { code: '4100', name: 'Sales Returns', type: 'REVENUE', subtype: 'CONTRA_REVENUE', description: 'Refunds and returns' },
            { code: '4500', name: 'Interest Income', type: 'REVENUE', description: 'Interest earned on bank accounts' },
            { code: '4600', name: 'Other Income', type: 'REVENUE', description: 'Miscellaneous income' },

            // Expenses
            { code: '6000', name: 'Operating Expenses', type: 'EXPENSE', description: 'General operating expenses' },
            { code: '6100', name: 'Bank Fees', type: 'EXPENSE', description: 'Bank charges and fees' },
            { code: '6200', name: 'Office Supplies', type: 'EXPENSE', description: 'Stationery and office materials' },
            { code: '6300', name: 'Utilities', type: 'EXPENSE', description: 'Electricity, water, internet' },
            { code: '6400', name: 'Rent Expense', type: 'EXPENSE', description: 'Office rent' },
            { code: '6500', name: 'Salaries & Wages', type: 'EXPENSE', description: 'Employee compensation' },
            { code: '6600', name: 'Professional Fees', type: 'EXPENSE', description: 'Legal, accounting, consulting' },
            { code: '6700', name: 'Travel & Entertainment', type: 'EXPENSE', description: 'Business travel and meals' },
            { code: '6800', name: 'Depreciation Expense', type: 'EXPENSE', description: 'Asset depreciation' },
            { code: '6900', name: 'Insurance', type: 'EXPENSE', description: 'Business insurance premiums' },
        ];

        // Check which accounts already exist
        const existingCodes = await prisma.account.findMany({
            select: { code: true }
        });
        const existingCodesSet = new Set(existingCodes.map(a => a.code));

        // Create only missing accounts
        const accountsToCreate = standardAccounts.filter(
            acc => !existingCodesSet.has(acc.code)
        );

        if (accountsToCreate.length > 0) {
            await prisma.account.createMany({
                data: accountsToCreate,
                skipDuplicates: true
            });
        }

        return {
            success: true,
            created: accountsToCreate.length,
            total: standardAccounts.length
        };
    } catch (error) {
        console.error('Error creating standard chart of accounts:', error);
        return {
            success: false,
            error: 'Failed to create accounts'
        };
    }
}
