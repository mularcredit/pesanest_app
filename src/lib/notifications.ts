import prisma from "@/lib/prisma";

export type NotificationType = "APPROVAL" | "INVOICE" | "EXPENSE" | "BUDGET" | "PAYMENT" | "SYSTEM";

interface CreateNotificationParams {
    userId: string;
    type: NotificationType;
    title: string;
    message: string;
    link?: string;
    relatedId?: string;
}

/**
 * Create a notification for a user
 */
export async function createNotification(params: CreateNotificationParams) {
    try {
        const notification = await prisma.notification.create({
            data: {
                userId: params.userId,
                type: params.type,
                title: params.title,
                message: params.message,
                link: params.link,
                relatedId: params.relatedId,
            },
        });
        return notification;
    } catch (error) {
        console.error("Failed to create notification:", error);
        return null;
    }
}

/**
 * Create notifications for multiple users
 */
export async function createBulkNotifications(
    userIds: string[],
    params: Omit<CreateNotificationParams, "userId">
) {
    try {
        const notifications = await prisma.notification.createMany({
            data: userIds.map(userId => ({
                userId,
                type: params.type,
                title: params.title,
                message: params.message,
                link: params.link,
                relatedId: params.relatedId,
            })),
        });
        return notifications;
    } catch (error) {
        console.error("Failed to create bulk notifications:", error);
        return null;
    }
}

/**
 * Notify when expense is approved/rejected
 */
export async function notifyExpenseStatus(
    userId: string,
    expenseId: string,
    status: "APPROVED" | "REJECTED",
    approverName: string,
    expenseDescription: string
) {
    return createNotification({
        userId,
        type: "EXPENSE",
        title: status === "APPROVED" ? "Expense Approved" : "Expense Rejected",
        message: `Your expense "${expenseDescription}" has been ${status.toLowerCase()} by ${approverName}.`,
        link: `/dashboard/expenses/${expenseId}`,
        relatedId: expenseId,
    });
}

/**
 * Notify when new invoice is received
 */
export async function notifyNewInvoice(
    userId: string,
    invoiceId: string,
    invoiceNumber: string,
    vendorName: string,
    amount: number
) {
    return createNotification({
        userId,
        type: "INVOICE",
        title: "New Invoice Received",
        message: `Invoice ${invoiceNumber} from ${vendorName} for $${amount.toLocaleString()} requires your attention.`,
        link: `/dashboard/invoices/${invoiceId}`,
        relatedId: invoiceId,
    });
}

/**
 * Notify when budget threshold is reached
 */
export async function notifyBudgetAlert(
    userId: string,
    department: string,
    percentage: number,
    budgetId?: string
) {
    return createNotification({
        userId,
        type: "BUDGET",
        title: "Budget Alert",
        message: `${department} department has reached ${percentage}% of monthly budget.`,
        link: budgetId ? `/dashboard/budgets/${budgetId}` : "/dashboard/budgets",
        relatedId: budgetId,
    });
}

/**
 * Notify when payment is made
 */
export async function notifyPaymentMade(
    userId: string,
    paymentId: string,
    amount: number,
    recipient: string
) {
    return createNotification({
        userId,
        type: "PAYMENT",
        title: "Payment Processed",
        message: `Payment of $${amount.toLocaleString()} to ${recipient} has been processed.`,
        link: `/dashboard/payments/${paymentId}`,
        relatedId: paymentId,
    });
}

/**
 * Notify when approval is pending
 */
export async function notifyPendingApproval(
    userId: string,
    type: "expense" | "requisition" | "invoice",
    itemId: string,
    description: string,
    submitterName: string
) {
    return createNotification({
        userId,
        type: "APPROVAL",
        title: `${type.charAt(0).toUpperCase() + type.slice(1)} Pending Approval`,
        message: `${submitterName} submitted "${description}" for your approval.`,
        link: `/dashboard/approvals`,
        relatedId: itemId,
    });
}
