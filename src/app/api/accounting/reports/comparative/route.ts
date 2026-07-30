/**
 * GET /api/accounting/reports/comparative
 *
 * Two-period comparative P&L or Balance Sheet.
 *
 * Query params:
 *   reportType  = PL | BS              (default: PL)
 *   p1Start     = YYYY-MM-DD           (required for PL)
 *   p1End       = YYYY-MM-DD           (required)
 *   p2Start     = YYYY-MM-DD           (required for PL)
 *   p2End       = YYYY-MM-DD           (required)
 *   p1Label     = string               (optional display label)
 *   p2Label     = string               (optional display label)
 */

import { auth } from "@/auth";
import { FinancialReports } from "@/lib/accounting/reports";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const reportType = (searchParams.get('reportType') || 'PL').toUpperCase() as 'PL' | 'BS';
    const p1End   = searchParams.get('p1End');
    const p2End   = searchParams.get('p2End');

    if (!p1End || !p2End) {
        return NextResponse.json({ error: "p1End and p2End are required" }, { status: 400 });
    }

    const p1Start = searchParams.get('p1Start') || new Date(new Date(p1End).getFullYear(), 0, 1).toISOString().slice(0, 10);
    const p2Start = searchParams.get('p2Start') || new Date(new Date(p2End).getFullYear(), 0, 1).toISOString().slice(0, 10);

    try {
        const result = await FinancialReports.getComparative(
            { start: new Date(p1Start), end: new Date(p1End), label: searchParams.get('p1Label') || undefined },
            { start: new Date(p2Start), end: new Date(p2End), label: searchParams.get('p2Label') || undefined },
            reportType
        );
        return NextResponse.json(result);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
