import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/auth";

// POST /api/accounting/payments - Record a customer payment
export async function POST(req: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();
        const {
            customerId,
            amount,
            paymentDate,
            method,
            reference,
            saleId,
            notes
        } = body;

        // Validation
        if (!customerId || !amount || !paymentDate || !method) {
            return NextResponse.json(
                { error: "Missing required fields: customerId, amount, paymentDate, method" },
                { status: 400 }
            );
        }

        if (amount <= 0) {
            return NextResponse.json(
                { error: "Payment amount must be greater than 0" },
                { status: 400 }
            );
        }

        // Verify customer exists
        const customer = await prisma.customer.findUnique({
            where: { id: customerId }
        });

        if (!customer) {
            return NextResponse.json(
                { error: "Customer not found" },
                { status: 404 }
            );
        }

        // If saleId is provided, verify it exists and belongs to this customer
        if (saleId) {
            const sale = await prisma.sale.findUnique({
                where: { id: saleId }
            });

            if (!sale) {
                return NextResponse.json(
                    { error: "Sale/Invoice not found" },
                    { status: 404 }
                );
            }

            if (sale.customerId !== customerId) {
                return NextResponse.json(
                    { error: "Invoice does not belong to this customer" },
                    { status: 400 }
                );
            }
        }

        // Create the payment record
        const payment = await prisma.customerPayment.create({
            data: {
                customerId,
                amount: parseFloat(amount),
                currency: customer.currency,
                paymentDate: new Date(paymentDate),
                method,
                reference: reference || null,
                saleId: saleId || null,
                notes: notes || null
            },
            include: {
                customer: {
                    select: {
                        name: true,
                        currency: true
                    }
                },
                sale: {
                    select: {
                        invoiceNumber: true,
                        totalAmount: true
                    }
                }
            }
        });

        // Optional: Update sale status if fully paid
        if (saleId) {
            const sale = await prisma.sale.findUnique({
                where: { id: saleId },
                include: {
                    payments: true
                }
            });

            if (sale) {
                const totalPaid = sale.payments.reduce((sum, p) => sum + p.amount, 0);
                let newStatus = sale.status;

                if (totalPaid >= Number(sale.totalAmount)) {
                    newStatus = "PAID";
                } else if (totalPaid > 0) {
                    newStatus = "PARTIAL";
                }

                if (newStatus !== sale.status) {
                    await prisma.sale.update({
                        where: { id: saleId },
                        data: { status: newStatus }
                    });
                }
            }
        }

        // Post to General Ledger (Journal Entry)
        try {
            // 1. Get or Create Accounts
            let cashAccount = await prisma.account.findUnique({ where: { code: '1000' } });
            if (!cashAccount) {
                cashAccount = await prisma.account.create({
                    data: { code: '1000', name: 'Cash & Bank', type: 'ASSET', subtype: 'CURRENT_ASSET', description: 'Main operating bank account' }
                });
            }

            let arAccount = await prisma.account.findUnique({ where: { code: '1200' } });
            if (!arAccount) {
                arAccount = await prisma.account.create({
                    data: { code: '1200', name: 'Accounts Receivable', type: 'ASSET', subtype: 'CURRENT_ASSET', description: 'Money owed by customers' }
                });
            }

            if (cashAccount && arAccount) {
                const description = payment.sale?.invoiceNumber
                    ? `Payment for Invoice #${payment.sale.invoiceNumber}`
                    : 'Payment on Account';

                // 2. Create Journal Entry
                await prisma.journalEntry.create({
                    data: {
                        date: new Date(paymentDate),
                        description: `Payment Received - ${customer.name}`,
                        reference: reference || null,
                        paymentId: payment.id,
                        status: 'POSTED',
                        createdBy: session.user.id || 'system',
                        lines: {
                            create: [
                                {
                                    accountId: cashAccount.id,
                                    description: `Cash/Bank Receipt (${method})`,
                                    debit: parseFloat(amount),
                                    credit: 0
                                },
                                {
                                    accountId: arAccount.id,
                                    description: description,
                                    debit: 0,
                                    credit: parseFloat(amount)
                                }
                            ]
                        }
                    }
                });
            }
        } catch (glError) {
            console.error("Failed to post to GL:", glError);
        }

        return NextResponse.json(payment, { status: 201 });

    } catch (error: any) {
        console.error("Error recording payment:", error);
        return NextResponse.json(
            { error: error.message || "Failed to record payment" },
            { status: 500 }
        );
    }
}

