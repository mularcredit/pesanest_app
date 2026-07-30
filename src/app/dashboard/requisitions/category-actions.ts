"use server";

import prisma from "@/lib/prisma";
import { auth } from "@/auth";
import { z } from "zod";

const CustomCategorySchema = z.object({
    name: z.string().min(2, "Category name must be at least 2 characters"),
    description: z.string().optional(),
});

export async function createCustomCategory(formData: FormData) {
    const session = await auth();
    if (!session?.user?.id) {
        return { error: "Unauthorized" };
    }

    const validatedFields = CustomCategorySchema.safeParse({
        name: formData.get("name"),
        description: formData.get("description"),
    });

    if (!validatedFields.success) {
        return {
            errors: validatedFields.error.flatten().fieldErrors,
        };
    }

    const { name, description } = validatedFields.data;

    try {
        const category = await (prisma as any).customCategory.create({
            data: {
                name,
                description,
            },
        });

        return { success: true, category };
    } catch (error: any) {
        if (error.code === "P2002") {
            return { error: "A category with this name already exists" };
        }
        return { error: "Failed to create category" };
    }
}

export async function getCustomCategories() {
    try {
        const categories = await (prisma as any).customCategory.findMany({
            where: { isActive: true },
            orderBy: { name: "asc" },
        });
        return categories;
    } catch (error) {
        console.error("Error fetching custom categories:", error);
        return [];
    }
}

export async function deleteCustomCategory(id: string) {
    const session = await auth();
    if (!session?.user?.id) {
        return { error: "Unauthorized" };
    }

    try {
        await (prisma as any).customCategory.update({
            where: { id },
            data: { isActive: false },
        });
        return { success: true };
    } catch (error) {
        return { error: "Failed to delete category" };
    }
}
