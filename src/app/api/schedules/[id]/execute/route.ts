import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";

function calculateNextRun(currentNextRun: Date, frequency: string): Date {
    const next = new Date(currentNextRun);
    switch (frequency) {
        case 'DAILY':   next.setDate(next.getDate() + 1); break;
        case 'WEEKLY':  next.setDate(next.getDate() + 7); break;
        case 'MONTHLY': next.setMonth(next.getMonth() + 1); break;
        case 'QUARTERLY': next.setMonth(next.getMonth() + 3); break;
        case 'YEARLY':  next.setFullYear(next.getFullYear() + 1); break;
    }
    return next;
}

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth();
        if (!session?.user?.email) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
            select: { id: true, branchId: true },
        });

        if (!user) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        const { id } = await params;

        const schedule = await prisma.schedule.findUnique({
            where: { id },
            include: {
                requisitionItem: {
                    include: {
                        requisition: true,
                    }
                }
            },
        });

        if (!schedule) {
            return NextResponse.json({ error: "Schedule not found" }, { status: 404 });
        }

        if (!schedule.isActive) {
            return NextResponse.json({ error: "Schedule is inactive" }, { status: 400 });
        }

        // Check if end date has passed
        if (schedule.endDate && new Date() > schedule.endDate) {
            await prisma.schedule.update({
                where: { id },
                data: { isActive: false },
            });
            return NextResponse.json({ error: "Schedule has expired (end date passed)" }, { status: 400 });
        }

        if (!schedule.requisitionItem || !schedule.requisitionItem.requisition) {
            return NextResponse.json({ error: "Schedule is missing parent requisition or item" }, { status: 400 });
        }

        const item = schedule.requisitionItem;
        const parentReq = item.requisition;

        // Create the new Requisition based on the parent
        const requisition = await prisma.requisition.create({
            data: {
                title: `[Auto] ${schedule.name}`,
                description: `Auto-generated from schedule: ${schedule.name}`,
                amount: item.totalPrice,
                currency: parentReq.currency,
                category: item.category,
                businessJustification: `Recurring ${schedule.frequency.toLowerCase()} requisition item - manual run from schedule "${schedule.name}"`,
                expectedDate: schedule.nextRun,
                type: parentReq.type,
                status: "PENDING",
                userId: parentReq.userId,
                branchId: parentReq.branchId,
                department: parentReq.department,
                items: {
                    create: [{
                        title: item.title,
                        description: item.description,
                        category: item.category,
                        quantity: item.quantity,
                        unitPrice: item.unitPrice,
                        totalPrice: item.totalPrice,
                    }]
                }
            },
        });

        // Record the execution
        const execution = await prisma.scheduleExecution.create({
            data: {
                scheduleId: schedule.id,
                scheduledFor: schedule.nextRun,
                executedAt: new Date(),
                status: "EXECUTED",
                entityType: "Requisition",
                entityId: requisition.id,
            },
        });

        // Advance the next run date
        const newNextRun = calculateNextRun(schedule.nextRun, schedule.frequency);

        await prisma.schedule.update({
            where: { id },
            data: { nextRun: newNextRun },
        });

        return NextResponse.json({
            message: "Schedule executed successfully",
            requisition,
            execution,
            nextRun: newNextRun,
        });

    } catch (error) {
        console.error("Execute schedule error:", error);
        return NextResponse.json(
            { error: "Failed to execute schedule" },
            { status: 500 }
        );
    }
}
