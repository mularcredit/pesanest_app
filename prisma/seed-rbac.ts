import prisma from '@/lib/prisma';

async function main() {
    console.log('Seeding Permissions and Roles...');

    // 1. Define Exhaustive Permissions
    const resources = [
        { name: 'DASHBOARD', actions: ['VIEW'] },
        { name: 'EXPENSES', actions: ['VIEW_OWN', 'VIEW_TEAM', 'VIEW_ALL', 'CREATE', 'APPROVE', 'PAY', 'REJECT', 'DELETE'] },
        { name: 'REQUISITIONS', actions: ['VIEW_OWN', 'VIEW_TEAM', 'VIEW_ALL', 'CREATE', 'APPROVE', 'REJECT'] },
        { name: 'INVOICES', actions: ['VIEW_ALL', 'CREATE', 'APPROVE', 'PAY', 'REJECT'] },
        { name: 'BUDGETS', actions: ['VIEW_ALL', 'CREATE', 'APPROVE'] },
        { name: 'PAYMENTS', actions: ['VIEW_ALL', 'CREATE_BATCH', 'AUTHORIZE'] }, // CREATE_BATCH=Maker, AUTHORIZE=Checker
        { name: 'USERS', actions: ['VIEW', 'MANAGE', 'INVITE'] },
        { name: 'ROLES', actions: ['VIEW', 'MANAGE'] },
        { name: 'REPORTS', actions: ['VIEW_BASIC', 'VIEW_ADVANCED'] },
        { name: 'SETTINGS', actions: ['MANAGE'] },
    ];

    for (const res of resources) {
        for (const action of res.actions) {
            await prisma.permission.upsert({
                where: { resource_action: { resource: res.name, action: action } },
                update: {},
                create: {
                    resource: res.name,
                    action: action,
                    description: `Allow ${action} on ${res.name}`
                }
            });
        }
    }

    // 2. Define Standard Roles
    // SYSTEM_ADMIN
    const adminRole = await prisma.role.upsert({
        where: { name: 'System Admin' },
        update: {},
        create: { name: 'System Admin', description: 'Full access to everything', isSystem: true }
    });

    // Assign ALL permissions to Admin
    const allPerms = await prisma.permission.findMany();
    for (const perm of allPerms) {
        await prisma.rolePermission.upsert({
            where: { roleId_permissionId: { roleId: adminRole.id, permissionId: perm.id } },
            update: {},
            create: { roleId: adminRole.id, permissionId: perm.id }
        });
    }

    // EMPLOYEE
    const employeeRole = await prisma.role.upsert({
        where: { name: 'Employee' },
        update: {},
        create: { name: 'Employee', description: 'Standard user access', isSystem: true }
    });

    const employeePerms = allPerms.filter(p =>
        (p.resource === 'DASHBOARD' && p.action === 'VIEW') ||
        (p.resource === 'EXPENSES' && ['VIEW_OWN', 'CREATE'].includes(p.action)) ||
        (p.resource === 'REQUISITIONS' && ['VIEW_OWN', 'CREATE'].includes(p.action))
    );

    for (const perm of employeePerms) {
        await prisma.rolePermission.upsert({
            where: { roleId_permissionId: { roleId: employeeRole.id, permissionId: perm.id } },
            update: {},
            create: { roleId: employeeRole.id, permissionId: perm.id }
        });
    }

    // FINANCE_MANAGER (Maker / Approver)
    const financeRole = await prisma.role.upsert({
        where: { name: 'Finance Manager' },
        update: {},
        create: { name: 'Finance Manager', description: 'Can approve expenses and manage payments', isSystem: true }
    });

    const financePerms = allPerms.filter(p =>
        p.resource === 'DASHBOARD' ||
        (p.resource === 'EXPENSES' && p.action !== 'DELETE') ||
        (p.resource === 'INVOICES') ||
        (p.resource === 'PAYMENTS') ||
        (p.resource === 'REPORTS')
    );

    for (const perm of financePerms) {
        await prisma.rolePermission.upsert({
            where: { roleId_permissionId: { roleId: financeRole.id, permissionId: perm.id } },
            update: {},
            create: { roleId: financeRole.id, permissionId: perm.id }
        });
    }

    console.log('Seeding completed.');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
