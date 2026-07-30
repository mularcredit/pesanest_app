import { auth } from "@/auth";
import { requirePermission } from "@/lib/access-control";

export default async function ForecastingLayout({ children }: { children: React.ReactNode }) {
    const session = await auth();

    requirePermission(session, ['FORECASTING.VIEW', 'FINANCE.VIEW']);

    return <>{children}</>;
}
