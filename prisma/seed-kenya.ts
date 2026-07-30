import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    console.log('🌍 Seeding Kenya Regions and Branches...')

    // 1. Define Kenya Regions
    const regions = [
        { name: 'Nairobi Region', code: 'NRB' },
        { name: 'Coast Region', code: 'CST' },
        { name: 'Central Region', code: 'CEN' },
        { name: 'Rift Valley Region', code: 'RFT' },
        { name: 'Western Region', code: 'WST' },
        { name: 'Nyanza Region', code: 'NYA' },
        { name: 'Eastern Region', code: 'EST' },
        { name: 'North Eastern Region', code: 'NE' },
    ]

    const regionMap: Record<string, string> = {}

    console.log('Creating regions...')
    for (const r of regions) {
        const region = await prisma.region.upsert({
            where: { code: r.code },
            update: { name: r.name },
            create: r
        })
        regionMap[r.code] = region.id
    }

    // 2. Define Major Towns mapped to Regions
    const branchData = [
        // Nairobi
        { name: 'Nairobi CBD', code: 'KE-NRB-01', regionCode: 'NRB' },
        { name: 'Westlands', code: 'KE-NRB-02', regionCode: 'NRB' },
        { name: 'Karen', code: 'KE-NRB-03', regionCode: 'NRB' },
        { name: 'Eastleigh', code: 'KE-NRB-04', regionCode: 'NRB' },
        
        // Coast
        { name: 'Mombasa', code: 'KE-MBA-01', regionCode: 'CST' },
        { name: 'Malindi', code: 'KE-MLD-01', regionCode: 'CST' },
        { name: 'Diani', code: 'KE-UKN-01', regionCode: 'CST' },
        { name: 'Kilifi', code: 'KE-KLF-01', regionCode: 'CST' },

        // Central
        { name: 'Nyeri', code: 'KE-NYR-01', regionCode: 'CEN' },
        { name: 'Thika', code: 'KE-THK-01', regionCode: 'CEN' },
        { name: 'Kiambu', code: 'KE-KMB-01', regionCode: 'CEN' },
        { name: 'Murang\'a', code: 'KE-MUR-01', regionCode: 'CEN' },

        // Rift Valley
        { name: 'Nakuru', code: 'KE-NAK-01', regionCode: 'RFT' },
        { name: 'Eldoret', code: 'KE-ELD-01', regionCode: 'RFT' },
        { name: 'Naivasha', code: 'KE-NVS-01', regionCode: 'RFT' },
        { name: 'Kitale', code: 'KE-KTL-01', regionCode: 'RFT' },
        { name: 'Kericho', code: 'KE-KRC-01', regionCode: 'RFT' },

        // Western
        { name: 'Kakamega', code: 'KE-KAK-01', regionCode: 'WST' },
        { name: 'Bungoma', code: 'KE-BGM-01', regionCode: 'WST' },
        { name: 'Busia', code: 'KE-BSA-01', regionCode: 'WST' },

        // Nyanza
        { name: 'Kisumu', code: 'KE-KSM-01', regionCode: 'NYA' },
        { name: 'Kisii', code: 'KE-KSI-01', regionCode: 'NYA' },
        { name: 'Homabay', code: 'KE-HMB-01', regionCode: 'NYA' },

        // Eastern
        { name: 'Machakos', code: 'KE-MCK-01', regionCode: 'EST' },
        { name: 'Meru', code: 'KE-MRU-01', regionCode: 'EST' },
        { name: 'Embu', code: 'KE-EMB-01', regionCode: 'EST' },
        { name: 'Kitui', code: 'KE-KTI-01', regionCode: 'EST' },

        // North Eastern
        { name: 'Garissa', code: 'KE-GRS-01', regionCode: 'NE' },
        { name: 'Wajir', code: 'KE-WJR-01', regionCode: 'NE' },
        { name: 'Mandera', code: 'KE-MDR-01', regionCode: 'NE' },
    ]

    console.log('Creating branches and wallets...')
    for (const b of branchData) {
        // Create or update branch
        const branch = await prisma.branch.upsert({
            where: { code: b.code },
            update: {
                name: b.name,
                regionId: regionMap[b.regionCode]
            },
            create: {
                name: b.name,
                code: b.code,
                regionId: regionMap[b.regionCode]
            }
        })

        // Ensure every branch has a wallet
        const existingWallet = await prisma.branchWallet.findUnique({
            where: { branchId: branch.id }
        })

        if (!existingWallet) {
            await prisma.branchWallet.create({
                data: {
                    branchId: branch.id,
                    balance: 0,
                    currency: 'KES' // Use Kenyan Shillings as default for these
                }
            })
        }
    }

    console.log(`✅ Successfully seeded ${regions.length} regions and ${branchData.length} branches.`)
}

main()
    .catch((e) => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
