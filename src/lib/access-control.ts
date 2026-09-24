import { redirect } from "next/navigation";
import { Session } from "next-auth";

export function requirePermission(session: Session | null, permission: string | string[]) {
    if (!session?.user) redirect("/login");

    const user = session.user as any;
    const role = user.role;
    const permissions = user.permissions || [];

    // System Admin has full access. Master Viewer can view every page too —
    // this helper only ever gates page-level view access (never a mutation),
    // so it's safe to let this role through unconditionally rather than
    // depending on the permission catalogue having a *.VIEW entry for
    // every single page.
    if (role === 'SYSTEM_ADMIN' || role === 'MASTER_VIEWER' || permissions.includes('*')) {
        return;
    }

    // Check permissions
    const requiredPermissions = Array.isArray(permission) ? permission : [permission];
    const hasAccess = requiredPermissions.some(p => permissions.includes(p));

    if (hasAccess) {
        return;
    }

    // Redirect if denied
    // We redirect to dashboard as a safe fallback
    redirect("/dashboard");
}
