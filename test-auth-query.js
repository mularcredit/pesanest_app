const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testAuthorize() {
  console.log("Testing authorize for admin@pesastack.com with DB:", process.env.DATABASE_URL);
  try {
    const user = await prisma.user.findUnique({
      where: { email: 'admin@pesastack.com' },
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
    console.log("User fetched successfully:", user ? "YES" : "NO");
    if (user) {
      console.log("Active status:", user.isActive);
    }
  } catch (err) {
    console.error("Error during fetch:", err.message);
  } finally {
    await prisma.$disconnect();
  }
}

testAuthorize();
