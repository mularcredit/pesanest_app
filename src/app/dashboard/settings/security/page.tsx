import { auth } from "@/auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { SecurityClient } from "./SecurityClient";

export const dynamic = 'force-dynamic';

export default async function SecurityPage() {
    const session = await auth();
    if (!session?.user) return redirect("/login");

    const userRows = await prisma.$queryRaw<{ otpExempt: boolean; phoneNumber: string | null }[]>`
        SELECT "otpExempt", "phoneNumber"
        FROM "User" WHERE id = ${session.user.id} LIMIT 1
    `.catch(() => [{ otpExempt: false, phoneNumber: null }]);
    const user = userRows[0] ?? { otpExempt: false, phoneNumber: null };

    const loginEvents = await prisma.$queryRaw<any[]>`
        SELECT * FROM "LoginEvent"
        WHERE "userId" = ${session.user.id}
        ORDER BY "createdAt" DESC LIMIT 20
    `.catch(() => []);

    return (
        <div className="space-y-6 pb-24 max-w-2xl">
            <div>
                <h1 className="text-[20px] font-[600] text-gray-900 tracking-tight">Account Security</h1>
                <p className="text-[12.5px] text-gray-400 mt-0.5">Two-factor authentication and login history</p>
            </div>
            <SecurityClient
                otpExempt={user?.otpExempt || false}
                phoneNumber={user?.phoneNumber || null}
                loginEvents={loginEvents}
            />
        </div>
    );
}
