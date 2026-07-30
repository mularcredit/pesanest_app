import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { sendSMS } from '@/lib/sms/celcom';
import prisma from '@/lib/prisma';

export async function POST(req: NextRequest) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { phone, message } = await req.json();

    if (!phone || !message) {
        return NextResponse.json({ error: 'phone and message are required' }, { status: 400 });
    }

    if (message.length > 480) {
        return NextResponse.json({ error: 'Message too long (max 480 characters)' }, { status: 400 });
    }

    const result = await sendSMS(phone.trim(), message.trim());

    const isStub = String(result.messageId ?? '').startsWith('STUB');
    const status = isStub ? 'STUB' : result.success ? 'SENT' : 'FAILED';

    try {
        await (prisma as any).smsLog.create({
            data: {
                to: phone.trim(),
                message: message.trim(),
                status,
                messageId: result.messageId ? String(result.messageId) : null,
                errorReason: result.error ?? null,
                event: 'MANUAL',
            },
        });
    } catch { /* non-critical */ }

    if (!result.success) {
        return NextResponse.json(
            { error: result.error ?? 'Celcom API returned failure', raw: result.raw },
            { status: 502 }
        );
    }

    return NextResponse.json({ success: true, messageId: result.messageId, stub: isStub });
}
