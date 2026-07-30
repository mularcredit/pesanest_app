import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";

// GET - List all roles with their permissions
export async function GET(req: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        const user = session.user as any;
        if (user.role !== 'SYSTEM_ADMIN') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const roles = await prisma.role.findMany({
            include: {
                permissions: {
                    include: {
                        permission: true
                    }
                },
                _count: {
                    select: { users: true }
                }
            },
            orderBy: { name: 'asc' }
        });

        // Transform structure for easier frontend consumption
        const formattedRoles = roles.map(role => ({
            id: role.id,
            name: role.name,
            description: role.description,
            isSystem: role.isSystem,
            userCount: role._count.users,
            maxApprovalLimit: role.maxApprovalLimit,
            permissions: role.permissions.map(rp => rp.permission)
        }));

        return NextResponse.json({ roles: formattedRoles });

    } catch (error) {
        console.error('Fetch Roles Error:', error);
        return NextResponse.json({ error: 'Failed' }, { status: 500 });
    }
}

// POST - Create a new role
export async function POST(req: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        if ((session.user as any).role !== 'SYSTEM_ADMIN') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const body = await req.json();
        const { name, description, permissionIds, maxApprovalLimit } = body;

        const role = await prisma.role.create({
            data: {
                name,
                description,
                maxApprovalLimit: maxApprovalLimit ? parseFloat(maxApprovalLimit) : null,
                permissions: {
                    create: permissionIds.map((pid: string) => ({
                        permission: { connect: { id: pid } }
                    }))
                }
            }
        });

        return NextResponse.json({ success: true, role });

    } catch (error) {
        console.error('Create Role Error:', error);
        return NextResponse.json({ error: 'Failed' }, { status: 500 });
    }
}

// PUT - Update a role
export async function PUT(req: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        if ((session.user as any).role !== 'SYSTEM_ADMIN') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const body = await req.json();
        const { id, name, description, permissionIds, maxApprovalLimit } = body;

        // Clean up existing permissions
        await prisma.rolePermission.deleteMany({
            where: { roleId: id }
        });

        const role = await prisma.role.update({
            where: { id },
            data: {
                name,
                description,
                maxApprovalLimit: maxApprovalLimit ? parseFloat(maxApprovalLimit) : null,
                permissions: {
                    create: permissionIds.map((pid: string) => ({
                        permission: { connect: { id: pid } }
                    }))
                }
            }
        });

        return NextResponse.json({ success: true, role });

    } catch (error) {
        console.error('Update Role Error:', error);
        return NextResponse.json({ error: 'Failed' }, { status: 500 });
    }
}

// DELETE - Delete a role
export async function DELETE(req: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: { role: true, customRole: { select: { isSystem: true } } }
        });

        const isAdmin = user?.role === 'SYSTEM_ADMIN' || user?.customRole?.isSystem;
        if (!isAdmin) {
            return NextResponse.json({ error: 'Only System Admins can delete roles' }, { status: 403 });
        }

        const { searchParams } = new URL(req.url);
        const id = searchParams.get('id');

        if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

        const role = await prisma.role.findUnique({ where: { id } });
        if (role?.isSystem) {
            return NextResponse.json({ error: 'Cannot delete system roles' }, { status: 403 });
        }

        await prisma.role.delete({ where: { id } });

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error('Delete Role Error:', error);
        return NextResponse.json({ error: 'Failed' }, { status: 500 });
    }
}
