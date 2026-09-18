
import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";

// GET: Fetch all accounts
export async function GET(req: Request) {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        const accounts = await prisma.account.findMany({
            orderBy: [
                { code: 'asc' }
            ],
            include: {
                bankAccount: { select: { bankName: true } },
                paystackAccount: { select: { name: true } },
                paybillAccount: { select: { name: true } },
            },
        });

        // The GL account's own name (e.g. "Bank — Figbloom") is often generic —
        // callers like the Manual Journal Entry picker need the everyday name
        // people actually recognize (e.g. "Equity Bank") so it's findable by
        // search and doesn't look unrelated to the same account shown elsewhere
        // (Bank Reconciliation, Transfers) under its bank/provider name.
        const withBankLabel = accounts.map(({ bankAccount, paystackAccount, paybillAccount, ...acc }) => ({
            ...acc,
            bankLabel: bankAccount?.bankName ?? paystackAccount?.name ?? paybillAccount?.name ?? null,
        }));

        return NextResponse.json(withBankLabel);
    } catch (error) {
        return NextResponse.json({ error: "Failed to fetch accounts" }, { status: 500 });
    }
}

// POST: Create new account — controller-level action, requires SYSTEM_ADMIN or system role
export async function POST(req: Request) {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { role: true, customRole: { select: { isSystem: true } } }
    });
    const isAdmin = user?.role === 'SYSTEM_ADMIN' || user?.customRole?.isSystem;
    if (!isAdmin) {
        return NextResponse.json({ error: "Only System Admins can modify the chart of accounts" }, { status: 403 });
    }

    const body = await req.json();

    try {
        const account = await prisma.account.create({
            data: {
                code: body.code,
                name: body.name,
                type: body.type,
                subtype: body.subtype,
                description: body.description
            }
        });
        return NextResponse.json(account);
    } catch (error) {
        return NextResponse.json({ error: "Failed to create account" }, { status: 500 });
    }
}
