import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { EtimsService } from "@/lib/tax/etims";
import prisma from "@/lib/prisma";

export async function POST(req: Request) {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { etrNumber, expenseId } = body as { etrNumber?: string; expenseId?: string };

    if (!etrNumber) {
        return NextResponse.json({ error: "etrNumber is required" }, { status: 400 });
    }

    try {
        const result = await EtimsService.verifyVendorReceipt(etrNumber);

        // If an expenseId is provided and verification passed, persist the result
        if (expenseId && result.valid) {
            await prisma.expense.update({
                where: { id: expenseId },
                data: {
                    etrNumber: etrNumber.trim().toUpperCase(),
                    etrVerified: true,
                    etrVerifiedAt: new Date(),
                },
            });
        }

        return NextResponse.json(result, { status: result.valid ? 200 : 400 });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
