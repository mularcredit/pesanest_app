const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findUnique({ where: { email: 'admin@payridge.co.ke' } });
  if (!user) return console.log('User not found');
  
  const match = await bcrypt.compare('admin123', user.password);
  console.log(`User: ${user.email} | Match admin123: ${match}`);
}

main().finally(() => prisma.$disconnect());
