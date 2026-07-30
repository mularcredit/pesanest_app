'use server'

import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function getPendingUsers() {
    try {
        const users = await prisma.user.findMany({
            where: {
                accountStatus: 'PENDING'
            },
            orderBy: {
                createdAt: 'desc'
            }
        });
        return { success: true, data: users };
    } catch (error) {
        console.error("Error fetching pending users:", error);
        return { success: false, error: "Failed to fetch pending users" };
    }
}

export async function approveUser(userId: string) {
    try {
        await prisma.user.update({
            where: { id: userId },
            data: {
                accountStatus: 'ACTIVE',
                isActive: true
            }
        });
        revalidatePath('/dashboard/users');
        return { success: true };
    } catch (error) {
        console.error("Error approving user:", error);
        return { success: false, error: "Failed to approve user" };
    }
}

export async function rejectUser(userId: string) {
    try {
        await prisma.user.update({
            where: { id: userId },
            data: {
                accountStatus: 'REJECTED',
                isActive: false
            }
        });
        revalidatePath('/dashboard/users');
        return { success: true };
    } catch (error) {
        console.error("Error rejecting user:", error);
        return { success: false, error: "Failed to reject user" };
    }
}
