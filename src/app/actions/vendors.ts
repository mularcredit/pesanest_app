'use server'

import prisma from "@/lib/prisma"
import { auth } from "@/auth"
import { revalidatePath } from "next/cache"
import { z } from "zod"

const VendorSchema = z.object({
    name: z.string().min(1, "Name is required"),
    category: z.string().min(1, "Category is required"),
    description: z.string().optional().or(z.literal('')),
    email: z.string().email().optional().or(z.literal('')),
    phone: z.string().optional(),
    website: z.string().url().optional().or(z.literal('')),
    paymentTerms: z.string().optional(),
    currency: z.string().default('KES'),
    bankName: z.string().optional(),
    bankAccount: z.string().optional(),
    preferredPaymentMethod: z.string().optional(),
})

export async function createVendor(prevState: any, formData: FormData) {
    const session = await auth()
    if (!session?.user?.id) {
        return { message: "Unauthorized", success: false }
    }

    const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        include: { leadBranch: true }
    });

    const isBranchManager = user?.role === 'TEAM_LEADER';
    const activeBranchId = user?.leadBranch?.id || user?.branchId || null;

    const data = {
        name: formData.get('name') as string,
        category: formData.get('category') as string,
        description: formData.get('description') as string,
        email: formData.get('email') as string,
        phone: formData.get('phone') as string,
        website: formData.get('website') as string,
        paymentTerms: formData.get('paymentTerms') as string,
        currency: formData.get('currency') as string || 'KES',
        bankName: formData.get('bankName') as string || undefined,
        bankAccount: formData.get('bankAccount') as string || undefined,
        preferredPaymentMethod: formData.get('preferredPaymentMethod') as string || undefined,
    }

    try {
        const validated = VendorSchema.parse(data)

        await (prisma.vendor as any).create({
            data: {
                ...validated,
                isActive: true,
                email: validated.email || null,
                phone: validated.phone || null,
                website: validated.website || null,
                description: validated.description || null,
                bankName: validated.bankName || null,
                bankAccount: validated.bankAccount || null,
                preferredPaymentMethod: validated.preferredPaymentMethod || null,
                branchId: isBranchManager ? activeBranchId : null,
            }
        })

        revalidatePath("/dashboard/vendors")
        return { message: "Vendor created successfully", success: true }
    } catch (e) {
        console.error(e)
        return { message: "Failed to create vendor", success: false }
    }
}

export async function trashVendor(id: string) {
    const session = await auth();
    if (!session?.user?.id) {
        return { message: "Unauthorized", success: false };
    }

    try {
        await prisma.vendor.update({
            where: { id },
            data: { isTrashed: true }
        });
        revalidatePath("/dashboard/vendors");
        return { message: "Vendor moved to trash", success: true };
    } catch (e) {
        console.error("Failed to trash vendor:", e);
        return { message: "Failed to move vendor to trash", success: false };
    }
}

export async function restoreVendor(id: string) {
    const session = await auth();
    if (!session?.user?.id) {
        return { message: "Unauthorized", success: false };
    }

    try {
        await prisma.vendor.update({
            where: { id },
            data: { isTrashed: false }
        });
        revalidatePath("/dashboard/vendors");
        return { message: "Vendor restored successfully", success: true };
    } catch (e) {
        console.error("Failed to restore vendor:", e);
        return { message: "Failed to restore vendor", success: false };
    }
}

export async function deleteVendor(id: string) {
    const session = await auth();
    if (!session?.user?.id) {
        return { message: "Unauthorized", success: false };
    }

    const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { role: true, customRole: { select: { isSystem: true } } }
    });

    const isAdmin = user?.role === 'SYSTEM_ADMIN' || user?.customRole?.isSystem;
    if (!isAdmin) {
        return { message: "Only System Admins can permanently delete vendors", success: false };
    }

    try {
        await prisma.vendor.delete({
            where: { id }
        });

        revalidatePath("/dashboard/vendors");
        return { message: "Vendor permanently deleted", success: true };
    } catch (e) {
        console.error("Failed to delete vendor:", e);
        return { message: "Failed to delete vendor. You may need to trash it instead.", success: false };
    }
}

export async function updateVendor(id: string, formData: FormData) {
    const session = await auth()
    if (!session?.user?.id) {
        return { message: "Unauthorized", success: false }
    }

    const data = {
        name: formData.get('name') as string,
        category: formData.get('category') as string,
        description: formData.get('description') as string,
        email: formData.get('email') as string,
        phone: formData.get('phone') as string,
        website: formData.get('website') as string,
        paymentTerms: formData.get('paymentTerms') as string,
        currency: formData.get('currency') as string || 'KES',
    }

    try {
        const validated = VendorSchema.parse(data)

        await prisma.vendor.update({
            where: { id },
            data: {
                ...validated,
                email: validated.email || null,
                phone: validated.phone || null,
                website: validated.website || null,
                description: validated.description || null,
            }
        })

        revalidatePath("/dashboard/vendors")
        return { message: "Vendor updated successfully", success: true }
    } catch (e) {
        console.error(e)
        return { message: "Failed to update vendor", success: false }
    }
}
