import prisma from "@/lib/prisma";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { requirePermission } from "@/lib/access-control";
import { VendorsClient } from "./VendorsClient";

export default async function VendorsPage() {
    const session = await auth();
    if (!session?.user?.id) return redirect("/login");
    requirePermission(session, ['VENDORS.VIEW']);

    const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        include: { leadBranch: true }
    });

    const isBranchManager = user?.role === 'TEAM_LEADER';
    const activeBranchId = user?.leadBranch?.id || user?.branchId || null;

    const whereClause = isBranchManager
        ? { branchId: activeBranchId } // Only their branch's vendors
        : {}; // Admins see all vendors

    const vendors = await (prisma.vendor as any).findMany({
        where: whereClause,
        orderBy: { name: 'asc' }
    });

    return <VendorsClient vendors={vendors} />;
}
