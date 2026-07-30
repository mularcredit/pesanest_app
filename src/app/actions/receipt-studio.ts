"use server";

import prisma from "@/lib/prisma";
import { auth } from "@/auth";

export async function getRequisitionDetailsForReceipt(requisitionId: string) {
    const session = await auth();
    if (!session?.user?.id) throw new Error("Unauthorized");

    const req = await (prisma.requisition.findUnique as any)({
        where: { id: requisitionId },
        include: {
            user: true,
            items: true, // Include requisition items
            approvals: {
                include: {
                    approver: true
                }
            }
        }
    });

    if (!req) return null;

    // Approvers
    const requestedBy = req.user.name || "Unknown";
    // Authorized by highest level approver?
    const authorizedBy = req.approvals.sort((a: any, b: any) => b.level - a.level)[0]?.approver?.name || "Pending";

    const vendorMatch = req.description?.match(/\*\*Preferred Vendor:\*\*\s*(.+?)(?=\n|$)/);
    let beneficiaryName = vendorMatch && vendorMatch[1] ? vendorMatch[1].trim() : req.title;
    const beneficiaryAddress = req.department ? `${req.department} Dept` : "N/A";

    // Build items array from requisition items if they exist, otherwise use the requisition itself
    let items = [];

    if (req.items && req.items.length > 0) {
        // Map each requisition item to the receipt format
        items = req.items.map((item: any) => ({
            description: item.title,
            subtext: `${item.category} - Qty: ${item.quantity} @ ${req.currency || 'KES'} ${item.unitPrice.toFixed(2)}`,
            date: item.createdAt,
            amount: item.totalPrice
        }));
    } else {
        // Fallback to single item (for old requisitions without items)
        items = [{
            description: req.title,
            subtext: req.description || req.category,
            date: req.createdAt,
            amount: req.amount
        }];
    }

    return {
        receiptNo: `VCH-${new Date().getFullYear()}-${req.id.slice(0, 8).toUpperCase()}`,
        date: req.updatedAt,
        amount: req.amount,
        beneficiary: {
            name: beneficiaryName,
            address: beneficiaryAddress
        },
        paymentMode: "Bank Transfer",
        paymentRef: `REQ-${req.id.slice(0, 8)}`,
        items,
        approvals: {
            requestedBy,
            authorizedBy,
            paidBy: "Finance Dept",
            receivedBy: ""
        }
    };
}

export async function getInvoiceDetailsForReceipt(invoiceId: string) {
    const session = await auth();
    if (!session?.user?.id) throw new Error("Unauthorized");

    const inv = await prisma.invoice.findUnique({
        where: { id: invoiceId },
        include: {
            vendor: true,
            createdBy: true,
        }
    });

    if (!inv) return null;

    return {
        receiptNo: `VCH-${new Date().getFullYear()}-${inv.id.slice(0, 8).toUpperCase()}`,
        date: inv.invoiceDate,
        amount: Number(inv.amount),
        beneficiary: {
            name: inv.vendor.name,
            address: inv.vendor.address || "N/A"
        },
        paymentMode: "Bank Transfer",
        paymentRef: `INV-${inv.invoiceNumber}`,
        items: [
            {
                description: `Invoice: ${inv.invoiceNumber}`,
                subtext: inv.description || "Vendor Payment",
                date: inv.invoiceDate,
                amount: Number(inv.amount)
            }
        ],
        approvals: {
            requestedBy: inv.createdBy.name || "Unknown",
            authorizedBy: "Finance Manager",
            paidBy: "Finance Dept",
            receivedBy: ""
        }
    };
}

export async function getExpenseDetailsForReceipt(expenseId: string) {
    const session = await auth();
    if (!session?.user?.id) throw new Error("Unauthorized");

    const exp = await prisma.expense.findUnique({
        where: { id: expenseId },
        include: {
            user: true,
        }
    });

    if (!exp) return null;

    return {
        receiptNo: `VCH-${new Date().getFullYear()}-${exp.id.slice(0, 8).toUpperCase()}`,
        date: exp.expenseDate,
        amount: exp.amount,
        beneficiary: {
            name: exp.user.name || "Unknown",
            address: exp.user.department ? `${exp.user.department} Dept` : "N/A"
        },
        paymentMode: "Bank Transfer",
        paymentRef: `EXP-${exp.id.slice(0, 8)}`,
        items: [
            {
                description: exp.title,
                subtext: exp.description || exp.category,
                date: exp.expenseDate,
                amount: exp.amount
            }
        ],
        approvals: {
            requestedBy: exp.user.name || "Unknown",
            authorizedBy: "Department Head",
            paidBy: "Finance Dept",
            receivedBy: ""
        }
    };
}



