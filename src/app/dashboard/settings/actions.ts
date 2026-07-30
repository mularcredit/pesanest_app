'use server';

import prisma from "@/lib/prisma";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const SettingsSchema = z.object({
    name: z.string().min(1, "Name is required"),
    phoneNumber: z.string().optional(),
    language: z.string().optional(),
    companyName: z.string().optional(),
    registrationNumber: z.string().optional(),
    headquartersAddress: z.string().optional(),
    enforceRequestClosure: z.string().optional(),
});

export async function updateSettings(formData: FormData) {
    const session = await auth();
    if (!session?.user?.id) {
        return { success: false, error: "Unauthorized" };
    }

    const rawData = {
        name: formData.get("name"),
        phoneNumber: formData.get("phoneNumber"),
        companyName: formData.get("companyName"),
        registrationNumber: formData.get("registrationNumber"),
        headquartersAddress: formData.get("headquartersAddress"),
        enforceRequestClosure: formData.get("enforceRequestClosure"),
    };

    try {
        const data = SettingsSchema.parse(rawData);
        const userRole = (session.user as any).role;
        
        console.log(`[Settings] Updating profile for user: ${session.user.email} (Role: ${userRole})`);

        // Update User Profile
        await prisma.user.update({
            where: { id: session.user.id },
            data: {
                name: data.name,
                phoneNumber: data.phoneNumber || null,
            }
        });

        const isAdmin = ['SYSTEM_ADMIN', 'FINANCE_APPROVER', 'SUPER_ADMIN', 'ADMIN'].includes(userRole);
        console.log(`[Settings] Is Admin check: ${isAdmin}`);

        // If Admin, Update Organization
        if (isAdmin) {
            const orgSettings = [
                { key: 'company_name', value: data.companyName },
                { key: 'registration_number', value: data.registrationNumber },
                { key: 'headquarters_address', value: data.headquartersAddress },
                { key: 'enforce_request_closure', value: data.enforceRequestClosure },
            ];

            console.log(`[Settings] Saving ${orgSettings.filter(i => i.value !== undefined).length} organization settings`);

            for (const item of orgSettings) {
                if (item.value !== undefined) {
                    await prisma.systemSetting.upsert({
                        where: { key: item.key },
                        update: { value: String(item.value) },
                        create: { key: item.key, value: String(item.value) },
                    });
                }
            }
        }

        revalidatePath("/dashboard/settings");
        revalidatePath("/dashboard"); // Also clear dashboard cache just in case
        
        return { success: true };
    } catch (error: any) {
        console.error("❌ Failed to update settings:", error);
        
        // Return more descriptive error for debugging
        const errorMessage = error.code === 'P1001' 
            ? "Database connection timed out. Please try again."
            : (error.message || "Failed to update settings");
            
        return { success: false, error: errorMessage };
    }
}