// PATCH /api/accounting/payments - Update a customer payment
export async function PATCH(req: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();
        const { id, amount, paymentDate, method, reference, notes } = body;

        if (!id) {
            return NextResponse.json({ error: "Payment ID is required" }, { status: 400 });
        }

        // 1. Get existing payment
        const existingPayment = await prisma.customerPayment.findUnique({
            where: { id },
            include: { sale: true }
        });

        if (!existingPayment) {
            return NextResponse.json({ error: "Payment not found" }, { status: 404 });
        }

        // 2. Update payment
        const updatedPayment = await prisma.customerPayment.update({
            where: { id },
            data: {
                amount: amount ? parseFloat(amount) : undefined,
                paymentDate: paymentDate ? new Date(paymentDate) : undefined,
                method: method || undefined,
                reference: reference, // Allow null/empty updates
                notes: notes // Allow null/empty updates
            },
            include: {
                customer: true,
                sale: true
            }
        });

        // 3. Recalculate sale status if linked to sale
        if (updatedPayment.saleId) {
            const sale = await prisma.sale.findUnique({
                where: { id: updatedPayment.saleId },
                include: { payments: true }
            });

            if (sale) {
                const totalPaid = sale.payments.reduce((sum, p) => sum + p.amount, 0);
                let newStatus = "SENT";

                if (totalPaid >= Number(sale.totalAmount)) {
                    newStatus = "PAID";
                } else if (totalPaid > 0) {
                    newStatus = "PARTIAL";
                }

                if (newStatus !== sale.status) {
                    await prisma.sale.update({
                        where: { id: sale.id },
                        data: { status: newStatus }
                    });
                }
            }
        }

        // 4. Manage GL Entry (Update or Create/Backfill)
        let glResult = { success: false, message: "Starting" };
        try {
            // 1. Get or Create Accounts (Using upsert for safety)
            const cashAccount = await prisma.account.upsert({
                where: { code: '1000' },
                update: {},
                create: { code: '1000', name: 'Cash & Bank', type: 'ASSET', subtype: 'CURRENT_ASSET', description: 'Main operating bank account' }
            });

            const arAccount = await prisma.account.upsert({
                where: { code: '1200' },
                update: {},
                create: { code: '1200', name: 'Accounts Receivable', type: 'ASSET', subtype: 'CURRENT_ASSET', description: 'Money owed by customers' }
            });

            const existingEntry = await prisma.journalEntry.findFirst({
                where: { paymentId: id }
            });

            const invoiceDesc = updatedPayment.sale?.invoiceNumber
                ? `Payment for Invoice #${updatedPayment.sale.invoiceNumber}`
                : 'Payment on Account';

            const commonData = {
                date: updatedPayment.paymentDate,
                description: `Payment Received - ${updatedPayment.customer.name}`,
                reference: updatedPayment.reference || null,
            };

            const lineData = [
                {
                    accountId: cashAccount.id,
                    description: `Cash/Bank Receipt (${updatedPayment.method})`,
                    debit: updatedPayment.amount,
                    credit: 0
                },
                {
                    accountId: arAccount.id,
                    description: invoiceDesc,
                    debit: 0,
                    credit: updatedPayment.amount
                }
            ];

            if (existingEntry) {
                // Update: Clean old lines and add new ones
                await prisma.journalEntry.update({
                    where: { id: existingEntry.id },
                    data: {
                        ...commonData,
                        lines: {
                            deleteMany: {},
                            create: lineData
                        }
                    }
                });
                glResult = { success: true, message: "GL Entry Updated" };
            } else {
                // Create: No deleteMany allowed here
                await prisma.journalEntry.create({
                    data: {
                        ...commonData,
                        paymentId: updatedPayment.id,
                        status: 'POSTED',
                        createdBy: session.user.id || 'system',
                        lines: {
                            create: lineData
                        }
                    }
                });
                glResult = { success: true, message: "GL Entry Created" };
            }
        } catch (glError: any) {
            console.error("Failed to update GL:", glError);
            glResult = { success: false, message: glError.message || "Unknown Error" };
        }

        return NextResponse.json({ ...updatedPayment, glResult });

    } catch (error: any) {
        console.error("Error updating payment:", error);
        return NextResponse.json(
            { error: error.message || "Failed to update payment" },
            { status: 500 }
        );
    }
}

