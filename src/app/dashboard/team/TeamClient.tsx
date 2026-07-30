'use client';

import { useState, useMemo } from 'react';
import { PiPlus, PiPencil, PiTrash, PiMagnifyingGlass, PiBriefcase, PiShieldCheck, PiEnvelopeSimple, PiPhone, PiBuildings } from 'react-icons/pi';
import { UserModal } from './UserModal';
import { toggleUserStatus, deleteUser } from './actions';
import { useToast } from '@/components/ui/ToastProvider';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';

const CARD_STYLE: React.CSSProperties = { border: '1px solid rgba(0,0,0,0.09)' };

const ROLE_LABELS: Record<string, string> = {
    EMPLOYEE: 'Employee',
    MANAGER: 'Manager',
    TEAM_LEADER: 'Branch Manager',
    REGIONAL_MANAGER: 'Regional Manager',
    FINANCE_WRITER: 'Finance Writer',
    FINANCE_APPROVER: 'Finance Approver',
    FINANCE_TEAM: 'Finance Team',
    SYSTEM_ADMIN: 'System Admin',
    CUSTOM: 'Custom Role',
};

const ROLE_META: Record<string, { cls: string; border: string }> = {
    SYSTEM_ADMIN:     { cls: 'text-purple-600 bg-purple-50',  border: 'rgba(147,51,234,0.2)' },
    TEAM_LEADER:      { cls: 'text-[#6366F1] bg-indigo-50',   border: 'rgba(99,102,241,0.2)' },
    REGIONAL_MANAGER: { cls: 'text-[#6366F1] bg-indigo-50',   border: 'rgba(99,102,241,0.2)' },
    MANAGER:          { cls: 'text-blue-600 bg-blue-50',       border: 'rgba(59,130,246,0.2)' },
    FINANCE_APPROVER: { cls: 'text-emerald-600 bg-emerald-50', border: 'rgba(16,185,129,0.2)' },
    FINANCE_WRITER:   { cls: 'text-teal-600 bg-teal-50',       border: 'rgba(20,184,166,0.2)' },
    DEFAULT:          { cls: 'text-gray-500 bg-gray-100',      border: 'rgba(0,0,0,0.09)' },
};

