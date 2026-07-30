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

// POST /api/schedules/process - processes all overdue schedules
export async function POST(req: NextRequest) {
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

        const now = new Date();

        // Find all active schedules that are due
        const dueSchedules = await prisma.schedule.findMany({
            where: {
                isActive: true,
                nextRun: { lte: now },
                OR: [
                    { endDate: null },
                    { endDate: { gte: now } },
                ],
            },
            include: {
                requisitionItem: {
                    include: {
                        requisition: true,
                    }
                }
            },
        });

        if (dueSchedules.length === 0) {
            return NextResponse.json({
                message: "No schedules due for processing",
                processed: 0,
                results: [],
            });
        }

        const results = [];

        for (const schedule of dueSchedules) {
            try {
                if (!schedule.requisitionItem || !schedule.requisitionItem.requisition) {
                    throw new Error("Schedule is missing parent requisition or item");
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
                        businessJustification: `Recurring ${schedule.frequency.toLowerCase()} requisition item - auto-generated from schedule "${schedule.name}"`,
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
                await prisma.scheduleExecution.create({
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
                    where: { id: schedule.id },
                    data: { nextRun: newNextRun },
                });

                results.push({
                    scheduleId: schedule.id,
                    scheduleName: schedule.name,
                    status: "success",
                    requisitionId: requisition.id,
                    nextRun: newNextRun,
                });

            } catch (err: any) {
                // Record failed execution
                await prisma.scheduleExecution.create({
                    data: {
                        scheduleId: schedule.id,
                        scheduledFor: schedule.nextRun,
                        executedAt: new Date(),
                        status: "FAILED",
                        errorMessage: err?.message ?? "Unknown error",
                    },
                });

                results.push({
                    scheduleId: schedule.id,
                    scheduleName: schedule.name,
                    status: "failed",
                    error: err?.message,
                });
            }
        }

        return NextResponse.json({
            message: `Processed ${dueSchedules.length} schedule(s)`,
            processed: dueSchedules.length,
            results,
        });

    } catch (error) {
        console.error("Process schedules error:", error);
        return NextResponse.json(
            { error: "Failed to process schedules" },
            { status: 500 }
        );
    }
}
