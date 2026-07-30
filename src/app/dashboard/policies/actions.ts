"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { z } from "zod";

const PolicySchema = z.object({
    name: z.string().min(3),
    description: z.string().optional(),
    type: z.enum(['SPENDING_LIMIT', 'APPROVAL_ROUTING', 'RECEIPT_REQUIREMENT', 'TIME_LIMIT', 'CATEGORY_RESTRICTION', 'VENDOR_RESTRICTION', 'AUTO_APPROVAL', 'KEYWORD_RESTRICTION']),
    rules: z.string() // We'll validate the JSON structure in the client or inside the action manually
});

export async function createPolicy(formData: FormData) {
    const rawData = {
        name: formData.get('name'),
        description: formData.get('description'),
        type: formData.get('type'),
        rules: formData.get('rules'),
    };

    try {
        const data = PolicySchema.parse(rawData);

        await prisma.policy.create({
            data: {
                name: data.name,
                description: data.description || "",
                type: data.type as any,
                rules: data.rules,
                isActive: true
            }
        });

        revalidatePath('/dashboard/policies');
        return { success: true };
    } catch (e: any) {
        return { error: e.message || "Failed to create policy" };
    }
}

export async function togglePolicy(id: string, currentState: boolean) {
    try {
        await prisma.policy.update({
            where: { id },
            data: { isActive: !currentState }
        });
        revalidatePath('/dashboard/policies');
        return { success: true };
    } catch (e) {
        return { error: "Failed to update policy" };
    }
}

export async function deletePolicy(id: string) {
    try {
        const session = await auth();
        if (!session?.user?.id) return { error: "Unauthorized" };

        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: { role: true, customRole: { select: { isSystem: true } } }
        });

        const isAdmin = user?.role === 'SYSTEM_ADMIN' || user?.customRole?.isSystem;
        if (!isAdmin) {
            return { error: "Only System Admins can delete policies" };
        }
        await prisma.policy.delete({ where: { id } });
        revalidatePath('/dashboard/policies');
        return { success: true };
    } catch (e) {
        return { error: "Failed to delete policy" };
    }
}
