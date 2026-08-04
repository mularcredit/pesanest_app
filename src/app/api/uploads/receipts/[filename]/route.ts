import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";

const receiptStore = prisma as unknown as {
    uploadedReceipt: {
        findUnique: (args: { where: { id: string } }) => Promise<{
            filename: string;
            contentType: string;
            data: Uint8Array;
        } | null>;
    };
};

export async function GET(_request: NextRequest, { params }: { params: Promise<{ filename: string }> }) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { filename } = await params;
    if (!/^[a-zA-Z0-9._-]+$/.test(filename)) {
        return NextResponse.json({ error: "Invalid filename" }, { status: 400 });
    }

    try {
        const receipt = await receiptStore.uploadedReceipt.findUnique({ where: { id: filename } });
        if (!receipt) return NextResponse.json({ error: "Receipt not found" }, { status: 404 });

        return new NextResponse(receipt.data, {
            headers: {
                "Content-Type": receipt.contentType || "application/octet-stream",
                "Content-Disposition": `inline; filename="${receipt.filename}"`,
            },
        });
    } catch {
        return NextResponse.json({ error: "Receipt not found" }, { status: 404 });
    }
}
