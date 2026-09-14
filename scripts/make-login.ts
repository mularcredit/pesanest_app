import { PrismaClient } from '../src/generated/prisma-client'
import { PrismaNeon } from '@prisma/adapter-neon'
import { Pool, neonConfig } from '@neondatabase/serverless'
import bcrypt from 'bcryptjs'

if (typeof WebSocket === 'undefined') {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    neonConfig.webSocketConstructor = require('ws')
}

const prisma = new PrismaClient({ adapter: new PrismaNeon(new Pool({ connectionString: process.env.DATABASE_URL! })) })

async function main() {
    const email = 'etimsdemo@pesanest.dev'   // fresh email — browser has NO saved password for this
    const password = 'Demo2026!'
    const hash = await bcrypt.hash(password, 10)

    const user = await prisma.user.upsert({
        where: { email },
        update: { password: hash, isActive: true, accountStatus: 'ACTIVE', otpExempt: true, failedLoginAttempts: 0, lockedUntil: null, role: 'SYSTEM_ADMIN' },
        create: { email, name: 'eTIMS Demo Admin', password: hash, role: 'SYSTEM_ADMIN', department: 'IT', position: 'Administrator', isActive: true, accountStatus: 'ACTIVE', otpExempt: true },
    })
    console.log('LOGIN READY ->', user.email)
    console.log('PASSWORD ->', password)
    console.log('sanity bcrypt match:', await bcrypt.compare(password, user.password))
}
main().catch(e => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
