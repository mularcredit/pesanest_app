import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.email) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
        });

        if (!user) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        const { searchParams } = new URL(req.url);
        const countOnly = searchParams.get("countOnly") === "true";

        let dynamicNotifications: any[] = [];
        let dynamicUnreadCount = 0;

        // If user is management/admin, generate dynamic alerts for pending work
        if (user.role === "SYSTEM_ADMIN" || user.role === "TEAM_LEADER" || user.role === "REGIONAL_MANAGER") {
            const pendingApprovalsCount = await prisma.approval.count({
                where: {
                    status: 'PENDING',
                    ...(user.role === 'SYSTEM_ADMIN' ? {} : { approverId: user.id })
                }
            });

            if (pendingApprovalsCount > 0) {
                dynamicNotifications.push({
                    id: "dynamic-queue-approvals",
                    type: "APPROVAL",
                    title: "Pending Approvals Found",
                    message: `You have ${pendingApprovalsCount} request(s) waiting for your official approval in the queue.`,
                    link: "/dashboard/approvals",
                    isRead: false,
                    createdAt: new Date().toISOString()
                });
                dynamicUnreadCount++;
            }

            if (user.role === 'SYSTEM_ADMIN') {
                const pendingExpenses = await prisma.expense.count({ where: { status: 'APPROVED', isReimbursable: true, paymentId: null } });
                const pendingRequisitions = await prisma.requisition.count({ where: { status: 'APPROVED', paymentId: null } });
                const pendingInvoices = await prisma.invoice.count({ where: { status: 'APPROVED', paymentStatus: { not: 'PAID' }, paymentId: null } });

                const totalPendingPayments = pendingExpenses + pendingRequisitions + pendingInvoices;

                if (totalPendingPayments > 0) {
                    dynamicNotifications.push({
                        id: "dynamic-queue-payments",
                        type: "PAYMENT",
                        title: "Payments Outstanding",
                        message: `There are ${totalPendingPayments} approved request(s) that require payment processing.`,
                        link: "/dashboard/payments",
                        isRead: false,
                        createdAt: new Date().toISOString()
                    });
                    dynamicUnreadCount++;
                }
            }
        }

        if (countOnly) {
            const unreadCount = await prisma.notification.count({
                where: {
                    userId: user.id,
                    isRead: false,
                },
            });
            return NextResponse.json({ count: unreadCount + dynamicUnreadCount });
        }

        // Get all notifications (last 50)
        const dbNotifications = await prisma.notification.findMany({
            where: {
                userId: user.id,
            },
            orderBy: {
                createdAt: "desc",
            },
            take: 50,
        });

        // Merge DB notifications with Action Item notifications
        const notifications = [...dynamicNotifications, ...dbNotifications];
        const unreadCount = dbNotifications.filter(n => !n.isRead).length + dynamicUnreadCount;

        return NextResponse.json({
            notifications,
            unreadCount,
        });
    } catch (error) {
        console.error("Get notifications error:", error);
        return NextResponse.json(
            { error: "Failed to fetch notifications" },
            { status: 500 }
        );
    }
}

// Mark notification as read
export async function PATCH(req: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.email) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { notificationId, markAllRead } = await req.json();

        const user = await prisma.user.findUnique({
            where: { email: session.user.email },
        });

        if (!user) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        if (markAllRead) {
            // Mark all as read
            await prisma.notification.updateMany({
                where: {
                    userId: user.id,
                    isRead: false,
                },
                data: {
                    isRead: true,
                },
            });
            return NextResponse.json({ message: "All notifications marked as read" });
        }

        if (notificationId) {
            // Mark single notification as read
            await prisma.notification.update({
                where: {
                    id: notificationId,
                    userId: user.id, // Ensure user owns this notification
                },
                data: {
                    isRead: true,
                },
            });
            return NextResponse.json({ message: "Notification marked as read" });
        }

        return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    } catch (error) {
        console.error("Update notification error:", error);
        return NextResponse.json(
            { error: "Failed to update notification" },
            { status: 500 }
        );
    }
}
