import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    console.log('✈️ Seeding Airlines as Customers...')

    const airlines = [
        { name: "Ethiopian Airlines", country: "Ethiopia", city: "Addis Ababa" },
        { name: "Emirates", country: "UAE", city: "Dubai" },
        { name: "Qatar Airways", country: "Qatar", city: "Doha" },
        { name: "FlyDubai", country: "UAE", city: "Dubai" },
        { name: "Kenya Airways", country: "Kenya", city: "Nairobi" },
        { name: "Turkish Airlines", country: "Turkey", city: "Istanbul" },
        { name: "EgyptAir", country: "Egypt", city: "Cairo" },
        { name: "Flyadeal", country: "Saudi Arabia", city: "Jeddah" },
        { name: "Saudi Arabian Airlines", country: "Saudi Arabia", city: "Jeddah" },
        { name: "RwandAir", country: "Rwanda", city: "Kigali" },
        { name: "Uganda Airlines", country: "Uganda", city: "Entebbe" },
        { name: "Tarco Aviation", country: "Sudan", city: "Khartoum" },
        { name: "Badr Airlines", country: "Sudan", city: "Khartoum" },
        { name: "Sudan Airways", country: "Sudan", city: "Khartoum" },
        { name: "Air Arabia", country: "UAE", city: "Sharjah" },
        { name: "Lufthansa", country: "Germany", city: "Frankfurt" },
        { name: "KLM Royal Dutch Airlines", country: "Netherlands", city: "Amsterdam" },
        { name: "Air France", country: "France", city: "Paris" },
        { name: "British Airways", country: "UK", city: "London" },
        { name: "South African Airways", country: "South Africa", city: "Johannesburg" }
    ]

    for (const airline of airlines) {
        await prisma.customer.upsert({
            where: {
                // Since name isn't unique in schema but used for lookup, we'll try to find first. 
                // But upsert requires a unique constraint. 
                // Let's assume we can finding by ID or just createMany if we don't care about dupes.
                // However, `name` typically should be unique for customers in practice.
                // For this script, let's use check-then-create to avoid unique constraint errors if name isn't @unique in schema.
                id: "placeholder"
            },
            update: {},
            create: {
                name: airline.name,
                country: airline.country,
                city: airline.city,
                address: `Headquarters, ${airline.city}`,
                currency: 'USD',
                contactPerson: 'Finance Department',
                email: `finance@${airline.name.toLowerCase().replace(/\s/g, '')}.com`,
                phone: '+123456789'
            }
        }).catch(async (e) => {
            // Fallback since 'id' won't match "placeholder" and we can't reliably upsert without unique name.
            // We'll just check if it exists by name.
            const existing = await prisma.customer.findFirst({
                where: { name: airline.name }
            });

            if (!existing) {
                await prisma.customer.create({
                    data: {
                        name: airline.name,
                        country: airline.country,
                        city: airline.city,
                        address: `Headquarters, ${airline.city}`,
                        currency: 'USD',
                        contactPerson: 'Finance Department',
                        email: `finance@${airline.name.toLowerCase().replace(/\s/g, '')}.com`,
                        phone: '+123456789'
                    }
                });
                console.log(`+ Created ${airline.name}`);
            } else {
                console.log(`- Skipped ${airline.name} (Already exists)`);
            }
        });
    }

    console.log('✅ Airlines seeded successfully!')
}

main()
    .catch((e) => {
        console.error(e)
        // process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
