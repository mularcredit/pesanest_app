import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";

export async function POST(req: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.email) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const user = await prisma.user.findUnique({ where: { email: session.user.email } });
        if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

        const { requisitionItemId, name, frequency, startDate, endDate } = await req.json();

        if (!requisitionItemId || !name || !frequency || !startDate) {
            return NextResponse.json({ error: "Missing required fields: requisitionItemId, name, frequency, startDate" }, { status: 400 });
        }

        const item = await prisma.requisitionItem.findUnique({
            where: { id: requisitionItemId },
            include: { schedule: true },
        });
        if (!item) return NextResponse.json({ error: "Requisition item not found" }, { status: 404 });
        if (item.schedule) return NextResponse.json({ error: "This item already has a schedule" }, { status: 409 });

        const start = new Date(startDate);

        const schedule = await prisma.schedule.create({
            data: {
                name,
                frequency,
                startDate: start,
                endDate: endDate ? new Date(endDate) : undefined,
                nextRun: start,
                requisitionItemId,
                createdById: user.id,
            },
            include: {
                requisitionItem: { include: { requisition: true } },
                createdBy: { select: { id: true, name: true, email: true } },
                executions: { take: 5 },
            },
        });

        return NextResponse.json({ schedule }, { status: 201 });
    } catch (error) {
        console.error("Create schedule error:", error);
        return NextResponse.json({ error: "Failed to create schedule" }, { status: 500 });
    }
}

export async function GET(req: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.email) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
        });

        if (!user) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        const schedules = await prisma.schedule.findMany({
            include: {
                requisitionItem: {
                    include: {
                        requisition: true,
                    }
                },
                createdBy: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                    },
                },
                executions: {
                    orderBy: { scheduledFor: 'desc' },
                    take: 5,
                },
            },
            orderBy: { nextRun: 'asc' },
        });

        return NextResponse.json({ schedules });
    } catch (error) {
        console.error("Get schedules error:", error);
        return NextResponse.json(
            { error: "Failed to fetch schedules" },
            { status: 500 }
        );
    }
}
