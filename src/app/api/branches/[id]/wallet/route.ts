import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";

// GET /api/branches/[id]/wallet — get branch wallet balance and transactions
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const resolvedParams = await params;

    const wallet = await prisma.branchWallet.findUnique({
        where: { branchId: resolvedParams.id },
        include: {
            transactions: { orderBy: { createdAt: "desc" }, take: 100 },
            branch: { select: { name: true, code: true } }
        }
    });

    if (!wallet) return NextResponse.json({ error: "Wallet not found" }, { status: 404 });

    return NextResponse.json({ wallet });
}
