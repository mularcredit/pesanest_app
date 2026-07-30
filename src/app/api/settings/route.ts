import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { auth } from '@/auth';

export async function GET(req: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const keys = searchParams.get('keys');

        if (!keys) {
            return NextResponse.json({ error: 'Keys parameter is required' }, { status: 400 });
        }

        const keyArray = keys.split(',');

        const settings = await prisma.systemSetting.findMany({
            where: {
                key: {
                    in: keyArray
                }
            }
        });

        // Convert array to key-value object
        const settingsMap = settings.reduce((acc: Record<string, string>, setting: { key: string; value: string }) => {
            acc[setting.key] = setting.value;
            return acc;
        }, {} as Record<string, string>);

        return NextResponse.json(settingsMap);
    } catch (error) {
        console.error('Error fetching settings:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();
        const { updates } = body;

        if (!updates || !Array.isArray(updates)) {
            return NextResponse.json({ error: 'Invalid updates payload' }, { status: 400 });
        }

        const results = [];
        
        // Use a transaction or sequential updates
        for (const update of updates) {
            const { key, value, description } = update;
            
            if (!key || value === undefined) {
                continue;
            }

            const setting = await prisma.systemSetting.upsert({
                where: { key },
                update: { value, description: description || undefined },
                create: { key, value, description: description || undefined },
            });
            results.push(setting);
        }

        return NextResponse.json({ success: true, updated: results.length });
    } catch (error) {
        console.error('Error updating settings:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
