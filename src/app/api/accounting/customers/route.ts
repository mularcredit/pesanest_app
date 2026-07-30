
import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();

    // Basic Validation
    if (!body.name) {
        return NextResponse.json({ error: "Customer Name is required" }, { status: 400 });
    }

    try {
        const customer = await prisma.customer.create({
            data: {
                name: body.name,
                email: body.email || null,
                phone: body.phone || null,
                contactPerson: body.contactPerson || null,
                address: body.address || null,
                city: body.city || null,
                country: body.country || "South Sudan",
                taxId: body.taxId || null,
                currency: body.currency || 'KES',
                isActive: true
            }
        });
        return NextResponse.json(customer);
    } catch (error) {
        console.error("Error creating customer:", error);
        return NextResponse.json({ error: "Failed to create customer" }, { status: 500 });
    }
}

export async function PUT(req: Request) {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();

    if (!body.id) {
        return NextResponse.json({ error: "Customer ID is required" }, { status: 400 });
    }

    try {
        const customer = await prisma.customer.update({
            where: { id: body.id },
            data: {
                name: body.name,
                email: body.email || null,
                phone: body.phone || null,
                contactPerson: body.contactPerson || null,
                address: body.address || null,
                city: body.city || null,
                country: body.country || "South Sudan",
                taxId: body.taxId || null,
                currency: body.currency || 'KES',
                isActive: body.isActive !== undefined ? body.isActive : true
            }
        });
        return NextResponse.json(customer);
    } catch (error) {
        console.error("Error updating customer:", error);
        return NextResponse.json({ error: "Failed to update customer" }, { status: 500 });
    }
}
