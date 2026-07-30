import prisma from "@/lib/prisma";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { SettingsClient } from "./SettingsClient";
import { Suspense } from "react";

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function SettingsPage() {
    const session = await auth();
    if (!session?.user?.id) return redirect("/login");
    const userId = session.user.id;

    // Parallelize user and system settings fetch
    const [user, systemSettings] = await Promise.all([
        prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                department: true,
                position: true,
                phoneNumber: true
            }
        }),
        (prisma as any).systemSetting.findMany()
    ]);

    if (!user) return redirect("/login");

    const settingsMap = (systemSettings as any[]).reduce((acc: any, setting: any) => {
        acc[setting.key] = setting.value;
        return acc;
    }, {});

    const organizationSettings = {
        companyName: settingsMap['company_name'],
        registrationNumber: settingsMap['registration_number'],
        headquartersAddress: settingsMap['headquarters_address'],
        enforceRequestClosure: settingsMap['enforce_request_closure'] === 'true'
    };

    return (
        <Suspense fallback={<div>Loading settings...</div>}>
            <SettingsClient 
                user={user} 
                organizationSettings={organizationSettings}
            />
        </Suspense>
    );
}
