const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({ select: { email: true, password: true, accountStatus: true, isActive: true, role: true, customRoleId: true } });
  
  for (const user of users) {
    // no filter
    const match1 = await bcrypt.compare('Admin@123', user.password);
    const match2 = await bcrypt.compare('admin123', user.password);
    console.log(`User: ${user.email} | Match Admin@123: ${match1} | Match admin123: ${match2} | Status: ${user.accountStatus} | Active: ${user.isActive} | Role: ${user.role} | CustomRoleId: ${user.customRoleId}`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
