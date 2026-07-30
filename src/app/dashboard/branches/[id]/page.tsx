import { notFound } from "next/navigation";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { requirePermission } from "@/lib/access-control";
import { BranchDetailClient } from "./BranchDetailClient";

export default async function BranchDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const session = await auth();
    requirePermission(session, ["BRANCHES.VIEW", "BRANCHES.MANAGE"]);

    const { id } = await params;

    const branch = await prisma.branch.findUnique({
        where: { id },
        include: {
            region: { select: { id: true, name: true, code: true } },
            teamLeader: {
                select: {
                    id: true,
                    name: true,
                    email: true,
                    phoneNumber: true,
                    position: true,
                    department: true,
                    role: true,
                    isActive: true,
                },
            },
            wallet: {
                include: {
                    transactions: { orderBy: { createdAt: "desc" }, take: 200 },
                },
            },
            _count: {
                select: { requisitions: true, vendors: true },
            },
        },
    });

    if (!branch) return notFound();

    const data = JSON.parse(JSON.stringify(branch));

    return <BranchDetailClient branch={data} />;
}