function getInitials(name: string) {
    return name.split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

interface TeamClientProps {
    initialUsers: any[];
}

export function TeamClient({ initialUsers }: TeamClientProps) {
    const [users, setUsers] = useState(initialUsers);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedUser, setSelectedUser] = useState<any>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const { showToast } = useToast();
    const router = useRouter();

    const filteredUsers = useMemo(() => {
        if (!searchQuery.trim()) return users;
        const q = searchQuery.toLowerCase();
        return users.filter(u =>
            u.name.toLowerCase().includes(q) ||
            u.email.toLowerCase().includes(q) ||
            (u.department && u.department.toLowerCase().includes(q)) ||
            (u.position && u.position.toLowerCase().includes(q)) ||
            (ROLE_LABELS[u.role] && ROLE_LABELS[u.role].toLowerCase().includes(q))
        );
    }, [users, searchQuery]);

    const handleCreate = () => { setSelectedUser(null); setIsModalOpen(true); };
    const handleEdit = (user: any) => { setSelectedUser(user); setIsModalOpen(true); };

    const handleToggleStatus = async (user: any) => {
        try {
            const newStatus = !user.isActive;
            const res = await toggleUserStatus(user.id, newStatus);
            if (res.success) {
                showToast(`User ${newStatus ? 'activated' : 'suspended'} successfully`, 'success');
                router.refresh();
                setUsers(prev => prev.map(u =>
                    u.id === user.id ? { ...u, isActive: newStatus, accountStatus: newStatus ? 'ACTIVE' : 'SUSPENDED' } : u
                ));
            } else {
                showToast(res.error || 'Failed to update status', 'error');
            }
        } catch {
            showToast('An error occurred', 'error');
        }
    };

    return (
        <div className="space-y-6">
            {/* Toolbar */}
            <div className="flex items-center justify-between gap-4">
                <div className="w-64">
                    <input
                        type="text"
                        placeholder="Search users..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="w-full pl-3 pr-4 py-[9px] rounded-[6px] text-[13px] text-gray-900 placeholder:text-gray-300 outline-none focus:ring-1 focus:ring-[#6366F1] transition-colors bg-white"
                        style={{ border: '1px solid rgba(0,0,0,0.09)' }}
                    />
                </div>
                <button
                    onClick={handleCreate}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-[6px] text-[12.5px] font-[500] bg-[#6366F1] text-white hover:bg-indigo-600 transition-colors shrink-0"
                >
                    <PiPlus className="text-[14px]" />
                    Create Account
                </button>
            </div>

            {/* Grid */}
            {filteredUsers.length === 0 ? (
                <div className="bg-white rounded-[8px] py-20 flex flex-col items-center" style={CARD_STYLE}>
                    <div className="w-10 h-10 rounded-[8px] bg-gray-50 flex items-center justify-center mb-3"
                        style={{ border: '1px solid rgba(0,0,0,0.07)' }}>
                        <PiShieldCheck className="text-gray-300 text-xl" />
                    </div>
                    <p className="text-[13px] font-[500] text-gray-700">No users found</p>
                    <p className="text-[12px] text-gray-400 mt-0.5">Try a different search or create a new account.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {filteredUsers.map(user => {
                        const roleMeta = ROLE_META[user.role] ?? ROLE_META.DEFAULT;
                        return (
                            <div key={user.id} className="bg-white rounded-[8px] flex flex-col group relative" style={CARD_STYLE}>
                                {/* Hover Actions */}
                                <div className="absolute top-3 right-3 z-10 hidden group-hover:flex items-center gap-1 bg-white p-1 rounded-[6px]"
                                    style={{ border: '1px solid rgba(0,0,0,0.09)', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
                                    <button
                                        onClick={() => handleEdit(user)}
                                        className="p-1.5 rounded-[5px] text-gray-400 hover:bg-indigo-50 hover:text-[#6366F1] transition-colors"
                                        title="Edit User"
                                    >
                                        <PiPencil size={13} />
                                    </button>
                                    <button
                                        onClick={async () => {
                                            if (confirm('Are you sure you want to delete this user?')) {
                                                const res = await deleteUser(user.id);
                                                if (res.success) {
                                                    showToast('User deleted successfully', 'success');
                                                    setUsers(prev => prev.filter(u => u.id !== user.id));
                                                    router.refresh();
                                                } else {
                                                    showToast(res.error || 'Failed to delete user', 'error');
                                                }
                                            }
                                        }}
                                        className="p-1.5 rounded-[5px] text-gray-400 hover:bg-rose-50 hover:text-rose-600 transition-colors"
                                        title="Delete User"
                                    >
                                        <PiTrash size={13} />
                                    </button>
                                </div>

                                {/* Card Header */}
                                <div className="px-4 py-4 flex items-start gap-3" style={{ borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
                                    <div className="w-9 h-9 rounded-[7px] bg-indigo-50 flex items-center justify-center text-[13px] font-[700] text-[#6366F1] shrink-0">
                                        {getInitials(user.name)}
                                    </div>
                                    <div className="flex-1 min-w-0 pr-8">
                                        <h3 className="text-[13px] font-[600] text-gray-900 truncate">{user.name}</h3>
                                        <div className="flex items-center gap-1 mt-0.5 text-[11px] text-gray-400 truncate">
                                            <PiEnvelopeSimple className="shrink-0" />
                                            <span className="truncate">{user.email}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Card Body */}
                                <div className="px-4 py-4 flex-1 space-y-3">
                                    <span className={cn('inline-flex items-center gap-1 text-[10px] font-[500] px-2 py-0.5 rounded-[4px] uppercase tracking-[0.05em]', roleMeta.cls)}
                                        style={{ border: `1px solid ${roleMeta.border}` }}>
                                        <PiShieldCheck className="text-[10px]" />
                                        {user.customRole?.name || ROLE_LABELS[user.role] || user.role}
                                    </span>

                                    {(user.department || user.position) && (
                                        <div className="flex items-start gap-2 text-[12px]">
                                            <PiBriefcase className="text-gray-300 text-[13px] shrink-0 mt-0.5" />
                                            <div>
                                                {user.department && <p className="font-[500] text-gray-700 text-[12px]">{user.department}</p>}
                                                {user.position && <p className="text-[11.5px] text-gray-400">{user.position}</p>}
                                            </div>
                                        </div>
                                    )}

                                    {user.leadBranch && (
                                        <div className="flex items-center gap-2 text-[12px] text-[#6366F1]">
                                            <PiBuildings className="text-[13px] shrink-0" />
                                            <span className="font-[500] truncate">
                                                {user.leadBranch.name}
                                                <span className="opacity-60 text-[11px] ml-1">({user.leadBranch.code})</span>
                                            </span>
                                        </div>
                                    )}

                                    {user.phoneNumber && (
                                        <div className="flex items-center gap-2 text-[11.5px] text-gray-400">
                                            <PiPhone className="text-[13px] shrink-0" />
                                            <span>{user.phoneNumber}</span>
                                        </div>
                                    )}
                                </div>

                                {/* Card Footer */}
                                <div className="px-4 py-3 flex justify-between items-center" style={{ borderTop: '1px solid rgba(0,0,0,0.07)' }}>
                                    <div className="flex items-center gap-1.5">
                                        <div className={`w-1.5 h-1.5 rounded-full ${user.isActive ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                                        <span className={`text-[10.5px] font-[500] uppercase tracking-[0.05em] ${user.isActive ? 'text-emerald-600' : 'text-rose-600'}`}>
                                            {user.accountStatus}
                                        </span>
                                    </div>
                                    <button
                                        onClick={() => handleToggleStatus(user)}
                                        className={cn(
                                            'px-2.5 py-1 rounded-[5px] text-[11px] font-[500] transition-colors',
                                            user.isActive
                                                ? 'bg-rose-50 text-rose-600 hover:bg-rose-100'
                                                : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                                        )}
                                    >
                                        {user.isActive ? 'Suspend' : 'Activate'}
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            <UserModal
                isOpen={isModalOpen}
                onClose={() => { setIsModalOpen(false); setSelectedUser(null); }}
                user={selectedUser}
            />
        </div>
    );
}
