import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";

export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth();
        if (!session?.user?.email) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { id } = await params;
        const { action, ...data } = await req.json();

        if (action === 'toggle') {
            const schedule = await prisma.schedule.findUnique({
                where: { id },
            });

            if (!schedule) {
                return NextResponse.json({ error: "Schedule not found" }, { status: 404 });
            }

            const updated = await prisma.schedule.update({
                where: { id },
                data: { isActive: !schedule.isActive },
                include: {
                    createdBy: {
                        select: { id: true, name: true, email: true },
                    },
                },
            });

            return NextResponse.json({ schedule: updated });
        }

        // Regular update
        const schedule = await prisma.schedule.update({
            where: { id },
            data: {
                ...data,
                startDate: data.startDate ? new Date(data.startDate) : undefined,
                endDate: data.endDate ? new Date(data.endDate) : undefined,
            },
            include: {
                createdBy: {
                    select: { id: true, name: true, email: true },
                },
            },
        });

        return NextResponse.json({ schedule });
    } catch (error) {
        console.error("Update schedule error:", error);
        return NextResponse.json(
            { error: "Failed to update schedule" },
            { status: 500 }
        );
    }
}

export async function DELETE(
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
            select: { role: true, customRole: { select: { isSystem: true } } }
        });

        const isAdmin = user?.role === 'SYSTEM_ADMIN' || user?.customRole?.isSystem;
        if (!isAdmin) {
            return NextResponse.json({ error: "Only System Admins can delete schedules" }, { status: 403 });
        }

        const { id } = await params;

        await prisma.schedule.delete({
            where: { id },
        });

        return NextResponse.json({ message: "Schedule deleted successfully" });
    } catch (error) {
        console.error("Delete schedule error:", error);
        return NextResponse.json(
            { error: "Failed to delete schedule" },
            { status: 500 }
        );
    }
}

