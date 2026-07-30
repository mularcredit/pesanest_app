import { redirect } from "next/navigation";
import { Session } from "next-auth";

export function requirePermission(session: Session | null, permission: string | string[]) {
    if (!session?.user) redirect("/login");

    const user = session.user as any;
    const role = user.role;
    const permissions = user.permissions || [];

    // System Admin has full access
    if (role === 'SYSTEM_ADMIN' || permissions.includes('*')) {
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
