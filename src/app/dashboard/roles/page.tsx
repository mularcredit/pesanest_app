import prisma from "@/lib/prisma";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
    PiShieldCheck,
    PiPlus,
    PiUsers,
    PiLockKey,
    PiPencil,
    PiTrash,
    PiWarningCircle
} from "react-icons/pi";
import { requirePermission } from "@/lib/access-control";
import { SyncPermissionsButton } from "./SyncPermissionsButton";

export default async function RolesPage() {
    const session = await auth();

    // Roles management is restricted to SYSTEM_ADMIN only
    if ((session?.user as any)?.role !== 'SYSTEM_ADMIN') redirect('/dashboard');

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

    const CARD_STYLE: React.CSSProperties = { border: '1px solid rgba(0,0,0,0.09)' };

    return (
        <div className="space-y-6 pb-24">
            {/* Header */}
            <div className="flex items-start justify-between">
                <div>
                    <h1 className="text-[20px] font-[600] text-gray-900 tracking-tight">Roles</h1>
                    <p className="text-[12.5px] text-gray-400 mt-0.5">Manage user roles and access control</p>
                </div>
                <div className="flex items-center gap-2">
                    <SyncPermissionsButton />
                    {(session?.user as any).role === 'SYSTEM_ADMIN' && (
                        <Link
                            href="/dashboard/roles/new"
                            className="flex items-center gap-2 px-4 py-2 rounded-[6px] text-[12.5px] font-[500] bg-[#6366F1] text-white hover:bg-indigo-600 transition-colors"
                        >
                            <PiPlus className="text-[14px]" />
                            Create Role
                        </Link>
                    )}
                </div>
            </div>

            {/* Roles Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {roles.map(role => (
                    <div key={role.id} className="bg-white rounded-[8px] flex flex-col" style={CARD_STYLE}>
                        {/* Card header */}
                        <div className="px-5 py-4 flex items-start gap-3" style={{ borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
                            <div className="w-8 h-8 rounded-[7px] bg-emerald-50 flex items-center justify-center shrink-0">
                                <PiShieldCheck className="text-emerald-600 text-[15px]" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <h3 className="text-[13px] font-[600] text-gray-900 truncate">{role.name}</h3>
                                    {role.isSystem && (
                                        <span className="text-[9.5px] font-[500] px-1.5 py-0.5 rounded-[4px] bg-blue-50 text-blue-600 uppercase tracking-[0.05em]"
                                            style={{ border: '1px solid rgba(59,130,246,0.2)' }}>
                                            System
                                        </span>
                                    )}
                                </div>
                                <p className="text-[11.5px] text-gray-400 mt-0.5 truncate">{role.description || 'No description'}</p>
                            </div>
                        </div>

                        {/* Stats */}
                        <div className="px-5 py-3 grid grid-cols-2 gap-3" style={{ borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
                            <div className="flex items-center gap-2 text-[12.5px] text-gray-500">
                                <PiUsers className="text-gray-300 text-[14px]" />
                                <span><span className="font-[600] text-gray-900">{role._count.users}</span> users</span>
                            </div>
                            <div className="flex items-center gap-2 text-[12.5px] text-gray-500">
                                <PiLockKey className="text-gray-300 text-[14px]" />
                                <span><span className="font-[600] text-gray-900">{role.permissions.length}</span> permissions</span>
                            </div>
                        </div>

                        {/* Permissions preview */}
                        <div className="px-5 py-4 flex-1">
                            <p className="text-[10px] font-[500] uppercase tracking-[0.07em] text-gray-400 mb-2">Key Permissions</p>
                            <div className="flex flex-wrap gap-1">
                                {role.permissions.slice(0, 6).map(rp => (
                                    <span key={rp.permission.id}
                                        className="text-[9.5px] px-1.5 py-0.5 rounded-[4px] bg-gray-100 text-gray-500 font-mono">
                                        {rp.permission.resource}.{rp.permission.action}
                                    </span>
                                ))}
                                {role.permissions.length > 6 && (
                                    <span className="text-[9.5px] px-1.5 py-0.5 rounded-[4px] bg-gray-100 text-gray-400 font-[500]">
                                        +{role.permissions.length - 6} more
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="px-5 py-3 flex gap-2" style={{ borderTop: '1px solid rgba(0,0,0,0.07)' }}>
                            <Link
                                href={`/dashboard/roles/${role.id}`}
                                className="flex-1 py-1.5 px-3 text-[12.5px] font-[500] text-gray-600 bg-white rounded-[5px] flex items-center justify-center gap-1.5 hover:bg-gray-50 transition-colors"
                                style={{ border: '1px solid rgba(0,0,0,0.09)' }}
                            >
                                <PiPencil className="text-[13px]" />
                                Edit
                            </Link>
                            {!role.isSystem && (
                                <button
                                    className="py-1.5 px-3 text-[12.5px] font-[500] text-rose-500 bg-white rounded-[5px] flex items-center justify-center hover:bg-rose-50 transition-colors"
                                    style={{ border: '1px solid rgba(239,68,68,0.2)' }}
                                >
                                    <PiTrash className="text-[13px]" />
                                </button>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {/* Info panel — NO border-left */}
            <div className="bg-white rounded-[8px] px-5 py-4 flex items-start gap-4" style={CARD_STYLE}>
                <div className="w-8 h-8 rounded-[7px] bg-blue-50 flex items-center justify-center shrink-0">
                    <PiWarningCircle className="text-blue-500 text-[15px]" />
                </div>
                <div>
                    <p className="text-[13px] font-[600] text-gray-900 mb-1">About System Roles</p>
                    <p className="text-[12.5px] text-gray-400 leading-relaxed">
                        System roles (marked with a blue badge) are built-in and cannot be deleted. They provide baseline access levels for common user types.
                        You can create custom roles with specific permission combinations to match your organization's needs.
                    </p>
                </div>
            </div>
        </div>
    );
}
