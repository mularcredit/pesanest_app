import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function testLogin(email: string, password: string) {
    console.log(`--- Testing login for: ${email} ---`);
    
    const user = await prisma.user.findUnique({
        where: { email },
        include: {
            customRole: {
                include: {
                    permissions: {
                        include: {
                            permission: true
                        }
                    }
                }
            }
        }
    });

    if (!user) {
        console.log("❌ User not found in DB");
        return;
    }

    console.log("✅ User found in DB");
    console.log("Status:", user.accountStatus);
    console.log("IsActive:", user.isActive);
    console.log("Role:", user.role);

    if (user.accountStatus === 'PENDING' || !user.isActive) {
        console.log("❌ User account is PENDING or INACTIVE");
    }

    const passwordsMatch = await bcrypt.compare(password, user.password);
    if (passwordsMatch) {
        console.log("✅ Password matches hash");
    } else {
        console.log("❌ Password DOES NOT match hash");
    }
}

async function main() {
    await testLogin('regionalmanager@pesanest.com', 'RegionalManager123!');
    await testLogin('branchmanager@pesastack.com', 'BranchManager123!');
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
