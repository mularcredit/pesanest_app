import { auth } from "@/auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { DimensionReportClient } from "./DimensionReportClient";

export const dynamic = 'force-dynamic';

export default async function DimensionReportPage() {
    const session = await auth();
    if (!session?.user) return redirect("/login");

    const costCentres = await (prisma as any).costCentre.findMany({
        where: { isActive: true },
        orderBy: { code: 'asc' }
    });

    return (
        <div className="space-y-6 animate-fade-in-up">
            <div>
                <h1 className="text-2xl font-semibold text-gray-900">Cost Centre Report</h1>
                <p className="text-gray-500 text-sm mt-1">P&L analysis segmented by cost centre dimension</p>
            </div>
            <DimensionReportClient costCentres={costCentres} />
        </div>
    );
}
