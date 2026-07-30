import { BiShieldAlt, BiPlus } from "react-icons/bi";
import prisma from "@/lib/prisma";
import { PolicyManager } from "@/components/dashboard/PolicyManager";
import { auth } from "@/auth";
import { redirect } from "next/navigation";

export default async function PoliciesPage() {
    const session = await auth();
    if (!session?.user?.id) return redirect("/login");

    const policies = await prisma.policy.findMany({
        orderBy: { createdAt: 'desc' }
    });

    return (
        <div className="space-y-6 pb-24">
            <div>
                <h1 className="text-[20px] font-[600] text-gray-900 tracking-tight">Policies</h1>
                <p className="text-[12.5px] text-gray-400 mt-0.5">Automated compliance rules &amp; spend controls</p>
            </div>
            <PolicyManager policies={policies} />
        </div>
    );
}
