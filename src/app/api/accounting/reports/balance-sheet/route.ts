
import { auth } from "@/auth";
import { FinancialReports } from "@/lib/accounting/reports";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        const balanceSheet = await FinancialReports.getBalanceSheet();
        return NextResponse.json(balanceSheet);
    } catch (error) {
        return NextResponse.json({ error: "Failed to generate report" }, { status: 500 });
    }
}
