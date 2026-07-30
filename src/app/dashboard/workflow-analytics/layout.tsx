import { auth } from "@/auth";
import { requirePermission } from "@/lib/access-control";

export default async function WorkflowAnalyticsLayout({ children }: { children: React.ReactNode }) {
    const session = await auth();
    requirePermission(session, ['ANALYTICS.VIEW']);
    return <>{children}</>;
}
