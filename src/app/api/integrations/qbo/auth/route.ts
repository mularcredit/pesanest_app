
import { NextResponse } from 'next/server';
import { QuickBooksService } from '@/lib/integrations/quickbooks';
import { auth } from '@/auth';

export async function GET() {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const authUrl = QuickBooksService.getAuthUrl();
        return NextResponse.redirect(authUrl);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
