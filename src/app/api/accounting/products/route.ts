import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { EtimsService } from "@/lib/tax/etims";

// POST /api/accounting/products — register a new item with KRA eTIMS (saveItem)
export async function POST(req: Request) {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const name = (body.name || "").toString().trim();
    const unitPrice = Number(body.unitPrice);
    const taxTyCd = body.taxTyCd || "B";

    if (!name) return NextResponse.json({ error: "Item name is required" }, { status: 400 });
    if (!unitPrice || unitPrice <= 0) return NextResponse.json({ error: "A valid unit price is required" }, { status: 400 });

    try {
        const result = await EtimsService.registerItem({ name, unitPrice, taxTyCd });
        return NextResponse.json(result, { status: result.success ? 200 : 400 });
    } catch (err: any) {
        return NextResponse.json({ error: err.message || "Failed to register item" }, { status: 500 });
    }
}
