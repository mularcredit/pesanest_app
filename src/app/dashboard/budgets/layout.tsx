import { auth } from "@/auth";
import { requirePermission } from "@/lib/access-control";

export default async function BudgetsLayout({ children }: { children: React.ReactNode }) {
    const session = await auth();
    requirePermission(session, ['BUDGETS.VIEW', 'FINANCE.VIEW']);
    return <>{children}</>;
}
