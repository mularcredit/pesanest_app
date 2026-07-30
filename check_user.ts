import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const email = 'branchmanager@pesastack.com'
  console.log(`Checking user: ${email}`)
  
  const user = await prisma.user.findUnique({
    where: { email },
  })
  
  if (!user) {
    console.log('User not found')
  } else {
    console.log('User found:')
    console.log(`ID: ${user.id}`)
    console.log(`Name: ${user.name}`)
    console.log(`Is Active: ${user.isActive}`)
    console.log(`Account Status: ${user.accountStatus}`)
    console.log(`Password Hash: ${user.password}`)
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
