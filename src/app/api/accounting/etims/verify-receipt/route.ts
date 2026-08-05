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

        // If an expenseId is provided and verification passed, persist the result.
        // Stamping is a side effect: a missing or non-Expense id must not turn a
        // successful verification into a 500, so failures are reported alongside
        // the verdict instead of replacing it.
        let stamped: boolean | undefined;
        if (expenseId && result.valid) {
            const updated = await prisma.expense.updateMany({
                where: { id: expenseId },
                data: {
                    etrNumber: etrNumber.trim().toUpperCase(),
                    etrVerified: true,
                    etrVerifiedAt: new Date(),
                },
            });
            stamped = updated.count > 0;
        }

        return NextResponse.json(
            stamped === undefined ? result : { ...result, stamped },
            { status: result.valid ? 200 : 400 }
        );
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
