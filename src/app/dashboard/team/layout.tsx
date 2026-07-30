import { auth } from "@/auth";
import { requirePermission } from "@/lib/access-control";

export default async function TeamLayout({ children }: { children: React.ReactNode }) {
    const session = await auth();

    // Replaced hardcoded check with permission check
    // Allows USERS.VIEW which covers viewing the team
    requirePermission(session, ['USERS.VIEW', 'USERS.MANAGE', 'USERS.EDIT']);

    return <>{children}</>;
}
