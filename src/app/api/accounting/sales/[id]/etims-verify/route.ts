import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { EtimsService } from "@/lib/tax/etims";

export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await props.params;

    try {
        const result = await EtimsService.verifyInvoice(id);
        return NextResponse.json(result, { status: result.valid ? 200 : 400 });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
