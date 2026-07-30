
import { NextRequest, NextResponse } from 'next/server';
import { QuickBooksService } from '@/lib/integrations/quickbooks';

export async function GET(req: NextRequest) {
    try {
        const url = req.url;
        await QuickBooksService.exchangeCode(url);

        // Redirect back to settings page with a success message
        return NextResponse.redirect(new URL('/dashboard/settings?tab=integrations&qbo=connected', req.url));
    } catch (error: any) {
        console.error('QBO Callback logic error:', error);
        return NextResponse.redirect(new URL('/dashboard/settings?tab=integrations&qbo=error', req.url));
    }
}
