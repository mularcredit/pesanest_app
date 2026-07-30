import BranchesClient from "./BranchesClient";
import { auth } from "@/auth";
import { requirePermission } from "@/lib/access-control";

export const metadata = { title: `Branch Management | ${process.env.NEXT_PUBLIC_APP_NAME || "CapitalPay"}` };

export default async function BranchesPage() {
    const session = await auth();
    requirePermission(session, ["BRANCHES.VIEW", "BRANCHES.MANAGE"]);
    return <BranchesClient />;
}
