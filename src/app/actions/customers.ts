'use server'

import prisma from "@/lib/prisma"
import { auth } from "@/auth"
import { revalidatePath } from "next/cache"

export async function trashCustomer(id: string) {
    const session = await auth();
    if (!session?.user?.id) {
        return { message: "Unauthorized", success: false };
    }

    try {
        await prisma.customer.update({
            where: { id },
            data: { isTrashed: true }
        });
        revalidatePath("/dashboard/accounting/customers");
        return { message: "Customer moved to trash", success: true };
    } catch (e) {
        console.error("Failed to trash customer:", e);
        return { message: "Failed to move customer to trash", success: false };
    }
}

export async function restoreCustomer(id: string) {
    const session = await auth();
    if (!session?.user?.id) {
        return { message: "Unauthorized", success: false };
    }

    try {
        await prisma.customer.update({
            where: { id },
            data: { isTrashed: false }
        });
        revalidatePath("/dashboard/accounting/customers");
        return { message: "Customer restored successfully", success: true };
    } catch (e) {
        console.error("Failed to restore customer:", e);
        return { message: "Failed to restore customer", success: false };
    }
}

export async function deleteCustomer(id: string) {
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
        return { message: "Only System Admins can permanently delete customers", success: false };
    }

    try {
        await prisma.customer.delete({
            where: { id }
        });

        revalidatePath("/dashboard/accounting/customers");
        return { message: "Customer permanently deleted", success: true };
    } catch (e) {
        console.error("Failed to delete customer:", e);
        return { message: "Failed to delete customer. You may need to trash it instead.", success: false };
    }
}
