import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const vendors = await prisma.vendor.findMany({
    where: {
      OR: [
        { name: { contains: 'Saudi Arabian Airlines', mode: 'insensitive' } },
        { name: { contains: 'FLY Deal', mode: 'insensitive' } }
      ]
    }
  })

  const customers = await prisma.customer.findMany({
    where: {
      OR: [
        { name: { contains: 'Saudi Arabian Airlines', mode: 'insensitive' } },
        { name: { contains: 'FLY Deal', mode: 'insensitive' } }
      ]
    }
  })

  console.log('--- VENDORS FOUND ---')
  console.log(JSON.stringify(vendors, null, 2))
  
  console.log('\n--- CUSTOMERS FOUND ---')
  console.log(JSON.stringify(customers, null, 2))
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
