import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/auth";

// POST /api/accounting/credit-notes - Create a credit note
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
            invoiceRef,
            reason,
            saleId,
            date,
            cnNumber: customCnNumber
        } = body;

        // Validation
        if (!customerId || !amount || !invoiceRef || !reason) {
            return NextResponse.json(
                { error: "Missing required fields: customerId, amount, invoiceRef, reason" },
                { status: 400 }
            );
        }

        if (amount <= 0) {
            return NextResponse.json(
                { error: "Credit note amount must be greater than 0" },
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

        let cnNumber = "";
        const trimmedCustomCnNumber = customCnNumber?.toString().trim();

        if (trimmedCustomCnNumber) {
            // Check if custom number already exists
            const existing = await prisma.creditNote.findUnique({
                where: { cnNumber: trimmedCustomCnNumber }
            });
            if (existing) {
                return NextResponse.json(
                    { error: `Credit note number ${trimmedCustomCnNumber} already exists` },
                    { status: 400 }
                );
            }
            cnNumber = trimmedCustomCnNumber;
        } else {
            // Generate unique credit note number
            // Search for the highest numeric value in the CN-XXXX format
            const creditNotes = await prisma.creditNote.findMany({
                where: { cnNumber: { startsWith: 'CN-' } },
                select: { cnNumber: true },
                orderBy: { cnNumber: 'desc' },
                take: 1
            });

            let nextNumber = 1;
            if (creditNotes.length > 0) {
                const lastCn = creditNotes[0].cnNumber;
                const match = lastCn.match(/CN-(\d+)/);
                if (match) {
                    nextNumber = parseInt(match[1]) + 1;
                }
            }

            // Loop to ensure absolute uniqueness (prevents race condition errors)
            let isUnique = false;
            while (!isUnique) {
                cnNumber = `CN-${nextNumber.toString().padStart(4, '0')}`;
                const collision = await prisma.creditNote.findUnique({
                    where: { cnNumber }
                });
                if (collision) {
                    nextNumber++;
                } else {
                    isUnique = true;
                }
            }
        }

        // Create the credit note record
        const creditNote = await prisma.creditNote.create({
            data: {
                cnNumber,
                customerId,
                amount: parseFloat(amount),
                invoiceRef,
                reason,
                status: 'POSTED',
                createdAt: date ? new Date(date) : new Date()
            },
            include: {
                customer: {
                    select: {
                        name: true,
                        currency: true
                    }
                }
            }
        });

        // Optional: Update sale status if linked to an invoice
        const sale = await prisma.sale.findUnique({
            where: { invoiceNumber: invoiceRef },
            include: { payments: true }
        });

        if (sale && sale.customerId === customerId) {
            // Get all active credit notes for this invoice
            const cns = await prisma.creditNote.findMany({
                where: {
                    invoiceRef: invoiceRef,
                    status: 'POSTED'
                }
            });

            const totalPaid = sale.payments.reduce((sum, p) => sum + p.amount, 0);
            const totalCredited = cns.reduce((sum, cn) => sum + cn.amount, 0);
            const totalSettled = totalPaid + totalCredited;

            let newStatus = sale.status;
            if (totalSettled >= Number(sale.totalAmount)) {
                newStatus = "PAID";
            } else if (totalSettled > 0) {
                newStatus = "PARTIAL";
            }

            if (newStatus !== sale.status) {
                await prisma.sale.update({
                    where: { id: sale.id },
                    data: { status: newStatus }
                });
            }
        }
        try {
            // 1. Get or Create Accounts
            let arAccount = await prisma.account.findUnique({ where: { code: '1200' } });
            if (!arAccount) {
                arAccount = await prisma.account.create({
                    data: {
                        code: '1200',
                        name: 'Accounts Receivable',
                        type: 'ASSET',
                        subtype: 'CURRENT_ASSET',
                        description: 'Money owed by customers'
                    }
                });
            }

            let salesReturnsAccount = await prisma.account.findUnique({ where: { code: '4100' } });
            if (!salesReturnsAccount) {
                salesReturnsAccount = await prisma.account.create({
                    data: {
                        code: '4100',
                        name: 'Sales Returns & Allowances',
                        type: 'REVENUE',
                        subtype: 'CONTRA_REVENUE',
                        description: 'Returns, allowances, and credit notes issued'
                    }
                });
            }

            if (arAccount && salesReturnsAccount) {
                // 2. Create Journal Entry
                // Credit Note reduces AR (credit) and increases Sales Returns (debit)
                await prisma.journalEntry.create({
                    data: {
                        date: date ? new Date(date) : new Date(),
                        description: `Credit Note ${cnNumber} - ${customer.name}`,
                        reference: cnNumber,
                        creditNoteId: creditNote.id,
                        status: 'POSTED',
                        createdBy: session.user.id || 'system',
                        lines: {
                            create: [
                                {
                                    accountId: salesReturnsAccount.id,
                                    description: `${reason} (Ref: ${invoiceRef})`,
                                    debit: parseFloat(amount),
                                    credit: 0
                                },
                                {
                                    accountId: arAccount.id,
                                    description: `Credit Note against ${invoiceRef}`,
                                    debit: 0,
                                    credit: parseFloat(amount)
                                }
                            ]
                        }
                    }
                });
            }
        } catch (glError) {
            console.error("Failed to post credit note to GL:", glError);
            // Note: Credit note is still created, but GL posting failed
            // You might want to handle this differently in production
        }

        return NextResponse.json(creditNote, { status: 201 });

    } catch (error: any) {
        console.error("Error creating credit note:", error);
        return NextResponse.json(
            { error: error.message || "Failed to create credit note" },
            { status: 500 }
        );
    }
}

