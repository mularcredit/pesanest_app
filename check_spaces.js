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
    console.log(`Email: '${user.email}'`)
    console.log(`Length: ${user.email.length}`)
    // Check for spaces or weirdness
    console.log(`Base trimmed: '${user.email.trim()}'`)
    console.log(`Base trimmed length: ${user.email.trim().length}`)
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
