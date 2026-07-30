import { PrismaClient } from '@/generated/prisma-client'
import { PrismaNeon } from '@prisma/adapter-neon'
import { Pool, neonConfig } from '@neondatabase/serverless'

// Use WebSockets in Node.js so wss:// (port 443) is used instead of TCP port 5432.
// This works on all networks, including those that block port 5432.
if (typeof WebSocket === 'undefined') {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    neonConfig.webSocketConstructor = require('ws')
}

const prismaClientSingleton = () => {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL! })
    const adapter = new PrismaNeon(pool)
    return new PrismaClient({ adapter, log: ['error', 'warn'] })
}

declare global {
    var prismaGlobal: undefined | ReturnType<typeof prismaClientSingleton>
}

const prisma = globalThis.prismaGlobal ?? prismaClientSingleton()

export default prisma

if (process.env.NODE_ENV !== 'production') globalThis.prismaGlobal = prisma

