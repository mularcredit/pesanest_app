import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    try {
        const customerCount = await prisma.customer.count()
        console.log('Successfully accessed customer model. Count:', customerCount)
    } catch (error) {
        console.error('Error accessing customer model:', error)
    } finally {
        await prisma.$disconnect()
    }
}

main()