export async function getPaymentDetailsForReceipt(paymentId: string) {
    const session = await auth();
    if (!session?.user?.id) throw new Error("Unauthorized");

    const payment = await prisma.payment.findUnique({
        where: { id: paymentId },
        include: {
            requisitions: {
                include: {
                    user: true,
                    items: true // Fetch items for detailed breakdown
                }
            },
            invoices: {
                include: {
                    vendor: true
                }
            },
            expenses: {
                include: {
                    user: true
                }
            },
            monthlyBudgets: true,
            maker: true,
            checker: true
        }
    });

    if (!payment) return null;

    // Transform into Receipt Data format
    // Flatten items from disparate sources
    const items = [];

    // Add requisitions
    for (const req of payment.requisitions) {
        if (req.items && req.items.length > 0) {
            // Add individual items
            for (const item of req.items) {
                items.push({
                    description: item.title,
                    subtext: `${item.category || req.category} - Qty: ${item.quantity} @ ${req.currency || 'KES'} ${Number(item.unitPrice).toFixed(2)}`,
                    date: item.createdAt,
                    amount: item.totalPrice
                });
            }
        } else {
            // Fallback for requisitions without items
            items.push({
                description: req.title,
                subtext: `Requisition (Ref: ${req.id.slice(-6)}) - ${req.category}`,
                date: req.updatedAt,
                amount: req.amount
            });
        }
    }

    // Add invoices
    for (const inv of payment.invoices) {
        items.push({
            description: `Invoice: ${inv.invoiceNumber}`,
            subtext: `Vendor: ${inv.vendor.name}`,
            date: inv.dueDate,
            amount: inv.amount
        });
    }

    // Add expenses
    for (const exp of payment.expenses) {
        items.push({
            description: exp.title,
            subtext: `Reimbursement: ${exp.user.name}`,
            date: exp.expenseDate,
            amount: exp.amount
        });
    }

    // Add budgets
    for (const bud of payment.monthlyBudgets) {
        items.push({
            description: `Budget Allocation: ${bud.branch}`,
            subtext: `Period: ${bud.month}/${bud.year}`,
            date: bud.updatedAt,
            amount: bud.totalAmount
        });
    }

    // Determine Beneficiary logic
    // We try to find a common beneficiary if possible
    let beneficiaryName = "Various Beneficiaries";
    let beneficiaryAddress = "";

    // 1. Check invoices
    if (payment.invoices.length > 0) {
        const firstVendorId = payment.invoices[0].vendorId;
        const allSameVendor = payment.invoices.every(i => i.vendorId === firstVendorId);
        if (allSameVendor) {
            beneficiaryName = payment.invoices[0].vendor.name;
            beneficiaryAddress = payment.invoices[0].vendor.address || "";
        }
    }
    // 2. Check expenses
    else if (payment.expenses.length > 0) {
        const firstUserId = payment.expenses[0].userId;
        const allSameUser = payment.expenses.every(e => e.userId === firstUserId);
        if (allSameUser) {
            beneficiaryName = payment.expenses[0].user.name || "Unknown";
        }
    }
    // 3. Check requisitions
    else if (payment.requisitions.length > 0) {
        const req = payment.requisitions[0];
        const vendorMatch = req.description?.match(/\*\*Preferred Vendor:\*\*\s*(.+?)(?=\n|$)/);
        if (vendorMatch && vendorMatch[1]) {
            beneficiaryName = vendorMatch[1].trim();
        } else {
            beneficiaryName = req.title || "Various Beneficiaries";
        }
    }

    // Clean payment method
    let payMethod = 'Bank Transfer';
    if (payment.method) {
        if (payment.method === 'MOBILE_MONEY') payMethod = 'Mobile Money';
        else if (payment.method === 'CASH') payMethod = 'Cash';
        else payMethod = payment.method.replace(/_/g, ' ');
    }

    return {
        receiptNo: `RCT-${new Date().getFullYear()}-${payment.id.slice(0, 6).toUpperCase()}`,
        date: payment.processedAt || payment.updatedAt,
        amount: payment.amount,
        beneficiary: {
            name: beneficiaryName,
            address: beneficiaryAddress
        },
        paymentMode: payMethod,
        paymentRef: payment.reference || `TRX-${payment.id.slice(0, 8)}`,
        items: items,
        approvals: {
            requestedBy: payment.maker?.name || "Unknown",
            authorizedBy: payment.checker?.name || "Pending",
            paidBy: "Finance Dept",
            receivedBy: beneficiaryName
        }
    };
}

export async function getRequisitionItemDetailsForReceipt(itemId: string) {
    const session = await auth();
    if (!session?.user?.id) throw new Error("Unauthorized");

    const item = await (prisma as any).requisitionItem.findUnique({
        where: { id: itemId },
        include: {
            requisition: {
                include: {
                    user: true,
                    approvals: {
                        include: { approver: true },
                        orderBy: { level: 'desc' }
                    }
                }
            }
        }
    });

    if (!item) return null;

    const req = item.requisition;
    const requestedBy = req.user?.name || "Unknown";
    const authorizedBy = req.approvals?.[0]?.approver?.name || "Pending";
    const vendorMatch = req.description?.match(/\*\*Preferred Vendor:\*\*\s*(.+?)(?=\n|$)/);
    let beneficiaryName = vendorMatch && vendorMatch[1] ? vendorMatch[1].trim() : req.title;
    const beneficiaryAddress = req.department ? `${req.department} Dept` : (req.branch || "N/A");

    const currency = req.currency || 'KES';
    const itemTotal = item.quantity * item.unitPrice;

    return {
        receiptNo: `VCH-${new Date().getFullYear()}-${item.id.slice(0, 8).toUpperCase()}`,
        date: item.createdAt,
        amount: itemTotal,
        beneficiary: {
            name: beneficiaryName,
            address: beneficiaryAddress
        },
        paymentMode: req.paymentMethod?.replace(/_/g, " ") || "Bank Transfer",
        paymentRef: `ITEM-${item.id.slice(0, 8).toUpperCase()}`,
        items: [
            {
                description: item.title,
                subtext: `${item.category} — Qty: ${item.quantity} @ ${currency} ${Number(item.unitPrice).toFixed(2)}`,
                date: item.createdAt,
                amount: itemTotal
            }
        ],
        approvals: {
            requestedBy,
            authorizedBy,
            paidBy: "Finance Dept",
            receivedBy: ""
        }
    };
}
