import { auth } from "@/auth";
import { requirePermission } from "@/lib/access-control";

export default async function AccountingLayout({ children }: { children: React.ReactNode }) {
    const session = await auth();

    // Allow if user has any accounting-related permission (GL.VIEW covers legacy seeded users)
    requirePermission(session, [
        'ACCOUNTING.VIEW',
        'GL.VIEW',
        'REPORTS.VIEW',
        'CUSTOMERS.VIEW',
        'PAYABLES.VIEW',
        'SALES.MANAGE',
        'LEDGER.VIEW',
    ]);

    return <>{children}</>;
}
