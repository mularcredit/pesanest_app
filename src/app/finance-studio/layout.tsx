import { auth } from "@/auth";
import { requirePermission } from "@/lib/access-control";

/**
 * Finance Studio layout intentionally resets the global Avenir Next font back
 * to the system/Lexend stack. This studio has its own dark-mode design language
 * and should not inherit the Avenir Next global font.
 */
export default async function FinanceStudioLayout({ children }: { children: React.ReactNode }) {
    const session = await auth();

    requirePermission(session, ['STUDIO.VIEW', 'FINANCE.VIEW', 'REPORTS.VIEW']);

    return (
        <div style={{
            fontFamily: 'var(--font-lexend), -apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Helvetica Neue", Helvetica, Arial, sans-serif',
        }}>
            {children}
        </div>
    );
}
