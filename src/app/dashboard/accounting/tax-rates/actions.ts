'use server';

import prisma from "@/lib/prisma";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const TaxRateSchema = z.object({
    id: z.string().optional(),
    name: z.string().min(1, "Name is required"),
    code: z.string().min(1, "Code is required"),
    rate: z.coerce.number().min(0, "Rate must be positive"),
    type: z.enum(["VAT", "SALES_TAX", "WITHHOLDING", "EXCISE"]),
    description: z.string().optional(),
    effectiveFrom: z.date().optional(),
    effectiveTo: z.date().optional(),
    isActive: z.boolean().optional(),
});

export async function createTaxRate(data: z.infer<typeof TaxRateSchema>) {
    const session = await auth();
    if (!session?.user) {
        return { success: false, error: "Unauthorized" };
    }

    try {
        const validated = TaxRateSchema.parse(data);

        // Check active tax rates to prevent duplicates with same code
        const existing = await prisma.taxRate.findUnique({
            where: { code: validated.code }
        });

        if (existing) {
            return { success: false, error: "Tax rate code already exists" };
        }

        await prisma.taxRate.create({
            data: {
                name: validated.name,
                code: validated.code,
                rate: validated.rate,
                type: validated.type,
                description: validated.description,
                effectiveFrom: validated.effectiveFrom || new Date(),
                effectiveTo: validated.effectiveTo,
                isActive: true
            }
        });

        revalidatePath("/dashboard/accounting/tax-rates");
        return { success: true };
    } catch (error) {
        console.error("Failed to create tax rate:", error);
        return { success: false, error: "Failed to create tax rate" };
    }
}

export async function updateTaxRate(data: z.infer<typeof TaxRateSchema>) {
    const session = await auth();
    if (!session?.user) {
        return { success: false, error: "Unauthorized" };
    }

    if (!data.id) {
        return { success: false, error: "Missing Tax Rate ID" };
    }

    try {
        const validated = TaxRateSchema.parse(data);

        await prisma.taxRate.update({
            where: { id: data.id },
            data: {
                name: validated.name,
                code: validated.code,
                rate: validated.rate,
                type: validated.type,
                description: validated.description,
                effectiveFrom: validated.effectiveFrom,
                effectiveTo: validated.effectiveTo,
            }
        });

        revalidatePath("/dashboard/accounting/tax-rates");
        return { success: true };
    } catch (error) {
        console.error("Failed to update tax rate:", error);
        return { success: false, error: "Failed to update tax rate" };
    }
}

export async function toggleTaxRateStatus(id: string, isActive: boolean) {
    const session = await auth();
    if (!session?.user) {
        return { success: false, error: "Unauthorized" };
    }

    try {
        await prisma.taxRate.update({
            where: { id },
            data: { isActive }
        });

        revalidatePath("/dashboard/accounting/tax-rates");
        return { success: true };
    } catch (error) {
        console.error("Failed to toggle tax rate status:", error);
        return { success: false, error: "Failed to update status" };
    }
}
