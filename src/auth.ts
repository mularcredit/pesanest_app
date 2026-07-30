import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import prisma from "@/lib/prisma"
import bcrypt from "bcryptjs"
import { z } from "zod"
import { totp as totpUtil } from "@/lib/totp"

const LOCKOUT_THRESHOLD = 5;  // failed attempts before lockout
const LOCKOUT_MINUTES = 15;

async function recordLoginEvent(params: {
    userId?: string; email: string; success: boolean;
    ipAddress?: string; userAgent?: string; reason?: string;
}) {
    try {
        await (prisma as any).loginEvent.create({ data: params });
    } catch {
        console.error('[LoginEvent] Failed to record login event');
    }
}

// Centralised legacy role → permissions map (used in both authorize and session callbacks)
const LEGACY_PERMISSIONS: Record<string, string[]> = {
    'SYSTEM_ADMIN': ['*'],
    'FINANCE_APPROVER': [
        'EXPENSES.VIEW_ALL', 'EXPENSES.APPROVE',
        'INVOICES.VIEW_ALL', 'INVOICES.VIEW', 'INVOICES.APPROVE',
        'PAYMENTS.AUTHORIZE',
        'ACCOUNTING.VIEW', 'LEDGER.VIEW', 'REPORTS.VIEW',
        'APPROVALS.VIEW', 'REQUISITIONS.APPROVE',
        'WALLET.VIEW', 'FINANCE.VIEW', 'BUDGETS.VIEW',
        'FORECASTING.VIEW', 'AUDIT.VIEW', 'ANALYTICS.VIEW',
        'VENDORS.VIEW', 'CONTRACTS.VIEW', 'ASSETS.VIEW',
        'BRANCHES.VIEW', 'REGIONS.VIEW',
    ],
    'FINANCE_TEAM': [
        'EXPENSES.VIEW_ALL',
        'INVOICES.VIEW_ALL', 'INVOICES.VIEW', 'INVOICES.CREATE',
        'PAYMENTS.CREATE_BATCH',
        'ACCOUNTING.VIEW', 'LEDGER.VIEW', 'REPORTS.VIEW',
        'APPROVALS.VIEW', 'REQUISITIONS.APPROVE',
        'WALLET.VIEW', 'FINANCE.VIEW', 'BUDGETS.VIEW',
        'FORECASTING.VIEW', 'AUDIT.VIEW', 'ANALYTICS.VIEW',
        'VENDORS.VIEW', 'CONTRACTS.VIEW', 'ASSETS.VIEW',
        'SALES.MANAGE',
    ],
    'MANAGER': [
        'EXPENSES.VIEW_TEAM', 'EXPENSES.APPROVE',
        'INVOICES.VIEW', 'INVOICES.VIEW_ALL',
        'REQUISITIONS.VIEW_TEAM', 'REQUISITIONS.APPROVE',
        'APPROVALS.VIEW',
        'WALLET.VIEW', 'BUDGETS.VIEW', 'AUDIT.VIEW',
        'VENDORS.VIEW', 'CONTRACTS.VIEW', 'ASSETS.VIEW',
    ],
    'REGIONAL_MANAGER': [
        'REQUISITIONS.VIEW_BRANCH', 'REQUISITIONS.APPROVE',
        'APPROVALS.VIEW',
        'BRANCHES.VIEW', 'REGIONS.VIEW',
        'BRANCH_WALLET.VIEW',
        'ANALYTICS.VIEW', 'REPORTS.VIEW',
        'EXPENSES.VIEW_TEAM',
    ],
    'TEAM_LEADER': [
        'REQUISITIONS.CREATE', 'REQUISITIONS.VIEW_OWN',
        'EXPENSES.VIEW_OWN', 'EXPENSES.CREATE',
        'BRANCH_WALLET.VIEW', 'BRANCH_WALLET.DISBURSE',
        'VENDORS.VIEW',
    ],
    'EMPLOYEE': [
        'EXPENSES.VIEW_OWN', 'EXPENSES.CREATE',
        'REQUISITIONS.VIEW_OWN', 'REQUISITIONS.CREATE',
    ],
};

