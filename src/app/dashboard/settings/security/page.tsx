import { auth } from "@/auth";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { SecurityClient } from "./SecurityClient";

export const dynamic = 'force-dynamic';

export default async function SecurityPage() {
    const session = await auth();
    if (!session?.user) return redirect("/login");

    const userRows = await prisma.$queryRaw<{ otpExempt: boolean; phoneNumber: string | null; idleTimeoutMinutes: number }[]>`
        SELECT "otpExempt", "phoneNumber", "idleTimeoutMinutes"
        FROM "User" WHERE id = ${session.user.id} LIMIT 1
    `.catch(() => [{ otpExempt: false, phoneNumber: null, idleTimeoutMinutes: 15 }]);
    const user = userRows[0] ?? { otpExempt: false, phoneNumber: null, idleTimeoutMinutes: 15 };

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
                idleTimeoutMinutes={user?.idleTimeoutMinutes ?? 15}
                loginEvents={loginEvents}
            />
        </div>
    );
}
