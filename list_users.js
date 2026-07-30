const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  const users = await prisma.user.findMany({
    select: {
      email: true,
      isActive: true,
      accountStatus: true
    }
  })
  console.log('--- USER LIST ---')
  console.log(JSON.stringify(users, null, 2))
  console.log('-----------------')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