export const { handlers, signIn, signOut, auth } = NextAuth({
    trustHost: true,
    providers: [
        Credentials({
            async authorize(credentials, request) {
                const ipAddress = (request as any)?.headers?.get?.('x-forwarded-for') || undefined;
                const userAgent = (request as any)?.headers?.get?.('user-agent') || undefined;

                const parsedCredentials = z
                    .object({ email: z.string().email(), password: z.string().min(6), totp: z.string().optional() })
                    .safeParse(credentials)

                if (parsedCredentials.success) {
                    const { email, password, totp } = parsedCredentials.data

                    // Fetch user with Custom Role and Permissions
                    const user = await prisma.user.findUnique({
                        where: { email },
                        include: {
                            customRole: {
                                include: {
                                    permissions: {
                                        include: {
                                            permission: true
                                        }
                                    }
                                }
                            }
                        }
                    }) as any

                    if (!user) {
                        await recordLoginEvent({ email, success: false, ipAddress, userAgent, reason: 'USER_NOT_FOUND' });
                        return null
                    }

                    // Account lockout check
                    if (user.lockedUntil && new Date(user.lockedUntil) > new Date()) {
                        await recordLoginEvent({ userId: user.id, email, success: false, ipAddress, userAgent, reason: 'ACCOUNT_LOCKED' });
                        return null;
                    }

                    if (user.accountStatus === 'PENDING' || !user.isActive) {
                        await recordLoginEvent({ userId: user.id, email, success: false, ipAddress, userAgent, reason: 'ACCOUNT_INACTIVE' });
                        return null;
                    }

                    const passwordsMatch = await bcrypt.compare(password, user.password)
                    if (!passwordsMatch) {
                        // Increment failed attempts — wrapped in try/catch for DB column compatibility
                        try {
                            const attempts = (user.failedLoginAttempts || 0) + 1;
                            const lockout = attempts >= LOCKOUT_THRESHOLD
                                ? { lockedUntil: new Date(Date.now() + LOCKOUT_MINUTES * 60_000) }
                                : {};
                            await (prisma.user.update as any)({
                                where: { id: user.id },
                                data: { failedLoginAttempts: attempts, ...lockout }
                            });
                        } catch {}
                        await recordLoginEvent({ userId: user.id, email, success: false, ipAddress, userAgent, reason: 'WRONG_PASSWORD' });
                        return null;
                    }

                    // TOTP check if enabled
                    if (user.totpEnabled) {
                        if (!totp) {
                            await recordLoginEvent({ userId: user.id, email, success: false, ipAddress, userAgent, reason: 'TOTP_REQUIRED' });
                            return null;
                        }
                        const validTotp = totpUtil.verify({ token: totp, secret: user.totpSecret });
                        if (!validTotp) {
                            await recordLoginEvent({ userId: user.id, email, success: false, ipAddress, userAgent, reason: 'WRONG_TOTP' });
                            return null;
                        }
                    }

                    // Reset failed attempts on successful login — wrapped for DB column compatibility
                    try {
                        await (prisma.user.update as any)({
                            where: { id: user.id },
                            data: { failedLoginAttempts: 0, lockedUntil: null }
                        });
                    } catch {}
                    await recordLoginEvent({ userId: user.id, email, success: true, ipAddress, userAgent });

                    let permissions: string[] = [];
                    if (user.customRole) {
                        permissions = user.customRole.permissions.map((rp: any) =>
                            `${rp.permission.resource}.${rp.permission.action}`
                        );
                    } else {
                        permissions = LEGACY_PERMISSIONS[user.role] || [];
                    }

                    return { ...user, permissions };
                } else {
                    await recordLoginEvent({ email: (credentials?.email as string) || '', success: false, reason: 'INVALID_FORMAT' });
                }

                return null
            },
        }),
    ],
    secret: process.env.AUTH_SECRET,
    callbacks: {
        async jwt({ token, user, trigger }) {
            if (user) {
                token.role = (user as any).role;
                token.id = user.id;
                token.permissions = (user as any).permissions || [];
                token.customRoleId = (user as any).customRoleId;
            }
            // When the client calls update(), re-fetch permissions from DB so the
            // JWT cookie is refreshed and useSession() sees the new permissions immediately.
            if (trigger === 'update' && token.id) {
                try {
                    const dbUser = await prisma.user.findUnique({
                        where: { id: token.id as string },
                        include: {
                            customRole: {
                                include: { permissions: { include: { permission: true } } }
                            }
                        }
                    });
                    if (dbUser?.customRole) {
                        token.permissions = dbUser.customRole.permissions.map(
                            (rp: any) => `${rp.permission.resource}.${rp.permission.action}`
                        );
                    } else {
                        token.permissions = LEGACY_PERMISSIONS[(token.role as string)] || [];
                    }
                } catch {}
            }
            return token;
        },
        async session({ session, token }) {
            if (token && session.user) {
                (session.user as any).role = token.role;
                (session.user as any).id = token.id;
                (session.user as any).customRoleId = token.customRoleId;

                // Re-fetch permissions live from DB so admin role changes apply immediately
                // without requiring the user to log out and back in
                try {
                    const dbUser = await prisma.user.findUnique({
                        where: { id: token.id as string },
                        include: {
                            customRole: {
                                include: {
                                    permissions: { include: { permission: true } }
                                }
                            }
                        }
                    });

                    if (dbUser?.customRole) {
                        (session.user as any).permissions = dbUser.customRole.permissions.map(
                            rp => `${rp.permission.resource}.${rp.permission.action}`
                        );
                    } else {
                        // Fallback to legacy role permissions
                        (session.user as any).permissions = LEGACY_PERMISSIONS[(token.role as string)] || [];
                    }
                } catch {
                    // Fallback to token permissions if DB is unavailable
                    (session.user as any).permissions = token.permissions || [];
                }
            }
            return session;
        },
    },
    pages: {
        signIn: "/login",
    },
})
