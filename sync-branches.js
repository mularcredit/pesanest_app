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
  console.log("Loading environment variables...");
  const envCapital = parseEnv('.env');
  const envPesa = parseEnv('.env.pesastack');

  console.log("Connecting to CapitalPay database...");
  process.env.DATABASE_URL = envCapital.DATABASE_URL;
  const prismaCapital = new PrismaClient();
  
  const regions = await prismaCapital.region.findMany({
    include: { branches: true }
  });
  
  console.log(`Found ${regions.length} regions in CapitalPay database.`);
  await prismaCapital.$disconnect();

  console.log("Connecting to PesaStack database...");
  process.env.DATABASE_URL = envPesa.DATABASE_URL;
  const prismaPesa = new PrismaClient();
  
  for (const region of regions) {
    const { id, name, code, isActive, createdAt, updatedAt, branches } = region;
    
    console.log(`Upserting region: ${name} (${code})`);
    await prismaPesa.region.upsert({
      where: { code },
      update: {},
      create: { 
        id, name, code, isActive, createdAt, updatedAt
      }
    });

    for (const branch of branches) {
       const { id: bId, name: bName, code: bCode, address, isActive, createdAt, updatedAt } = branch;
       
       console.log(`  - Upserting branch: ${bName} (${bCode})`);
       await prismaPesa.branch.upsert({
         where: { code: bCode },
         update: {},
         create: {
           id: bId, name: bName, code: bCode, address, regionId: id, isActive, createdAt, updatedAt
         }
       });
       
       const existsWallet = await prismaPesa.branchWallet.findUnique({ where: { branchId: bId } });
       if (!existsWallet) {
           await prismaPesa.branchWallet.create({
              data: {
                  branchId: bId,
                  balance: 0,
                  currency: "USD"
              }
           });
       }
    }
  }

  await prismaPesa.$disconnect();
  console.log("Branches and Regions synced successfully!");
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
