'use client';

import { useState, useEffect } from 'react';
import { getPendingUsers, approveUser, rejectUser } from '@/app/actions/admin';
import { PiCheck, PiX, PiUser, PiSpinner } from 'react-icons/pi';

const CARD_STYLE: React.CSSProperties = { border: '1px solid rgba(0,0,0,0.09)' };

function getInitials(name: string) {
    return name.split(/\s+/).map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();
}

export default function UserManagementPage() {
    const [users, setUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState<string | null>(null);

    useEffect(() => { loadUsers(); }, []);

    const loadUsers = async () => {
        setLoading(true);
        const res = await getPendingUsers();
        if (res.success) setUsers(res.data || []);
        setLoading(false);
    };

    const handleApprove = async (id: string) => {
        setProcessing(id);
        const res = await approveUser(id);
        if (res.success) { await loadUsers(); } else { alert('Failed to approve user'); }
        setProcessing(null);
    };

    const handleReject = async (id: string) => {
        if (!confirm('Are you sure you want to reject this user?')) return;
        setProcessing(id);
        const res = await rejectUser(id);
        if (res.success) { await loadUsers(); } else { alert('Failed to reject user'); }
        setProcessing(null);
    };

    return (
        <div className="space-y-6 pb-24">
            <div className="flex items-start justify-between">
                <div>
                    <h1 className="text-[20px] font-[600] text-gray-900 tracking-tight">Account Requests</h1>
                    <p className="text-[12.5px] text-gray-400 mt-0.5">Review and approve new user registrations.</p>
                </div>
                {users.length > 0 && (
                    <span className="inline-flex items-center gap-1.5 text-[12px] font-[500] text-[#6366F1] bg-indigo-50 px-3 py-1.5 rounded-[6px]"
                        style={{ border: '1px solid rgba(99,102,241,0.2)' }}>
                        <span className="w-1.5 h-1.5 rounded-full bg-[#6366F1] animate-pulse" />
                        {users.length} Pending
                    </span>
                )}
            </div>

            {loading ? (
                <div className="bg-white rounded-[8px] py-20 flex flex-col items-center" style={CARD_STYLE}>
                    <PiSpinner className="animate-spin text-[#6366F1] text-2xl mb-2" />
                    <p className="text-[12.5px] text-gray-400">Loading requests...</p>
                </div>
            ) : users.length === 0 ? (
                <div className="bg-white rounded-[8px] py-20 flex flex-col items-center" style={CARD_STYLE}>
                    <div className="w-10 h-10 rounded-[8px] bg-gray-50 flex items-center justify-center mb-3"
                        style={{ border: '1px solid rgba(0,0,0,0.07)' }}>
                        <PiUser className="text-gray-300 text-xl" />
                    </div>
                    <p className="text-[13px] font-[500] text-gray-700">No pending requests</p>
                    <p className="text-[12px] text-gray-400 mt-0.5">All caught up! Check back later.</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {users.map((user) => (
                        <div key={user.id} className="bg-white rounded-[8px] px-5 py-4 flex items-center justify-between" style={CARD_STYLE}>
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-[7px] bg-indigo-50 flex items-center justify-center text-[13px] font-[700] text-[#6366F1] shrink-0">
                                    {getInitials(user.name)}
                                </div>
                                <div>
                                    <h3 className="text-[13px] font-[600] text-gray-900">{user.name}</h3>
                                    <p className="text-[12px] text-gray-400">{user.email}</p>
                                    <div className="text-[10.5px] text-gray-300 mt-0.5 flex gap-2">
                                        <span>Position: {user.position || 'N/A'}</span>
                                        <span>·</span>
                                        <span>Requested: {new Date(user.createdAt).toLocaleDateString()}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                                <button
                                    onClick={() => handleReject(user.id)}
                                    disabled={!!processing}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] text-[12px] font-[500] text-rose-600 bg-white hover:bg-rose-50 transition-colors disabled:opacity-50"
                                    style={{ border: '1px solid rgba(239,68,68,0.2)' }}
                                >
                                    <PiX className="text-[13px]" /> Reject
                                </button>
                                <button
                                    onClick={() => handleApprove(user.id)}
                                    disabled={!!processing}
                                    className="flex items-center gap-1.5 px-4 py-1.5 rounded-[6px] text-[12px] font-[500] text-white bg-[#6366F1] hover:bg-indigo-600 transition-colors disabled:opacity-50"
                                >
                                    {processing === user.id
                                        ? <PiSpinner className="animate-spin text-[13px]" />
                                        : <PiCheck className="text-[13px]" />
                                    }
                                    Approve Access
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
