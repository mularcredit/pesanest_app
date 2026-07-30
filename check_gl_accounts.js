const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
    console.log('Checking Ledger Configuration...')

    // Check Accounts
    const cash = await prisma.account.findUnique({ where: { code: '1000' } })
    const ar = await prisma.account.findUnique({ where: { code: '1200' } })

    console.log('GL Account 1000 (Cash):', cash ? '✅ FOUND' : '❌ MISSING')
    console.log('GL Account 1200 (AR):', ar ? '✅ FOUND' : '❌ MISSING')

    if (!cash || !ar) {
        console.log('Seeding missing accounts...')
        if (!cash) {
            await prisma.account.create({
                data: {
                    code: '1000',
                    name: 'Cash & Bank',
                    type: 'ASSET',
                    subtype: 'CURRENT_ASSET',
                    description: 'Main operating bank account'
                }
            })
            console.log('Created Cash Account (1000)')
        }
        if (!ar) {
            await prisma.account.create({
                data: {
                    code: '1200',
                    name: 'Accounts Receivable',
                    type: 'ASSET',
                    subtype: 'CURRENT_ASSET',
                    description: 'Money owed by customers'
                }
            })
            console.log('Created AR Account (1200)')
        }
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
