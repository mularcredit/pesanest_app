
const { PrismaClient } = require('@prisma/client');

async function checkSpecificUser() {
  // Use the PesaStack production DB from earlier
  const url = 'postgresql://postgres:pesastack_password@pesastack-db.flycast:5432/pesastack?sslmode=disable';
  const prisma = new PrismaClient({
    datasources: { db: { url } }
  });

  try {
    const email = 'branchmanager@pesastack.com';
    console.log(`Checking user: ${email}`);
    
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        accountStatus: true,
        password: true // We need to check if it's hashed correctly or if it's the default
      }
    });

    if (!user) {
      console.log('User NOT FOUND in database.');
    } else {
      console.log('User FOUND:');
      console.log(JSON.stringify(user, null, 2));
    }
  } catch (e) {
    console.error('Database error:', e.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkSpecificUser();
