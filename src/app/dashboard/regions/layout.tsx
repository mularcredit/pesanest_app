import { auth } from "@/auth";
import { requirePermission } from "@/lib/access-control";

export default async function RegionsLayout({ children }: { children: React.ReactNode }) {
    const session = await auth();
    requirePermission(session, ['REGIONS.VIEW', 'BRANCHES.VIEW']);
    return <>{children}</>;
}
