const fs = require('fs');
let file = 'src/app/actions/finance-studio.ts';
let code = fs.readFileSync(file, 'utf8');

const regex = /export async function getSSCAAStatementData[\s\S]*?\n\s*\n/g;
code = code.replace(regex, '');

fs.writeFileSync(file, code);
