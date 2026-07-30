import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { checkSystemSetup } from '@/lib/onboarding';

export async function GET() {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const setupStatus = await checkSystemSetup();
        return NextResponse.json(setupStatus);
    } catch (error) {
        console.error('Error checking setup status:', error);
        return NextResponse.json(
            { error: 'Failed to check setup status' },
            { status: 500 }
        );
    }
}
