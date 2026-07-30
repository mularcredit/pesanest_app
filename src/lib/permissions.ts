import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";

// Helper function to check if user has a specific permission
export async function hasPermission(userId: string, resource: string, action: string): Promise<boolean> {
    try {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: {
                customRole: {
                    include: {
                        permissions: {
                            include: {
                                permission: true
                            }
                        }
                    }
                }
            }
        });

        if (!user) return false;

        // System Admin has all permissions
        if (user.role === 'SYSTEM_ADMIN') return true;

        // Check custom role permissions
        if (user.customRole) {
            return user.customRole.permissions.some(
                rp => rp.permission.resource === resource && rp.permission.action === action
            );
        }

        // Fallback to legacy role-based logic
        // This maintains backward compatibility
        const legacyPermissions: Record<string, string[][]> = {
            'EMPLOYEE': [
                ['DASHBOARD', 'VIEW'],
                ['EXPENSES', 'VIEW_OWN'],
                ['EXPENSES', 'CREATE'],
                ['REQUISITIONS', 'VIEW_OWN'],
                ['REQUISITIONS', 'CREATE']
            ],
            'MANAGER': [
                ['DASHBOARD', 'VIEW'],
                ['EXPENSES', 'VIEW_TEAM'],
                ['EXPENSES', 'APPROVE'],
                ['REQUISITIONS', 'VIEW_TEAM'],
                ['REQUISITIONS', 'APPROVE']
            ],
            'FINANCE_APPROVER': [
                ['DASHBOARD', 'VIEW'],
                ['EXPENSES', 'VIEW_ALL'],
                ['EXPENSES', 'APPROVE'],
                ['INVOICES', 'VIEW_ALL'],
                ['INVOICES', 'APPROVE'],
                ['PAYMENTS', 'AUTHORIZE']
            ],
            'FINANCE_TEAM': [
                ['DASHBOARD', 'VIEW'],
                ['EXPENSES', 'VIEW_ALL'],
                ['INVOICES', 'VIEW_ALL'],
                ['INVOICES', 'CREATE'],
                ['PAYMENTS', 'CREATE_BATCH']
            ]
        };

        const userPerms = legacyPermissions[user.role] || [];
        return userPerms.some(([r, a]) => r === resource && a === action);

    } catch (error) {
        console.error('Permission check error:', error);
        return false;
    }
}

// Middleware-style permission checker for API routes
export async function requirePermission(resource: string, action: string) {
    const session = await auth();
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const allowed = await hasPermission(session.user.id, resource, action);
    if (!allowed) {
        return NextResponse.json({ error: 'Forbidden: Insufficient permissions' }, { status: 403 });
    }

    return null; // No error, permission granted
}
