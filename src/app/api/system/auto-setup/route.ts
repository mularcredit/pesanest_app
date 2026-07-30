import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { createStandardChartOfAccounts } from '@/lib/onboarding';

export async function POST() {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Only allow admins to auto-setup
        const user = session.user as any;
        if (user.role !== 'SYSTEM_ADMIN' && user.role !== 'FINANCE_APPROVER') {
            return NextResponse.json(
                { error: 'Only administrators can perform auto-setup' },
                { status: 403 }
            );
        }

        const result = await createStandardChartOfAccounts();
        return NextResponse.json(result);
    } catch (error) {
        console.error('Error during auto-setup:', error);
        return NextResponse.json(
            { error: 'Failed to create accounts' },
            { status: 500 }
        );
    }
}
