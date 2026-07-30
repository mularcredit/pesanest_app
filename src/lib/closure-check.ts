import prisma from "@/lib/prisma";

export async function checkEnforceClosure(userId: string): Promise<{ blocked: boolean; message?: string }> {
    try {
        // Parallelize all checks
        const [user, setting, activeExpenses, activeReqs] = await Promise.all([
            prisma.user.findUnique({ where: { id: userId }, select: { role: true } }),
            (prisma as any).systemSetting.findUnique({ where: { key: 'enforce_request_closure' } }),
            prisma.expense.count({ where: { userId, status: { notIn: ['CLOSED', 'REJECTED', 'PAID', 'COMPLETED', 'FULFILLED', 'APPROVED'] } } }),
            (prisma as any).requisition.count({ where: { userId, status: { notIn: ['CLOSED', 'REJECTED', 'PAID', 'COMPLETED', 'FULFILLED', 'APPROVED'] } } })
        ]);

        // 1. If user is an Admin - Admins are EXEMPT
        const isAdmin = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN' || user?.role === 'SYSTEM_ADMIN';
        if (isAdmin) return { blocked: false };

        // 2. Check the global setting
        if (!setting || setting.value !== 'true') {
            return { blocked: false };
        }

        // 3. Check counts
        if (activeExpenses > 0 || activeReqs > 0) {
            return {
                blocked: true,
                message: `You have ${activeExpenses + activeReqs} open request(s) that must be finalized (Paid/Closed) before creating a new one.`
            };
        }

        return { blocked: false };
    } catch (e) {
        console.error("Closure check error:", e);
        return { blocked: false }; // Fail open for safety
    }
}
