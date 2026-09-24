import { PrismaClient } from '@/generated/prisma-client'
import { PrismaNeon } from '@prisma/adapter-neon'
import { Pool, neonConfig } from '@neondatabase/serverless'

// Use WebSockets in Node.js so wss:// (port 443) is used instead of TCP port 5432.
// This works on all networks, including those that block port 5432.
if (typeof WebSocket === 'undefined') {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    neonConfig.webSocketConstructor = require('ws')
}

// Roles that may read anything but must never be able to write — enforced
// here, at the DB client itself, rather than per-route/action, so it can't
// be bypassed by a route or server action that forgets its own permission
// check. This matters: several existing routes/actions check nothing at
// all beyond "is logged in" (some, like createAsset, don't even call
// auth()), so this can't rely on the caller having resolved a session —
// it resolves one itself, fresh, on every mutating call.
const READ_ONLY_ROLES = new Set(['MASTER_VIEWER'])

// Covers both model-level mutations and raw SQL writes — $allOperations at
// this top level (not nested under $allModels) receives every operation,
// model-scoped or not, so one hook is enough for both.
const MUTATING_OPERATIONS = new Set([
    'create', 'createMany', 'createManyAndReturn',
    'update', 'updateMany', 'updateManyAndReturn',
    'upsert',
    'delete', 'deleteMany',
    '$executeRaw', '$executeRawUnsafe',
])

async function assertWritable() {
    // Dynamic import: src/auth.ts imports this file (for its own prisma
    // calls), so a static import here would be circular. Resolved lazily,
    // after both modules have already finished loading, this isn't.
    const { auth } = await import('@/auth')
    const session = await auth().catch(() => null)
    const role = (session?.user as any)?.role
    if (role && READ_ONLY_ROLES.has(role)) {
        throw new Error('Your account has read-only access and cannot make changes.')
    }
}

const prismaClientSingleton = () => {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL! })
    const adapter = new PrismaNeon(pool)
    return new PrismaClient({ adapter, log: ['error', 'warn'] }).$extends({
        name: 'read-only-role-guard',
        query: {
            async $allOperations({ operation, args, query }) {
                if (MUTATING_OPERATIONS.has(operation)) await assertWritable()
                return query(args)
            },
        },
    })
}

declare global {
    var prismaGlobal: undefined | ReturnType<typeof prismaClientSingleton>
}

const prisma = globalThis.prismaGlobal ?? prismaClientSingleton()

export default prisma

if (process.env.NODE_ENV !== 'production') globalThis.prismaGlobal = prisma

