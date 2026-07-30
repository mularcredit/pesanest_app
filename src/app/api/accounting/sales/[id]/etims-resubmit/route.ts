import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";
import { EtimsService } from "@/lib/tax/etims";

export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { role: true, customRole: { select: { isSystem: true } } }
    });
    const isAdmin = user?.role === 'SYSTEM_ADMIN' || user?.customRole?.isSystem;
    const isFinance = user?.role === 'FINANCE_APPROVER' || user?.role === 'FINANCE_TEAM';
    if (!isAdmin && !isFinance) {
        return NextResponse.json({ error: "Finance role required" }, { status: 403 });
    }

    const { id } = await props.params;

    const sale = await prisma.sale.findUnique({ where: { id } });
    if (!sale) return NextResponse.json({ error: "Sale not found" }, { status: 404 });

    if (sale.etimsStatus === 'ACCEPTED') {
        return NextResponse.json({ error: "Invoice already accepted by KRA — resubmission not allowed" }, { status: 409 });
    }

    try {
        const result = await EtimsService.resubmitInvoice(id);
        return NextResponse.json(result, { status: result.success ? 200 : 400 });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
