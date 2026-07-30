
"use server";

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { AccountingEngine } from "@/lib/accounting/accounting-engine";
import { auth } from "@/auth";

/*
  Data Fetching
*/
export async function getAssets(query: string = "") {
    try {
        const assets = await prisma.asset.findMany({
            where: {
                OR: [
                    { name: { contains: query, mode: "insensitive" } },
                    { serialNumber: { contains: query, mode: "insensitive" } },
                    { assetTag: { contains: query, mode: "insensitive" } },
                    { category: { contains: query, mode: "insensitive" } },
                ]
            },
            include: {
                assignedTo: {
                    select: { name: true, email: true }
                }
            },
            orderBy: { createdAt: "desc" }
        });
        return { success: true, data: assets };
    } catch (error) {
        console.error("Failed to fetch assets:", error);
        return { success: false, error: "Failed to fetch assets" };
    }
}

export async function getAssetStats() {
    try {
        const [total, active, maintenance, retired] = await Promise.all([
            prisma.asset.count(),
            prisma.asset.count({ where: { status: "ACTIVE" } }),
            prisma.asset.count({ where: { status: "MAINTENANCE" } }),
            prisma.asset.count({ where: { status: "RETIRED" } })
        ]);

        // Calculate total value
        const valueResult = await prisma.asset.aggregate({
            _sum: { purchasePrice: true },
            where: { status: "ACTIVE" }
        });

        return {
            total,
            active,
            maintenance,
            retired,
            totalValue: valueResult._sum.purchasePrice || 0
        };
    } catch (error) {
        return { total: 0, active: 0, maintenance: 0, retired: 0, totalValue: 0 };
    }
}

/*
  Mutations
*/
export async function createAsset(data: any) {
    try {
        // Basic validation
        if (!data.name || !data.category || !data.purchasePrice) {
            return { success: false, error: "Missing required fields" };
        }

        const asset = await prisma.asset.create({
            data: {
                name: data.name,
                description: data.description,
                serialNumber: data.serialNumber?.trim() || null,
                assetTag: data.assetTag?.trim() || null,
                category: data.category,
                purchaseDate: new Date(data.purchaseDate),
                purchasePrice: parseFloat(data.purchasePrice),
                currentValue: data.currentValue ? parseFloat(data.currentValue) : parseFloat(data.purchasePrice),
                status: "ACTIVE",
                location: data.location,
                assignedToId: data.assignedToId || null,
                vendor: data.vendor,
                notes: data.notes,
                depreciationMethod: data.depreciationMethod || "NONE",
                usefulLife: data.usefulLifeYears ? Math.round(parseFloat(data.usefulLifeYears) * 12) : null,
                salvageValue: data.salvageValue ? parseFloat(data.salvageValue) : 0,
                depreciationRate: data.depreciationRate ? parseFloat(data.depreciationRate) : null
            }
        });

        // INTEGRATION: Post to General Ledger
        try {
            await AccountingEngine.postAssetPurchase(asset.id);
        } catch (error) {
            console.error("Ledger Post Error:", error);
            // Don't block creation, but log it
        }

        revalidatePath("/dashboard/assets");
        return { success: true, data: asset };
    } catch (error) {
        console.error("Create asset error:", error);
        return { success: false, error: "Failed to create asset" };
    }
}

export async function deleteAsset(id: string) {
    try {
        const session = await auth();
        if (!session?.user?.id) return { success: false, error: "Unauthorized" };

        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: { role: true, customRole: { select: { isSystem: true } } }
        });

        const isAdmin = user?.role === 'SYSTEM_ADMIN' || user?.customRole?.isSystem;
        if (!isAdmin) {
            return { success: false, error: "Only System Admins can delete assets" };
        }

        await prisma.asset.delete({ where: { id } });
        revalidatePath("/dashboard/assets");
        return { success: true };
    } catch (error) {
        return { success: false, error: "Failed to delete asset" };
    }
}

export async function runDepreciation() {
    try {
        const session = await auth();
        if (!session?.user?.id) return { success: false, error: "Unauthorized" };

        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: { role: true, customRole: { select: { isSystem: true } } }
        });
        const isAdmin = user?.role === 'SYSTEM_ADMIN' || user?.customRole?.isSystem;
        if (!isAdmin) return { success: false, error: "Only System Admins can run depreciation" };

        const assets = await prisma.asset.findMany({
            where: {
                status: 'ACTIVE',
                depreciationMethod: { not: 'NONE' },
                usefulLife: { not: null },
                purchasePrice: { gt: 0 }
            }
        });

        let postedCount = 0;
        const currentPeriod = new Date().toISOString().slice(0, 7); // YYYY-MM

        for (const asset of assets) {
            let amount = 0;

            // Calculate Monthly Depreciation
            if (asset.depreciationMethod === 'STRAIGHT_LINE' && asset.usefulLife) {
                // (Cost - Salvage) / Life in Months
                const cost = asset.purchasePrice - (asset.salvageValue || 0);
                amount = cost / asset.usefulLife;
            } else if (asset.depreciationMethod === 'DECLINING_BALANCE' && asset.depreciationRate) {
                // Book Value * Annual Rate / 12
                const bookValue = asset.currentValue ?? asset.purchasePrice;
                amount = bookValue * (asset.depreciationRate / 100 / 12);
            }

            // Round to 2 decimals
            amount = Math.round(amount * 100) / 100;

            if (amount > 0) {
                const entry = await AccountingEngine.postAssetDepreciation(asset.id, amount, currentPeriod);
                // entry is null when already posted this period (idempotent skip)
                if (entry) {
                    await prisma.asset.update({
                        where: { id: asset.id },
                        data: { currentValue: { decrement: amount } }
                    });
                    postedCount++;
                }
            }
        }

        revalidatePath("/dashboard/assets");
        return { success: true, count: postedCount };
    } catch (error) {
        console.error("Depreciation Run Error:", error);
        return { success: false, error: "Failed to run depreciation" };
    }
}