// GET /api/accounting/credit-notes - List credit notes (with filters)
export async function GET(req: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const customerId = searchParams.get("customerId");

        const where: any = {};

        if (customerId) {
            where.customerId = customerId;
        }

        const creditNotes = await prisma.creditNote.findMany({
            where,
            include: {
                customer: {
                    select: {
                        name: true,
                        currency: true
                    }
                }
            },
            orderBy: {
                createdAt: 'desc'
            }
        });

        return NextResponse.json(creditNotes);

    } catch (error: any) {
        console.error("Error fetching credit notes:", error);
        return NextResponse.json(
            { error: error.message || "Failed to fetch credit notes" },
            { status: 500 }
        );
    }
}
// PATCH /api/accounting/credit-notes - Void a credit note
export async function PATCH(req: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();
        const { id, reason } = body;

        if (!id) {
            return NextResponse.json({ error: "Credit Note ID is required" }, { status: 400 });
        }

        // 1. Get existing credit note
        const creditNote = await prisma.creditNote.findUnique({
            where: { id },
            include: {
                customer: true,
                journalEntries: true
            }
        });

        if (!creditNote) {
            return NextResponse.json({ error: "Credit Note not found" }, { status: 404 });
        }

        if (creditNote.status === 'VOIDED') {
            return NextResponse.json({ error: "Credit Note is already voided" }, { status: 400 });
        }

        // 2. Update credit note status
        const updatedCreditNote = await prisma.creditNote.update({
            where: { id },
            data: {
                status: 'VOIDED',
                // We'll store the void reason in the journal entry description since we didn't update the schema
            }
        });

        // 3. Optional: Update sale status if linked to an invoice
        const sale = await prisma.sale.findUnique({
            where: { invoiceNumber: creditNote.invoiceRef },
            include: { payments: true }
        });

        if (sale && sale.customerId === creditNote.customerId) {
            // Get all active credit notes for this invoice (will exclude this one as we just marked it VOIDED)
            const cns = await prisma.creditNote.findMany({
                where: {
                    invoiceRef: creditNote.invoiceRef,
                    status: 'POSTED'
                }
            });

            const totalPaid = sale.payments.reduce((sum, p) => sum + p.amount, 0);
            const totalCredited = cns.reduce((sum, cn) => sum + cn.amount, 0);
            const totalSettled = totalPaid + totalCredited;

            let newStatus = "SENT"; // Default back to SENT
            if (totalSettled >= Number(sale.totalAmount)) {
                newStatus = "PAID";
            } else if (totalSettled > 0) {
                newStatus = "PARTIAL";
            } else {
                newStatus = "SENT";
            }

            if (newStatus !== sale.status) {
                await prisma.sale.update({
                    where: { id: sale.id },
                    data: { status: newStatus }
                });
            }
        }

        // 4. Create reversing Journal Entry
        try {
            const arAccount = await prisma.account.findUnique({ where: { code: '1200' } });
            const salesReturnsAccount = await prisma.account.findUnique({ where: { code: '4100' } });

            if (arAccount && salesReturnsAccount) {
                await prisma.journalEntry.create({
                    data: {
                        date: new Date(),
                        description: `VOID: Credit Note ${creditNote.cnNumber} - ${reason || 'Correction'}`,
                        reference: `VOID-${creditNote.cnNumber}`,
                        creditNoteId: creditNote.id,
                        status: 'POSTED',
                        createdBy: session.user.id || 'system',
                        lines: {
                            create: [
                                {
                                    accountId: arAccount.id,
                                    description: `Reversing CN ${creditNote.cnNumber}`,
                                    debit: creditNote.amount,
                                    credit: 0
                                },
                                {
                                    accountId: salesReturnsAccount.id,
                                    description: `Reversing CN ${creditNote.cnNumber}`,
                                    debit: 0,
                                    credit: creditNote.amount
                                }
                            ]
                        }
                    }
                });
            }
        } catch (glError) {
            console.error("Failed to post void to GL:", glError);
        }

        return NextResponse.json(updatedCreditNote);

    } catch (error: any) {
        console.error("Error voiding credit note:", error);
        return NextResponse.json(
            { error: error.message || "Failed to void credit note" },
            { status: 500 }
        );
    }
}
