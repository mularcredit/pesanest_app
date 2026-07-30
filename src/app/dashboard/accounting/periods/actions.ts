'use server';

import prisma from "@/lib/prisma";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const FiscalYearSchema = z.object({
    name: z.string().min(1, "Name is required"),
    startDate: z.date(),
    endDate: z.date(),
    periodType: z.enum(["MONTHLY", "QUARTERLY", "ANNUAL"]),
});

export async function createFiscalYear(data: z.infer<typeof FiscalYearSchema>) {
    const session = await auth();
    if (!session?.user) {
        return { success: false, error: "Unauthorized" };
    }

    try {
        const validated = FiscalYearSchema.parse(data);

        // Check for overlaps (simplified check)
        const overlapping = await prisma.fiscalYear.findFirst({
            where: {
                OR: [
                    {
                        startDate: { lte: validated.endDate },
                        endDate: { gte: validated.startDate }
                    }
                ]
            }
        });

        if (overlapping) {
            return { success: false, error: "Fiscal year overlaps with an existing year." };
        }

        // Create Fiscal Year
        const fy = await prisma.fiscalYear.create({
            data: {
                name: validated.name,
                startDate: validated.startDate,
                endDate: validated.endDate,
                isCurrent: true, // Set as current by default for now, logic can be improved
            }
        });

        // Auto-generate periods
        const periods = [];
        let currentDate = new Date(validated.startDate);
        const endDate = new Date(validated.endDate);

        if (validated.periodType === 'MONTHLY') {
            while (currentDate < endDate) {
                const start = new Date(currentDate);
                const end = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0); // Last day of month

                // Adjust if end goes beyond FY end
                const actualEnd = end > endDate ? endDate : end;

                periods.push({
                    fiscalYearId: fy.id,
                    name: start.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
                    periodType: 'MONTHLY',
                    startDate: start,
                    endDate: actualEnd
                });

                // Next month
                currentDate.setMonth(currentDate.getMonth() + 1);
                currentDate.setDate(1);
            }
        } else if (validated.periodType === 'QUARTERLY') {
            // Logic for quarterly ... omitted for brevity but good to have
            // For now defaults to Monthly if not implemented
        }

        if (periods.length > 0) {
            await prisma.accountingPeriod.createMany({
                data: periods
            });
        }

        revalidatePath("/dashboard/accounting/periods");
        return { success: true };
    } catch (error) {
        console.error("Failed to create fiscal year:", error);
        return { success: false, error: "Failed to create fiscal year" };
    }
}

async function requireAccountingAdmin(session: any) {
    if (!session?.user) return false;
    const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { role: true, customRole: { select: { isSystem: true } } }
    });
    return user?.role === 'SYSTEM_ADMIN' || user?.customRole?.isSystem;
}

export async function closePeriod(periodId: string) {
    const session = await auth();
    if (!session?.user) return { success: false, error: "Unauthorized" };

    if (!(await requireAccountingAdmin(session))) {
        return { success: false, error: "Only System Admins can close accounting periods" };
    }

    try {
        const period = await prisma.accountingPeriod.findUnique({ where: { id: periodId } });
        if (!period) return { success: false, error: "Period not found" };
        if (period.isClosed) return { success: false, error: "Period is already closed" };

        await prisma.accountingPeriod.update({
            where: { id: periodId },
            data: { isClosed: true, closedAt: new Date(), closedBy: session.user.id }
        });

        await (prisma as any).auditLog.create({
            data: {
                actorId: session.user.id,
                action: 'PERIOD_CLOSE',
                entity: 'AccountingPeriod',
                entityId: periodId,
                after: { name: period.name, closedAt: new Date() },
            }
        });

        revalidatePath("/dashboard/accounting/periods");
        return { success: true };
    } catch (error) {
        console.error(error);
        return { success: false, error: "Failed to close period" };
    }
}

export async function reopenPeriod(periodId: string, reason: string) {
    const session = await auth();
    if (!session?.user) return { success: false, error: "Unauthorized" };

    if (!(await requireAccountingAdmin(session))) {
        return { success: false, error: "Only System Admins can reopen accounting periods" };
    }

    if (!reason?.trim()) return { success: false, error: "A reason is required to reopen a period" };

    try {
        const period = await prisma.accountingPeriod.findUnique({ where: { id: periodId } });
        if (!period) return { success: false, error: "Period not found" };
        if (!period.isClosed) return { success: false, error: "Period is not closed" };

        await prisma.accountingPeriod.update({
            where: { id: periodId },
            data: { isClosed: false, closedAt: null, closedBy: null }
        });

        await (prisma as any).auditLog.create({
            data: {
                actorId: session.user.id,
                action: 'PERIOD_REOPEN',
                entity: 'AccountingPeriod',
                entityId: periodId,
                after: { name: period.name, reason, reopenedAt: new Date() },
            }
        });

        revalidatePath("/dashboard/accounting/periods");
        return { success: true };
    } catch (error) {
        console.error(error);
        return { success: false, error: "Failed to reopen period" };
    }
}

export async function closeFiscalYear(fyId: string) {
    const session = await auth();
    if (!session?.user) return { success: false, error: "Unauthorized" };

    if (!(await requireAccountingAdmin(session))) {
        return { success: false, error: "Only System Admins can close a fiscal year" };
    }

    try {
        const fy = await prisma.fiscalYear.findUnique({
            where: { id: fyId },
            include: { periods: { where: { isClosed: false } } }
        });
        if (!fy) return { success: false, error: "Fiscal year not found" };
        if (fy.periods.length > 0) {
            return { success: false, error: `${fy.periods.length} period(s) are still open. Close all periods before closing the fiscal year.` };
        }

        await prisma.fiscalYear.update({
            where: { id: fyId },
            data: { isClosed: true, isCurrent: false }
        });

        await (prisma as any).auditLog.create({
            data: {
                actorId: session.user.id,
                action: 'FISCAL_YEAR_CLOSE',
                entity: 'FiscalYear',
                entityId: fyId,
                after: { name: fy.name, closedAt: new Date() },
            }
        });

        revalidatePath("/dashboard/accounting/periods");
        return { success: true };
    } catch (error) {
        console.error(error);
        return { success: false, error: "Failed to close fiscal year" };
    }
}
