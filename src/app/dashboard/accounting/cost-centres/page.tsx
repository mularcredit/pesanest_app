import { auth } from "@/auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { CostCentresClient } from "./CostCentresClient";

export const dynamic = 'force-dynamic';

export default async function CostCentresPage() {
    const session = await auth();
    if (!session?.user) return redirect("/login");

    const costCentres = await (prisma as any).costCentre.findMany({
        orderBy: { code: 'asc' },
        include: { _count: { select: { lines: true } } }
    });

    return (
        <div className="space-y-6 animate-fade-in-up">
            <div>
                <h1 className="text-2xl font-semibold text-gray-900">Cost Centres</h1>
                <p className="text-gray-500 text-sm mt-1">Dimension tags for P&L analysis by branch or department</p>
            </div>
            <CostCentresClient costCentres={costCentres} />
        </div>
    );
}
