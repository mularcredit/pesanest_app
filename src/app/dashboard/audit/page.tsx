import { auth } from "@/auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { requirePermission } from "@/lib/access-control";
import { AuditTrailClient } from "./AuditTrailClient";

export const dynamic = 'force-dynamic';

export default async function AuditPage() {
    const session = await auth();
    if (!session?.user) return redirect("/login");
    requirePermission(session, ['AUDIT.VIEW']);

    const [logs, totalRows, entityGroups, actionGroups] = await Promise.all([
        prisma.$queryRaw<any[]>`SELECT * FROM "AuditLog" ORDER BY "createdAt" DESC LIMIT 50`.catch(() => []),
        prisma.$queryRaw<{ count: bigint }[]>`SELECT COUNT(*) as count FROM "AuditLog"`.catch(() => [{ count: BigInt(0) }]),
        prisma.$queryRaw<{ entity: string }[]>`SELECT DISTINCT entity FROM "AuditLog" ORDER BY entity ASC`.catch(() => []),
        prisma.$queryRaw<{ action: string }[]>`SELECT DISTINCT action FROM "AuditLog" ORDER BY action ASC`.catch(() => []),
    ]);
    const total = Number(totalRows[0]?.count ?? 0);

    return (
        <div className="space-y-5 pb-24">
            <div>
                <h1 className="text-[20px] font-[600] text-gray-900 tracking-tight">Audit Trail</h1>
                <p className="text-[12.5px] text-gray-400 mt-0.5">
                    {total.toLocaleString()} event{total !== 1 ? 's' : ''} recorded
                </p>
            </div>
            <AuditTrailClient
                initialLogs={logs}
                initialTotal={total}
                entities={entityGroups.map((e: any) => e.entity)}
                actions={actionGroups.map((a: any) => a.action)}
            />
        </div>
    );
}
