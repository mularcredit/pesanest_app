"use server";

import prisma from "@/lib/prisma";

export async function getVendors() {
    try {
        const vendors = await prisma.vendor.findMany({
            where: { isActive: true },
            orderBy: { name: 'asc' },
            select: {
                id: true,
                name: true
            }
        });
        return { success: true, vendors };
    } catch (error) {
        console.error("Failed to fetch vendors:", error);
        return { success: false, error: "Failed to fetch vendors" };
    }
}