// GET /api/accounting/payments - List customer payments (with filters)
export async function GET(req: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const customerId = searchParams.get("customerId");
        const saleId = searchParams.get("saleId");
        const from = searchParams.get("from");
        const to = searchParams.get("to");

        const where: any = {};

        if (customerId) {
            where.customerId = customerId;
        }

        if (saleId) {
            where.saleId = saleId;
        }

        if (from || to) {
            where.paymentDate = {};
            if (from) where.paymentDate.gte = new Date(from);
            if (to) {
                const endDate = new Date(to);
                endDate.setHours(23, 59, 59, 999);
                where.paymentDate.lte = endDate;
            }
        }

        const payments = await prisma.customerPayment.findMany({
            where,
            include: {
                customer: {
                    select: {
                        name: true,
                        currency: true
                    }
                },
                sale: {
                    select: {
                        invoiceNumber: true,
                        totalAmount: true
                    }
                }
            },
            orderBy: {
                paymentDate: 'desc'
            }
        });

        return NextResponse.json(payments);

    } catch (error: any) {
        console.error("Error fetching payments:", error);
        return NextResponse.json(
            { error: error.message || "Failed to fetch payments" },
            { status: 500 }
        );
    }
}
// DELETE /api/accounting/payments - Delete a customer payment
export async function DELETE(req: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const id = searchParams.get("id");

        if (!id) {
            return NextResponse.json({ error: "Payment ID is required" }, { status: 400 });
        }

        // 1. Get the payment details before deleting
        const payment = await prisma.customerPayment.findUnique({
            where: { id },
            include: { sale: true }
        });

        if (!payment) {
            return NextResponse.json({ error: "Payment not found" }, { status: 404 });
        }

        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: { role: true, customRole: { select: { isSystem: true } } }
        });

        const isAdmin = user?.role === 'SYSTEM_ADMIN' || user?.customRole?.isSystem;
        if (!isAdmin) {
            return NextResponse.json({ error: "Only System Admins can delete payments" }, { status: 403 });
        }

        // 2. Delete the payment
        // Also delete associated Journal Entry
        await prisma.journalEntry.deleteMany({
            where: { paymentId: id }
        });

        await prisma.customerPayment.delete({
            where: { id }
        });

        // 3. If linked to a sale, recalculate sale status
        if (payment.saleId) {
            const sale = await prisma.sale.findUnique({
                where: { id: payment.saleId },
                include: { payments: true }
            });

            if (sale) {
                const totalPaid = sale.payments.reduce((sum, p) => sum + p.amount, 0); // payments are already refreshed after delete
                let newStatus = "PENDING";

                if (totalPaid >= Number(sale.totalAmount)) {
                    newStatus = "PAID";
                } else if (totalPaid > 0) {
                    newStatus = "PARTIAL";
                }

                // Update sale status if changed
                if (newStatus !== sale.status) {
                    await prisma.sale.update({
                        where: { id: sale.id },
                        data: { status: newStatus }
                    });
                }
            }
        }

        return NextResponse.json({ success: true, message: "Payment deleted successfully" });

    } catch (error: any) {
        console.error("Error deleting payment:", error);
        return NextResponse.json(
            { error: error.message || "Failed to delete payment" },
            { status: 500 }
        );
    }
}
