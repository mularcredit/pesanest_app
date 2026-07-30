import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.email) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const items = await prisma.requisitionItem.findMany({
            where: {
                schedule: null,
            },
            include: {
                requisition: {
                    select: { id: true, currency: true, type: true, branchId: true, status: true },
                },
            },
            orderBy: { title: 'asc' },
        });

        return NextResponse.json({ items });
    } catch (error) {
        console.error("Get schedulable items error:", error);
        return NextResponse.json({ error: "Failed to fetch items" }, { status: 500 });
    }
}
