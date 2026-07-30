
import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";

// Schema for validation
const invoiceSchema = z.object({
    vendorId: z.string().min(1, "Vendor is required"),
    invoiceNumber: z.string().min(1, "Invoice number is required"),
    invoiceDate: z.string(),
    dueDate: z.string(),
    amount: z.number().min(0),
    taxRateId: z.string().optional().nullable(),
    whtRateId: z.string().optional().nullable(),
    currency: z.string().default('KES'),
    description: z.string().optional(),
    fileUrl: z.string().optional().nullable(),
    requisitionId: z.string().optional().nullable(),
    items: z.array(z.object({
        description: z.string(),
        quantity: z.number().min(1),
        unitPrice: z.number().min(0),
        total: z.number(),
        category: z.string().optional(),
    })).optional()
});

export async function POST(req: Request) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();
        const validatedData = invoiceSchema.parse(body);

        const existing = await prisma.invoice.findUnique({
            where: { invoiceNumber: validatedData.invoiceNumber }
        });
        if (existing) {
            return NextResponse.json({ error: "Invoice number already exists" }, { status: 400 });
        }

        // Resolve input VAT rate
        let taxRate = null;
        if (validatedData.taxRateId) {
            taxRate = await (prisma as any).taxRate.findUnique({ where: { id: validatedData.taxRateId } });
            if (!taxRate || taxRate.type !== 'VAT') {
                return NextResponse.json({ error: "Invalid VAT rate" }, { status: 400 });
            }
        }

        // Resolve WHT rate
        let whtRate = null;
        if (validatedData.whtRateId) {
            whtRate = await (prisma as any).taxRate.findUnique({ where: { id: validatedData.whtRateId } });
            if (!whtRate || whtRate.type !== 'WITHHOLDING') {
                return NextResponse.json({ error: "Invalid WHT rate" }, { status: 400 });
            }
        }

        // Calculate amounts
        // `amount` in the request body is the GROSS amount (inclusive of VAT)
        const grossAmount = validatedData.amount;
        const taxAmount = taxRate
            ? Math.round((grossAmount - grossAmount / (1 + taxRate.rate / 100)) * 100) / 100
            : 0;
        const subtotal = grossAmount - taxAmount;
        const whtAmount = whtRate
            ? Math.round(subtotal * (whtRate.rate / 100) * 100) / 100
            : 0;

        const invoice = await prisma.invoice.create({
            data: {
                vendorId: validatedData.vendorId,
                invoiceNumber: validatedData.invoiceNumber,
                invoiceDate: new Date(validatedData.invoiceDate),
                dueDate: new Date(validatedData.dueDate),
                subtotal,
                amount: grossAmount,
                taxAmount,
                taxRateId: taxRate?.id || null,
                whtRateId: whtRate?.id || null,
                whtAmount,
                currency: validatedData.currency,
                description: validatedData.description,
                requisitionId: validatedData.requisitionId,
                fileUrl: validatedData.fileUrl,
                createdById: session.user.id,
                status: "PENDING_APPROVAL",
                paymentStatus: "UNPAID",
                items: { create: validatedData.items || [] }
            }
        });

        return NextResponse.json(invoice);

    } catch (error: any) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
        }
        console.error("Failed to create invoice:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

export async function GET(req: Request) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const status = searchParams.get("status");

        const where: any = {};
        if (status) where.status = status;

        const invoices = await prisma.invoice.findMany({
            where,
            include: {
                vendor: { select: { name: true } },
                createdBy: { select: { name: true } },
                items: true
            },
            orderBy: { createdAt: 'desc' }
        });

        return NextResponse.json(invoices);
    } catch (error) {
        console.error("Failed to fetch invoices:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
