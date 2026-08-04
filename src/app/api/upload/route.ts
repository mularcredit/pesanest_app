import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import prisma from '@/lib/prisma';
import { getReceiptUrl } from '@/lib/receipt-url';

const receiptStore = prisma as unknown as {
    uploadedReceipt: {
        create: (args: {
            data: {
                filename: string;
                contentType: string;
                data: Uint8Array;
                size: number;
                createdById: string;
            };
        }) => Promise<{ id: string }>;
    };
};

export async function POST(req: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const formData = await req.formData();
        const file = formData.get('file') as File;

        if (!file) {
            return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
        }

        // Validate file type
        const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
        if (!allowedTypes.includes(file.type)) {
            return NextResponse.json(
                { error: 'Invalid file type. Only JPG, PNG, and PDF are allowed' },
                { status: 400 }
            );
        }

        // Validate file size (10MB max)
        const maxSize = 10 * 1024 * 1024; // 10MB
        if (file.size > maxSize) {
            return NextResponse.json(
                { error: 'File too large. Maximum size is 10MB' },
                { status: 400 }
            );
        }

        // Generate a display filename
        const timestamp = Date.now();
        const randomString = Math.random().toString(36).substring(7);
        const extension = file.name.split('.').pop();
        const filename = `receipt-${timestamp}-${randomString}.${extension}`;

        // Convert file to bytes and persist with the receipt metadata
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);
        const receipt = await receiptStore.uploadedReceipt.create({
            data: {
                filename,
                contentType: file.type,
                data: buffer,
                size: file.size,
                createdById: session.user.id,
            }
        });

        const url = getReceiptUrl(receipt.id);

        return NextResponse.json({
            success: true,
            url,
            filename,
            size: file.size,
            type: file.type
        });

    } catch (error) {
        console.error('File upload error:', error);
        return NextResponse.json(
            { error: 'Failed to upload file' },
            { status: 500 }
        );
    }
}
