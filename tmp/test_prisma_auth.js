const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  try {
      const email = "admin@pesastack.com";
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
      })
      console.log('User found:', !!user);
      if (user) {
          console.log('Custom Role:', user.customRole);
      }
  } catch (error) {
      console.error('Prisma Error:', error);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
