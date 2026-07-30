const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  const user = await prisma.user.findFirst({
    where: {
      email: {
        contains: 'branchmanager',
        mode: 'insensitive'
      }
    }
  })
  
  if (user) {
    console.log(`Email: ${user.email}`)
    console.log(`Active: ${user.isActive}`)
    console.log(`Status: ${user.accountStatus}`)
  } else {
    console.log('User not found')
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
