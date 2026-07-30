/**
 * GET /api/accounting/reports/profit-loss?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
 *
 * Profit & Loss statement for a date range.
 * Defaults to current calendar year if no dates supplied.
 */

import { auth } from "@/auth";
import { FinancialReports } from "@/lib/accounting/reports";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const now = new Date();
    const startDate = searchParams.get('startDate')
        ? new Date(searchParams.get('startDate')!)
        : new Date(now.getFullYear(), 0, 1);
    const endDate = searchParams.get('endDate')
        ? new Date(searchParams.get('endDate')!)
        : now;

    try {
        const report = await FinancialReports.getProfitAndLoss(startDate, endDate);
        return NextResponse.json(report);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
