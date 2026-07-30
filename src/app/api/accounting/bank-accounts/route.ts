import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";

async function requireAdmin(session: any) {
    if (!session?.user?.id) return false;
    const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { role: true, customRole: { select: { isSystem: true } } }
    });
    return user?.role === 'SYSTEM_ADMIN' || user?.customRole?.isSystem;
}

// GET — list all bank accounts with their GL account and latest statement balance
export async function GET(req: Request) {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        const accounts = await (prisma as any).bankAccount.findMany({
            where: { isActive: true },
            include: {
                glAccount: true,
                statements: {
                    orderBy: { periodEnd: 'desc' },
                    take: 1,
                    select: { periodEnd: true, closingBalance: true }
                }
            },
            orderBy: { name: 'asc' }
        });

        return NextResponse.json(accounts);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// POST — create a bank account, automatically provisioning a dedicated GL sub-account
export async function POST(req: Request) {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await requireAdmin(session))) {
        return NextResponse.json({ error: "Only System Admins can manage bank accounts" }, { status: 403 });
    }

    const body = await req.json();
    const { name, bankName, accountNumber, currency } = body;

    if (!name || !bankName) {
        return NextResponse.json({ error: "name and bankName are required" }, { status: 400 });
    }

    try {
        // Allocate a sequential GL account code in the 1100–1199 range
        const existing = await prisma.account.findMany({
            where: { code: { startsWith: '11' } },
            orderBy: { code: 'desc' },
            take: 1
        });

        const nextCode = existing.length > 0
            ? String(parseInt(existing[0].code) + 1)
            : '1100';

        const bankAccount = await prisma.$transaction(async (tx) => {
            const glAccount = await tx.account.create({
                data: {
                    code: nextCode,
                    name: `Bank — ${name}`,
                    type: 'ASSET',
                    subtype: 'BANK',
                    currency: currency || 'KES',
                    description: `GL sub-account for ${bankName} — ${accountNumber || 'N/A'}`
                }
            });

            return (tx as any).bankAccount.create({
                data: {
                    name,
                    bankName,
                    accountNumber,
                    currency: currency || 'KES',
                    glAccountId: glAccount.id
                },
                include: { glAccount: true }
            });
        });

        await (prisma as any).auditLog.create({
            data: {
                actorId: session.user.id,
                action: 'BANK_ACCOUNT_CREATE',
                entity: 'BankAccount',
                entityId: bankAccount.id,
                after: { name, bankName, accountNumber, glCode: nextCode }
            }
        });

        return NextResponse.json(bankAccount, { status: 201 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
