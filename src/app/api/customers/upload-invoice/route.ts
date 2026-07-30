import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { writeFile, mkdir, unlink } from "fs/promises";
import path from "path";
import prisma from "@/lib/prisma";

export async function POST(req: Request) {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        const formData = await req.formData();
        const file = formData.get("file") as File;
        const id = formData.get("id") as string;
        const type = formData.get("type") as string;
        const reference = formData.get("reference") as string;

        if (!file || !id || !type) {
            return NextResponse.json({ error: "Missing file, id, or type" }, { status: 400 });
        }

        // Save file to public/uploads/invoices/
        const uploadDir = path.join(process.cwd(), "public", "uploads", "invoices");
        await mkdir(uploadDir, { recursive: true });

        const ext = file.name.split(".").pop();
        const fileName = `${type.toLowerCase()}-${id}-${Date.now()}.${ext}`;
        const filePath = path.join(uploadDir, fileName);

        const buffer = Buffer.from(await file.arrayBuffer());
        await writeFile(filePath, buffer);

        const publicUrl = `/uploads/invoices/${fileName}`;

        // Persist the URL based on the transaction type
        if (type === 'INVOICE') {
            await prisma.sale.update({
                where: { id },
                data: { invoiceUrl: publicUrl }
            });
        } else if (type === 'PAYMENT') {
            await prisma.customerPayment.update({
                where: { id },
                data: { invoiceUrl: publicUrl }
            });
        } else if (type === 'CREDIT_NOTE') {
            await prisma.creditNote.update({
                where: { id },
                data: { invoiceUrl: publicUrl }
            });
        }

        return NextResponse.json({ success: true, url: publicUrl, reference });
    } catch (error: any) {
        console.error("Invoice upload error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(req: Request) {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    try {
        const { id, type, fileUrl } = await req.json();

        if (!id || !type) {
            return NextResponse.json({ error: "Missing id or type" }, { status: 400 });
        }

        // Clear URL in DB
        if (type === 'INVOICE') {
            await prisma.sale.update({ where: { id }, data: { invoiceUrl: null } });
        } else if (type === 'PAYMENT') {
            await prisma.customerPayment.update({ where: { id }, data: { invoiceUrl: null } });
        } else if (type === 'CREDIT_NOTE') {
            await prisma.creditNote.update({ where: { id }, data: { invoiceUrl: null } });
        }

        // Delete the physical file if URL provided
        if (fileUrl) {
            const filePath = path.join(process.cwd(), "public", fileUrl);
            await unlink(filePath).catch(() => {}); // Silently ignore if file missing
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error("Invoice delete error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
