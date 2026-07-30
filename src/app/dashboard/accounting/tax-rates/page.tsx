import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import prisma from '@/lib/prisma';
import { TaxRateManagement } from './TaxRateManagement';

export default async function TaxRatesPage() {
    const session = await auth();
    if (!session?.user) return redirect("/login");

    const taxRates = await (prisma as any).taxRate.findMany({
        orderBy: { code: 'asc' }
    });

    return <TaxRateManagement taxRates={taxRates} />;
}
