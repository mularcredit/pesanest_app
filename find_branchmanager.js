const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  const users = await prisma.user.findMany({
    where: {
      email: {
        contains: 'branchmanager',
        mode: 'insensitive'
      }
    },
    select: {
      email: true
    }
  })
  console.log('START_MATCHES')
  users.forEach(u => console.log(u.email))
  console.log('END_MATCHES')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
