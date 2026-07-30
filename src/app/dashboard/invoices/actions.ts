"use server";

import prisma from "@/lib/prisma";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";

export async function uploadQuickInvoice(fileUrl: string, fileName: string) {
    const session = await auth();
    if (!session?.user?.id) {
        return { success: false, error: "Unauthorized" };
    }

    try {
        // 1. Find or Create "Pending Processing" Vendor
        let vendor = await prisma.vendor.findFirst({
            where: { name: "Pending Processing" }
        });

        if (!vendor) {
            // Try to find ANY vendor to fallback to, or create the placeholder
            vendor = await prisma.vendor.create({
                data: {
                    name: "Pending Processing",
                    category: "System",
                    isActive: true
                }
            });
        }

        // 2. Create Invoice Record
        // Generate a short separate ID to avoid collision
        const shortId = Math.random().toString(36).substring(2, 8).toUpperCase();
        const invoiceNumber = `UPLOAD-${shortId}`;

        await prisma.invoice.create({
            data: {
                vendorId: vendor.id,
                invoiceNumber: invoiceNumber,
                invoiceDate: new Date(),
                dueDate: new Date(), // Set to today by default
                amount: 0,
                status: 'DRAFT',
                fileUrl: fileUrl,
                createdById: session.user.id,
                description: `Quick upload: ${fileName}`,
                items: {
                    create: [
                        {
                            description: "Unprocessed attachment",
                            quantity: 1,
                            unitPrice: 0,
                            total: 0
                        }
                    ]
                }
            }
        });

        revalidatePath("/dashboard/invoices");
        return { success: true };

    } catch (error) {
        console.error("Quick upload error:", error);
        return { success: false, error: "Failed to save invoice record" };
    }
}
