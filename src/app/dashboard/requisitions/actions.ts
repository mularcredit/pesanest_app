"use server";

import prisma from "@/lib/prisma";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";

export async function fulfillRequisition(formData: FormData) {
    const session = await auth();
    if (!session?.user?.id) throw new Error("Unauthorized");

    const requisitionId = formData.get("requisitionId") as string;
    const receiptUrl = formData.get("receiptUrl") as string;
    const notes = formData.get("notes") as string;
    const etrNumber = (formData.get("etrNumber") as string)?.trim().toUpperCase() || null;
    const etrVerified = formData.get("etrVerified") === "true";

    if (!requisitionId || !receiptUrl) {
        throw new Error("Expense ID and Receipt URL are required");
    }

    try {
        const requisition = await prisma.requisition.findUnique({
            where: { id: requisitionId }
        });

        if (!requisition) throw new Error("Expense not found");
        if (requisition.status !== 'APPROVED') throw new Error("Only approved requisitions can be fulfilled");

        await prisma.expense.create({
            data: {
                userId: session.user.id,
                requisitionId: requisitionId,
                title: `Fulfillment: ${requisition.title}`,
                description: notes || requisition.description,
                amount: requisition.amount,
                category: requisition.category,
                expenseDate: new Date(),
                receiptUrl: receiptUrl,
                etrNumber: etrNumber || null,
                etrVerified: etrVerified,
                etrVerifiedAt: etrVerified ? new Date() : null,
                status: 'APPROVED',
                paymentMethod: 'PERSONAL_CARD',
                isReimbursable: true
            }
        });

        await prisma.requisition.update({
            where: { id: requisitionId },
            data: { status: 'FULFILLED' }
        });

        revalidatePath("/dashboard/requisitions");
        revalidatePath("/dashboard/expenses");
        revalidatePath("/dashboard/payments");
        revalidatePath("/dashboard/approvals");

        return { success: true };
    } catch (e: any) {
        console.error(e);
        return { error: e.message };
    }
}

export async function deleteRequisition(id: string) {
    const session = await auth();
    if (!session?.user?.id) return { success: false, message: "Unauthorized" };

    try {
        const requisition = await prisma.requisition.findUnique({ where: { id } });
        if (!requisition) return { success: false, message: "Expense not found" };

        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: { role: true, customRole: { select: { isSystem: true } } }
        });

        const isAdmin = user?.role === 'SYSTEM_ADMIN' || user?.customRole?.isSystem;
        if (!isAdmin) {
            return { success: false, message: "Only Global Admin can delete requisitions" };
        }

        await (prisma as any).requisition.delete({ where: { id } });

        revalidatePath("/dashboard/requisitions");
        return { success: true, message: "Expense deleted successfully" };
    } catch (e: any) {
        console.error("Failed to delete requisition:", e);
        return { success: false, message: e.message || "Failed to delete" };
    }
}

