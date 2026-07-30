#!/usr/bin/env node
// Syncs the Prisma schema to the database without requiring migration history.
// Uses db push so missing columns/tables are created regardless of _prisma_migrations state.
const { execSync } = require('child_process');

console.log('Syncing database schema...');
execSync('npx prisma db push --skip-generate --accept-data-loss', { stdio: 'inherit' });
console.log('Schema sync complete.');
