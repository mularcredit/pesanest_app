const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

function parseEnv(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  let result = {};
  content.split('\n').forEach(line => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      let key = match[1];
      let value = match[2] || '';
      if (value.startsWith('"') && value.endsWith('"')) {
        value = value.slice(1, -1);
      } else if (value.startsWith("'") && value.endsWith("'")) {
        value = value.slice(1, -1);
      }
      result[key] = value;
    }
  });
  return result;
}

async function main() {
  const envPesa = parseEnv('.env.pesastack');
  process.env.DATABASE_URL = envPesa.DATABASE_URL;
  const prismaPesa = new PrismaClient();
  
  const categories = [
    { name: 'Travel', description: 'Flights, Visa fees, Airport transfers' },
    { name: 'Accommodation', description: 'Hotels and guesthouses' },
    { name: 'Meals & Entertainment', description: 'Client dinners, per diem' },
    { name: 'Logistics', description: 'Courier, freight, transport' },
    { name: 'Communication', description: 'Airtime, Internet bundles' },
    { name: 'Permits & Licenses', description: 'Government levies and permits' },
  ];

  console.log('🌱 Seeding PesaStack categories...');
  for (const cat of categories) {
    await prismaPesa.category.upsert({
      where: { name: cat.name },
      update: {},
      create: cat,
    });
  }
  
  console.log('✅ Categories seeded successfully!');
  await prismaPesa.$disconnect();
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
