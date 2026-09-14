import { PrismaClient } from '../src/generated/prisma-client'
import { PrismaNeon } from '@prisma/adapter-neon'
import { Pool, neonConfig } from '@neondatabase/serverless'
import bcrypt from 'bcryptjs'
if (typeof WebSocket === 'undefined') { neonConfig.webSocketConstructor = require('ws') }
const prisma = new PrismaClient({ adapter: new PrismaNeon(new Pool({ connectionString: process.env.DATABASE_URL! })) })

async function main() {
    const email = 'masteradmin@payridge.co.ke'
    const u: any = await prisma.user.findUnique({ where: { email } })
    if (!u) { console.log('USER NOT FOUND for', email); console.log('emails:', (await prisma.user.findMany({ select: { email: true } })).map((x: any) => x.email)); return }
    console.log('found:', u.email, '| active', u.isActive, '| status', u.accountStatus, '| otpExempt', u.otpExempt, '| lockedUntil', u.lockedUntil, '| failedAttempts', u.failedLoginAttempts)
    console.log("bcrypt 'Admin123!' matches:", await bcrypt.compare('Admin123!', u.password))
    // ensure unlocked/active in case attempts re-locked it
    await prisma.user.update({ where: { email }, data: { failedLoginAttempts: 0, lockedUntil: null, isActive: true, accountStatus: 'ACTIVE', otpExempt: true } })
    console.log('re-unlocked + active')
}
main().catch(e => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
