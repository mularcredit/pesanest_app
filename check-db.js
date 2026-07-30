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
  
  const branches = await prismaPesa.branch.count({ where: { isActive: true } });
  const categories = await prismaPesa.category.count({ where: { isActive: true } });
  
  console.log(`PesaStack Active Branches: ${branches}`);
  console.log(`PesaStack Active Categories: ${categories}`);
  
  await prismaPesa.$disconnect();
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