export async function updateRequisition(formData: FormData) {
    const session = await auth();
    if (!session?.user?.id) return { success: false, message: "Unauthorized" };

    const id = formData.get("id") as string;
    const title = (formData.get("title") as string)?.trim();
    const description = (formData.get("description") as string)?.trim();
    const branch = (formData.get("branch") as string)?.trim();
    const department = (formData.get("department") as string)?.trim();
    const expectedDateStr = formData.get("expectedDate") as string;
    const amountStr = formData.get("amount") as string;
    const currency = (formData.get("currency") as string)?.trim();
    const category = (formData.get("category") as string)?.trim();
    const paymentMethod = (formData.get("paymentMethod") as string)?.trim();
    const paymentReference = (formData.get("paymentReference") as string)?.trim();

    if (!id) return { success: false, message: "Missing requisition ID" };
    if (!title || title.length < 5) return { success: false, message: "Title must be at least 5 characters" };
    if (!description || description.length < 10) return { success: false, message: "Justification must be at least 10 characters" };

    try {
        const requisition = await prisma.requisition.findUnique({ where: { id } });
        if (!requisition) return { success: false, message: "Expense not found" };

        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: { role: true, customRole: { select: { isSystem: true } } }
        });
        const isAdmin = user?.role === 'SYSTEM_ADMIN' || user?.role === 'ADMIN' || user?.customRole?.isSystem;

        if (!isAdmin && requisition.userId !== session.user.id) {
            return { success: false, message: "You can only edit your own requisitions" };
        }
        if (!isAdmin && !['PENDING', 'NEEDS_INFO', 'ADJUSTMENT_REQUIRED'].includes(requisition.status)) {
            return { success: false, message: `This requisition cannot be edited (status: ${requisition.status})` };
        }

        const expectedDate = expectedDateStr ? new Date(expectedDateStr) : null;
        const amount = amountStr ? parseFloat(amountStr) : undefined;

        const isResubmitting = requisition.status === 'ADJUSTMENT_REQUIRED';

        await (prisma as any).requisition.update({
            where: { id },
            data: {
                title,
                description,
                businessJustification: description,
                branch: branch || null,
                department: department || null,
                expectedDate: expectedDate,
                ...(amount !== undefined && !isNaN(amount) ? { amount } : {}),
                ...(currency ? { currency } : {}),
                ...(category ? { category } : {}),
                ...(paymentMethod ? { paymentMethod } : {}),
                ...(paymentReference ? { paymentReference } : {}),
                // Reset status to PENDING so it re-enters the approval queue
                ...(isResubmitting ? { status: 'PENDING' } : {}),
            }
        });

        // If it was an adjustment (or is already pending but has stuck adjustment approvals), 
        // reset the approval records so they show up in the queue again.
        if (requisition.status === 'ADJUSTMENT_REQUIRED' || requisition.status === 'PENDING') {
            await prisma.approval.updateMany({
                where: { 
                    requisitionId: id,
                    status: 'ADJUSTMENT'
                },
                data: {
                    status: 'PENDING'
                }
            });
        }

        revalidatePath("/dashboard/requisitions");
        revalidatePath("/dashboard/approvals");
        return { success: true, message: "Expense updated and resubmitted for approval" };
    } catch (e: any) {
        console.error("Failed to update requisition:", e);
        return { success: false, message: e.message || "Failed to update" };
    }
}

export async function createItemPaymentBatch(itemId: string) {
    const session = await auth();
    if (!session?.user?.id) return { success: false, message: "Unauthorized" };

    try {
        // Only privileged roles can initiate payment
        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: { role: true, customRole: { select: { isSystem: true } } }
        });

        const isPrivileged = [
            'SYSTEM_ADMIN', 'FINANCE_APPROVER', 'FINANCE_TEAM', 'MANAGER', 'TEAM_LEADER'
        ].includes(user?.role || '') || user?.customRole?.isSystem;

        if (!isPrivileged) {
            return { success: false, message: "Only finance/admin roles can initiate item payments" };
        }

        // Fetch the item and its parent requisition
        const item = await (prisma as any).requisitionItem.findUnique({
            where: { id: itemId },
            include: { requisition: true }
        });

        if (!item) return { success: false, message: "Item not found" };
        if (item.status !== 'APPROVED' && item.status !== 'PENDING') {
            return { success: false, message: `Item cannot be paid (current status: ${item.status})` };
        }

        const req = item.requisition;
        const itemTotal = item.quantity * item.unitPrice;

        // Create a Payment record linked to the parent requisition
        // Amount = this specific item's total only
        const payment = await prisma.payment.create({
            data: {
                amount: itemTotal,
                currency: req.currency || 'KES',
                status: 'PENDING_AUTHORIZATION',
                makerId: session.user.id,
                method: 'BANK_TRANSFER',
                notes: `Item payment: "${item.title}" (Item ID: ${item.id.slice(0, 8)}) from requisition: ${req.title}`,
                requisitions: {
                    connect: { id: req.id }
                }
            }
        });

        revalidatePath("/dashboard/payments");
        revalidatePath("/dashboard/requisitions");

        return { success: true, paymentId: payment.id, message: "Payment batch created for item" };
    } catch (e: any) {
        console.error("Failed to create item payment batch:", e);
        return { success: false, message: e.message || "Failed to create payment" };
    }
}
