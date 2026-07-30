import { NextResponse } from "next/server";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";

// All permissions the system actually uses.
// Upsert-safe: running this multiple times is harmless.
const ALL_PERMISSIONS = [
    // User Management
    { resource: 'USERS', action: 'VIEW', description: 'View user list' },
    { resource: 'USERS', action: 'CREATE', description: 'Create new users' },
    { resource: 'USERS', action: 'EDIT', description: 'Edit user details' },
    { resource: 'USERS', action: 'DELETE', description: 'Deactivate users' },
    { resource: 'USERS', action: 'MANAGE', description: 'Full user management' },

    // Roles
    { resource: 'ROLES', action: 'MANAGE', description: 'Manage roles and permissions' },

    // Accounting module
    { resource: 'ACCOUNTING', action: 'VIEW', description: 'Access the accounting module' },
    { resource: 'GL', action: 'VIEW', description: 'View general ledger' },
    { resource: 'GL', action: 'MANAGE', description: 'Manage chart of accounts and journal entries' },
    { resource: 'LEDGER', action: 'VIEW', description: 'View ledger entries and journal history' },
    { resource: 'REPORTS', action: 'VIEW', description: 'View financial reports' },
    { resource: 'PAYABLES', action: 'VIEW', description: 'View accounts payable' },

    // Invoices & Payments
    { resource: 'INVOICES', action: 'VIEW', description: 'View vendor invoices' },
    { resource: 'INVOICES', action: 'CREATE', description: 'Create/upload vendor invoices' },
    { resource: 'INVOICES', action: 'MANAGE', description: 'Full invoice management' },
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

    // Finance dashboards
    { resource: 'WALLET', action: 'VIEW', description: 'View treasury/wallet balances' },
    { resource: 'FINANCE', action: 'VIEW', description: 'View financial dashboards' },
    { resource: 'BUDGETS', action: 'VIEW', description: 'View budget plans' },
    { resource: 'FORECASTING', action: 'VIEW', description: 'View financial forecasts' },
    { resource: 'STUDIO', action: 'VIEW', description: 'Access finance studio' },
    { resource: 'ANALYTICS', action: 'VIEW', description: 'View analytics and workflow reports' },

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
];

export async function GET() { return syncHandler(); }
export async function POST() { return syncHandler(); }

async function syncHandler() {
    const session = await auth();
    if ((session?.user as any)?.role !== 'SYSTEM_ADMIN') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    let added = 0;
    let existing = 0;

    for (const p of ALL_PERMISSIONS) {
        const result = await (prisma.permission as any).upsert({
            where: { resource_action: { resource: p.resource, action: p.action } },
            update: { description: p.description },
            create: p,
        });
        // If createdAt === updatedAt it was just inserted; otherwise it existed
        const wasCreated = result.createdAt.getTime() === result.updatedAt.getTime();
        wasCreated ? added++ : existing++;
    }

    return NextResponse.json({
        ok: true,
        added,
        existing,
        total: ALL_PERMISSIONS.length,
        message: `Sync complete. ${added} new permissions added, ${existing} already existed.`,
    });
}
