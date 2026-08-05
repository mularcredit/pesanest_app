import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
const locations = require('kenya-locations')

const prisma = new PrismaClient()

async function main() {
    console.log('🌱 Seeding database with East African context...')

    // Cleanup existing data for clean demo
    await prisma.invoiceLineItem.deleteMany({})
    await prisma.saleItem.deleteMany({})

    await prisma.expense.deleteMany({})
    await prisma.budgetItem.deleteMany({})
    await prisma.monthlyBudget.deleteMany({})
    await prisma.requisitionItem.deleteMany({})
    await prisma.requisition.deleteMany({})
    await prisma.walletTransaction.deleteMany({})

    // AR Cleanup
    await prisma.customerPayment.deleteMany({})
    await prisma.sale.deleteMany({})
    await prisma.customer.deleteMany({})

    // AP Cleanup
    await prisma.itemApproval.deleteMany({})
    await prisma.approval.deleteMany({})
    await prisma.invoiceLineItem.deleteMany({})
    await prisma.invoice.deleteMany({}) // Vendor Invoices
    await prisma.payment.deleteMany({}) // Vendor Payments
    await prisma.vendor.deleteMany({})

    await prisma.wallet.deleteMany({})
    await prisma.wallet.deleteMany({})
    await prisma.user.deleteMany({})

    // Regional Cleanup
    await prisma.branchWalletTransaction.deleteMany({})
    await prisma.branchWallet.deleteMany({})
    await prisma.branch.deleteMany({})
    await prisma.region.deleteMany({})

    // GL Cleanup
    await prisma.journalLine.deleteMany({})
    await prisma.journalEntry.deleteMany({})
    await prisma.account.deleteMany({})

    // Create admin user (Kenyan HQ context)
    const adminPassword = await bcrypt.hash('admin123', 10)
    const admin = await prisma.user.create({
        data: {
            email: 'admin@payridge.co.ke',
            name: 'System Administrator',
            password: adminPassword,
            role: 'SYSTEM_ADMIN',
            department: 'IT',
            position: 'Head of IT',
            isActive: true,
            accountStatus: 'ACTIVE',
        },
    })

    // Create finance user (South Sudan Ops)
    const financePassword = await bcrypt.hash('finance123', 10)
    const finance = await prisma.user.create({
        data: {
            email: 'chol@payridge.ss',
            name: 'Chol Deng',
            password: financePassword,
            role: 'FINANCE_APPROVER',
            department: 'Finance',
            position: 'Finance Manager',
            isActive: true,
            accountStatus: 'ACTIVE',
        },
    })

    // Create manager (Nairobi Sales)
    const managerPassword = await bcrypt.hash('manager123', 10)
    const manager = await prisma.user.create({
        data: {
            email: 'wanjiku@payridge.co.ke',
            name: 'Wanjiku Kimani',
            password: managerPassword,
            role: 'MANAGER',
            department: 'Sales',
            position: 'Canal Sales Lead',
            isActive: true,
            accountStatus: 'ACTIVE',
        },
    })

    // Create employee (Field Rep in Juba)
    const employeePassword = await bcrypt.hash('employee123', 10)
    const employee = await prisma.user.create({
        data: {
            email: 'juma@payridge.ss',
            name: 'Juma Alier',
            password: employeePassword,
            role: 'EMPLOYEE',
            department: 'Sales',
            position: 'Field Representative',
            managerId: manager.id,
            bankAccount: 'USD-88293-Equity',
            phoneNumber: '+211 920 123 456',
            isActive: true,
            accountStatus: 'ACTIVE',
        },
    })

    // Create wallets (Clean slate)
    await prisma.wallet.create({ data: { userId: admin.id, balance: 0.00, currency: 'KES' } })
    await prisma.wallet.create({ data: { userId: finance.id, balance: 0.00, currency: 'KES' } })
    await prisma.wallet.create({ data: { userId: manager.id, balance: 0.00, currency: 'KES' } })
    const employeeWallet = await prisma.wallet.create({
        data: { userId: employee.id, balance: 0.00, currency: 'KES' }
    })

    // Wallet Transactions
    // DELETED SEED DATA

    // ============================================================================
    // RBAC: PERMISSIONS & ROLES
    // ============================================================================
    console.log('Seeding RBAC System...')

    // 1. Define All Permissions
    const permissionsList = [
        // User Management
        { resource: 'USERS', action: 'VIEW', description: 'View user list' },
        { resource: 'USERS', action: 'CREATE', description: 'Create new users' },
        { resource: 'USERS', action: 'EDIT', description: 'Edit user details' },
        { resource: 'USERS', action: 'DELETE', description: 'Deactivate users' },
        { resource: 'USERS', action: 'MANAGE', description: 'Full user management (create, edit, deactivate)' },

        // Roles
        { resource: 'ROLES', action: 'MANAGE', description: 'Manage roles and permissions' },

        // Accounting Module (broad access)
        { resource: 'ACCOUNTING', action: 'VIEW', description: 'Access the accounting module' },

        // Finance & Ledger
        { resource: 'GL', action: 'VIEW', description: 'View General Ledger' },
        { resource: 'GL', action: 'MANAGE', description: 'Manage Chart of Accounts and Journal Entries' },
        { resource: 'LEDGER', action: 'VIEW', description: 'View ledger entries and journal history' },
        { resource: 'REPORTS', action: 'VIEW', description: 'View financial reports (trial balance, P&L, etc.)' },
        { resource: 'PAYABLES', action: 'VIEW', description: 'View accounts payable' },

        // Invoices & Payments
        { resource: 'INVOICES', action: 'VIEW', description: 'View vendor invoices' },
        { resource: 'INVOICES', action: 'CREATE', description: 'Create/upload vendor invoices' },
        { resource: 'INVOICES', action: 'MANAGE', description: 'Full invoice management (create, edit, void)' },
        { resource: 'INVOICES', action: 'APPROVE', description: 'Approve vendor invoices' },
        { resource: 'PAYMENTS', action: 'CREATE', description: 'Initiate payments' },
        { resource: 'PAYMENTS', action: 'APPROVE', description: 'Approve payments' },

        // Sales & Customers
        { resource: 'CUSTOMERS', action: 'VIEW', description: 'View customer list' },
        { resource: 'CUSTOMERS', action: 'MANAGE', description: 'Create and manage customers' },
        { resource: 'SALES', action: 'MANAGE', description: 'Create and send customer invoices' },

        // Expenses & Approvals
        { resource: 'EXPENSES', action: 'VIEW_ALL', description: 'View all company expenses' },
        { resource: 'EXPENSES', action: 'VIEW_TEAM', description: 'View team expenses' },
        { resource: 'EXPENSES', action: 'APPROVE', description: 'Approve expense requests' },
        { resource: 'REQUISITIONS', action: 'APPROVE', description: 'Approve requisition requests' },
        { resource: 'REQUISITIONS', action: 'VIEW_BRANCH', description: 'View branch-level requisitions' },
        { resource: 'APPROVALS', action: 'VIEW', description: 'View approval queue' },

        // Finance Dashboards
        { resource: 'WALLET', action: 'VIEW', description: 'View treasury/wallet balances' },
        { resource: 'FINANCE', action: 'VIEW', description: 'View financial dashboards and summaries' },
        { resource: 'BUDGETS', action: 'VIEW', description: 'View budget plans' },
        { resource: 'FORECASTING', action: 'VIEW', description: 'View financial forecasts' },
        { resource: 'STUDIO', action: 'VIEW', description: 'Access finance studio' },
        { resource: 'ANALYTICS', action: 'VIEW', description: 'View analytics and workflow reports' },
        { resource: 'PETTY_CASH', action: 'VIEW', description: 'View the petty cash float and ledger' },
        { resource: 'PETTY_CASH', action: 'MANAGE', description: 'Replenish, pay out and reconcile petty cash' },
        { resource: 'TRANSFERS', action: 'VIEW', description: 'View bank, mobile and paybill transfers' },
        { resource: 'TRANSFERS', action: 'MANAGE', description: 'Record and update transfers' },

        // Vendors & Procurement
        { resource: 'VENDORS', action: 'VIEW', description: 'View vendor list' },
        { resource: 'CONTRACTS', action: 'VIEW', description: 'View contracts' },
        { resource: 'ASSETS', action: 'VIEW', description: 'View company assets register' },

        // Branches & Regions
        { resource: 'BRANCHES', action: 'VIEW', description: 'View branches' },
        { resource: 'BRANCHES', action: 'MANAGE', description: 'Create and manage branches' },
        { resource: 'REGIONS', action: 'VIEW', description: 'View regions' },

        // System
        { resource: 'SETTINGS', action: 'MANAGE', description: 'Manage system settings' },
        { resource: 'IMPORT', action: 'MANAGE', description: 'Manage data imports' },
        { resource: 'POLICIES', action: 'VIEW', description: 'View company policies' },
        { resource: 'POLICIES', action: 'MANAGE', description: 'Create and manage policies' },
        { resource: 'AUDIT', action: 'VIEW', description: 'View audit logs' },
    ]

    const createdPermissions: Record<string, string> = {} // Map: resource_action -> id

    for (const p of permissionsList) {
        const perm = await prisma.permission.upsert({
            where: {
                resource_action: {
                    resource: p.resource,
                    action: p.action
                }
            },
            update: {},
            create: p
        })
        createdPermissions[`${p.resource}_${p.action}`] = perm.id
    }

    // 2. Define Default Roles
    const rolesList = [
        {
            name: 'System Administrator',
            description: 'Full access to all system features',
            isSystem: true,
            permissions: Object.keys(createdPermissions) // All permissions
        },
        {
            name: 'Finance Manager',
            description: 'Oversees all financial operations, approvals, and reporting',
            isSystem: true,
            permissions: [
                'ACCOUNTING_VIEW',
                'GL_VIEW', 'GL_MANAGE',
                'LEDGER_VIEW', 'REPORTS_VIEW', 'PAYABLES_VIEW',
                'INVOICES_VIEW', 'INVOICES_MANAGE', 'INVOICES_CREATE', 'INVOICES_APPROVE',
                'PAYMENTS_CREATE', 'PAYMENTS_APPROVE',
                'CUSTOMERS_VIEW', 'CUSTOMERS_MANAGE', 'SALES_MANAGE',
                'EXPENSES_VIEW_ALL', 'EXPENSES_APPROVE',
                'REQUISITIONS_APPROVE', 'REQUISITIONS_VIEW_BRANCH', 'APPROVALS_VIEW',
                'WALLET_VIEW', 'FINANCE_VIEW', 'BUDGETS_VIEW', 'FORECASTING_VIEW',
                'PETTY_CASH_VIEW', 'PETTY_CASH_MANAGE',
                'TRANSFERS_VIEW', 'TRANSFERS_MANAGE',
                'VENDORS_VIEW', 'CONTRACTS_VIEW', 'ASSETS_VIEW',
                'BRANCHES_VIEW', 'REGIONS_VIEW',
                'USERS_VIEW', 'AUDIT_VIEW', 'ANALYTICS_VIEW',
            ]
        },
        {
            name: 'Accountant',
            description: 'Day-to-day accounting, bookkeeping, and invoice processing',
            isSystem: false,
            permissions: [
                'ACCOUNTING_VIEW',
                'GL_VIEW', 'GL_MANAGE',
                'LEDGER_VIEW', 'REPORTS_VIEW', 'PAYABLES_VIEW',
                'INVOICES_VIEW', 'INVOICES_CREATE', 'INVOICES_MANAGE',
                'PAYMENTS_CREATE',
                'CUSTOMERS_VIEW', 'CUSTOMERS_MANAGE', 'SALES_MANAGE',
                'EXPENSES_VIEW_ALL', 'APPROVALS_VIEW',
                'PETTY_CASH_VIEW', 'PETTY_CASH_MANAGE',
                'TRANSFERS_VIEW', 'TRANSFERS_MANAGE',
                'VENDORS_VIEW', 'ASSETS_VIEW',
                'AUDIT_VIEW',
            ]
        },
        {
            name: 'Employee',
            description: 'Standard access for expense submission and personal tasks',
            isSystem: true,
            permissions: [] // Basic access is implied/not gated by special permissions
        }
    ]

    for (const r of rolesList) {
        // Create Role
        const role = await prisma.role.upsert({
            where: { name: r.name },
            update: {},
            create: {
                name: r.name,
                description: r.description,
                isSystem: r.isSystem
            }
        })

        // Assign Permissions
        if (r.permissions.length > 0) {
            // First clear existing to avoid duplicates on re-seed
            await prisma.rolePermission.deleteMany({ where: { roleId: role.id } })

            const data = r.permissions
                .map(key => ({
                    roleId: role.id,
                    permissionId: createdPermissions[key]
                }))
                .filter(item => item.permissionId) // Ensure ID exists

            if (data.length > 0) {
                await prisma.rolePermission.createMany({ data })
            }
        }
    }

    // ============================================================================
    // CHART OF ACCOUNTS (GENERAL LEDGER)
    // ============================================================================
    console.log('Creating Chart of Accounts...')

    // 1. Assets
    await prisma.account.create({
        data: {
            code: '1000',
            name: 'Cash & Bank',
            type: 'ASSET',
            subtype: 'CURRENT_ASSET',
            description: 'Main operating bank account'
        }
    })

    await prisma.account.create({
        data: {
            code: '1200',
            name: 'Accounts Receivable',
            type: 'ASSET',
            subtype: 'CURRENT_ASSET',
            description: 'Money owed by customers'
        }
    })

    // 2. Liabilities
    await prisma.account.create({
        data: {
            code: '2000',
            name: 'Accounts Payable',
            type: 'LIABILITY',
            subtype: 'CURRENT_LIABILITY',
            description: 'Money owed to vendors'
        }
    })

    // 3. Equity
    await prisma.account.create({
        data: {
            code: '3000',
            name: 'Retained Earnings',
            type: 'EQUITY',
            description: 'Accumulated profits/losses'
        }
    })

    // 4. Revenue
    await prisma.account.create({
        data: {
            code: '4000',
            name: 'Sales Revenue',
            type: 'REVENUE',
            description: 'Income from sales'
        }
    })

    await prisma.account.create({
        data: {
            code: '4100',
            name: 'Sales Returns',
            type: 'REVENUE',
            subtype: 'CONTRA_REVENUE',
            description: 'Refunds and returns'
        }
    })

    // 5. Expenses
    await prisma.account.create({
        data: {
            code: '6000',
            name: 'Operating Expenses',
            type: 'EXPENSE',
            description: 'General operating expenses'
        }
    })

    // Categories
    const categories = [
        { name: 'Travel', description: 'Flights, Visa fees, Airport transfers' },
        { name: 'Accommodation', description: 'Hotels and guesthouses' },
        { name: 'Meals & Entertainment', description: 'Client dinners, per diem' },
        { name: 'Logistics', description: 'Courier, freight, transport' },
        { name: 'Communication', description: 'Airtime, Internet bundles' },
        { name: 'Permits & Licenses', description: 'Government levies and permits' },
    ]

    for (const cat of categories) {
        await prisma.category.upsert({
            where: { name: cat.name },
            update: {},
            create: cat,
        })
    }

    // Requisitions
    await prisma.requisition.create({
        data: {
            userId: employee.id,
            title: 'Q1 South Sudan Market Activation',
            description: 'Roadshow materials and logistics for Juba/Nimule corridor',
            amount: 5000.00,
            currency: 'KES',
            category: 'Logistics',
            businessJustification: 'Expand market share in Equatoria region',
            status: 'PENDING',
        },
    })

    // Expenses
    // DELETED SEED DATA

    // 2. Hotel
    // DELETED SEED DATA

    // 3. Dinner
    // DELETED SEED DATA

    // 4. Internet
    // DELETED SEED DATA

    // ============================================================================
    // REGIONS AND BRANCHES (Exhaustive Kenyan Coverage)
    // ============================================================================
    console.log('Seeding Exhaustive Kenyan Company Structure (47 Counties, 300+ Sub-counties)...')

    const counties = locations.getCounties()
    const subCounties = locations.getSubCounties()

    let nairobiHqId = '';

    // 1. Create Regions (Counties)
    const regionMap: Record<string, string> = {} // Name -> ID

    for (const c of counties) {
        const region = await prisma.region.create({
            data: {
                name: `${c.name} County`,
                code: c.code,
            }
        })
        regionMap[c.name] = region.id
    }

    // 2. Create Branches (Sub-Counties)
    for (const sc of subCounties) {
        const branch = await prisma.branch.create({
            data: {
                name: sc.name,
                code: `${sc.code.padStart(3, '0')}-${sc.name.toUpperCase().replace(/\s+/g, '').substring(0, 5)}`,
                regionId: regionMap[sc.county],
            }
        })
        
        // Pick first Nairobi sub-county as HQ for test accounts
        if (sc.county === 'Nairobi' && !nairobiHqId) {
            nairobiHqId = branch.id;
        }
    }

    // Default Fallback
    if (!nairobiHqId) {
        const anyBranch = await prisma.branch.findFirst();
        nairobiHqId = anyBranch?.id || '';
    }

    // Update main users with branches
    await prisma.user.update({
        where: { id: admin.id },
        data: { branchId: nairobiHqId }
    })

    await prisma.user.update({
        where: { id: manager.id },
        data: { branchId: nairobiHqId }
    })

    // Vendors
    await prisma.vendor.create({
        data: {
            name: 'Kenya Airways',
            legalName: 'Kenya Airways Ltd',
            category: 'Travel',
            isPreferred: true,
            isActive: true,
        },
    })

    await prisma.vendor.create({
        data: {
            name: 'Pyramid Continental',
            legalName: 'Pyramid Hotels Group',
            category: 'Accommodation',
            isPreferred: true,
            isActive: true,
        },
    })

    // Customers (East Africa)
    console.log('Creating Regional Customers...')

    // Customers (East Africa)
    console.log('Skipping Customer creation to allow clean slate.')
    // DELETED SEED DATA: KCB Group, WFP, Sales, Payments.


    console.log('✅ East African Context Seeded Successfully!')
    console.log('\n📧 New Regional Test Accounts:')
    console.log('Admin (KE): admin@payridge.co.ke / admin123')
    console.log('Finance (SS): chol@payridge.ss / finance123')
    console.log('Manager (KE): wanjiku@payridge.co.ke / manager123')
    console.log('Employee (SS): juma@payridge.ss / employee123')
}

main()
    .catch((e) => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
