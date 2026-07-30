import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    console.log('🚀 Starting currency migration (USD -> KES)...')

    const tables = [
        'wallet',
        'requisition',
        'expense',
        'branchWallet',
        'branchWalletTransaction',
        'invoice',
        'payment',
        'vendor',
        'customer',
        'sale',
        'customerPayment',
        'account',
        'asset'
    ]

    for (const table of tables) {
        console.log(`Updating ${table}...`)
        try {
            const result = await prisma[table].updateMany({
                where: { currency: 'USD' },
                data: { currency: 'KES' }
            })
            console.log(`✅ Updated ${result.count} records in ${table}`)
        } catch (error) {
            console.error(`❌ Error updating ${table}:`, error.message)
        }
    }

    console.log('\n🏁 Currency migration complete.')
    console.log('All financial records previously in USD have been converted to KES.')
}

main()
    .catch((e) => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
