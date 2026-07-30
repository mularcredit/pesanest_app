
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
    console.log("Creating Limited Admin role...");

    // 1. Get all available permissions
    const permissions = await prisma.permission.findMany();
    console.log(`Found ${permissions.length} permissions.`);

    // 2. Define the role data
    const roleName = "Limited Admin";
    const roleDescription = "Full access with approval limit of $100";
    const maxApprovalLimit = 100;

    // 3. Create or Update the role
    const role = await prisma.role.upsert({
        where: { name: roleName },
        update: {
            description: roleDescription,
            maxApprovalLimit: maxApprovalLimit,
            // Clear existing permissions to re-add all
            permissions: {
                deleteMany: {},
                create: permissions.map((p) => ({
                    permission: { connect: { id: p.id } },
                })),
            },
        },
        create: {
            name: roleName,
            description: roleDescription,
            maxApprovalLimit: maxApprovalLimit,
            isSystem: false,
            permissions: {
                create: permissions.map((p) => ({
                    permission: { connect: { id: p.id } },
                })),
            },
        },
    });

    console.log(`Role '${role.name}' created/updated with ID: ${role.id}`);
    console.log(`Approval Limit: $${role.maxApprovalLimit}`);
    console.log(`Permissions assigned: ${permissions.length}`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
