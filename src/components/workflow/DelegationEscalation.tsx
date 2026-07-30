'use client';

import { useState } from 'react';
import { PiUserSwitch, PiX } from 'react-icons/pi';
import { useRouter } from 'next/navigation';
import { CustomSelect } from "@/components/ui/CustomSelect";

interface DelegateModalProps {
    approvalId: string;
    itemTitle: string;
    onClose: () => void;
    onSuccess?: () => void;
}

export function DelegateModal({ approvalId, itemTitle, onClose, onSuccess }: DelegateModalProps) {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [delegateTo, setDelegateTo] = useState('');
    const [reason, setReason] = useState('');
    const [users, setUsers] = useState<Array<{ id: string; name: string; email: string; role: string }>>([]);
    const [searchQuery, setSearchQuery] = useState('');

    // Fetch users when search changes
    const searchUsers = async (query: string) => {
        if (query.length < 2) {
            setUsers([]);
            return;
        }

        try {
            const response = await fetch(`/api/users?search=${encodeURIComponent(query)}&limit=10`);
            const data = await response.json();
            setUsers(data.users || []);
        } catch (error) {
            console.error('Failed to search users:', error);
        }
    };

    const handleDelegate = async () => {
        if (!delegateTo || !reason) {
            alert('Please select a user and provide a reason');
            return;
        }

        setLoading(true);
        try {
            const response = await fetch(`/api/approvals/${approvalId}/delegate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ delegateTo, reason })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to delegate');
            }

            alert(data.message);
            onSuccess?.();
            router.refresh();
            onClose();
        } catch (error: any) {
            alert(error.message || 'Failed to delegate approval');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xl animate-fade-in">
            <div className="gds-glass max-w-lg w-full p-6 relative animate-scale-in">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center">
                            <PiUserSwitch className="text-xl text-cyan-500" />
                        </div>
                        <div>
                            <h3 className="text-lg font-heading font-semibold text-gds-text-main">
                                Delegate Approval
                            </h3>
                            <p className="text-xs text-gds-text-muted">{itemTitle}</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-[var(--gds-surface-bright)] rounded-xl transition-all"
                    >
                        <PiX className="text-xl text-gds-text-muted" />
                    </button>
                </div>

                {/* Search Users */}
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-semibold text-gds-text-main mb-2">
                            Delegate To
                        </label>
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => {
                                setSearchQuery(e.target.value);
                                searchUsers(e.target.value);
                            }}
                            placeholder="Search by name or email..."
                            className="w-full bg-[var(--gds-input-bg)] border border-[var(--gds-border)] rounded-xl py-3 px-4 text-sm focus:outline-none focus:border-cyan-500"
                        />

                        {/* User Results */}
                        {users.length > 0 && (
                            <div className="mt-2 max-h-48 overflow-y-auto space-y-1 border border-[var(--gds-border)] rounded-xl p-2 bg-[var(--gds-surface)]">
                                {users.map(user => (
                                    <button
                                        key={user.id}
                                        onClick={() => {
                                            setDelegateTo(user.id);
                                            setSearchQuery(user.name);
                                            setUsers([]);
                                        }}
                                        className="w-full text-left p-3 hover:bg-[var(--gds-surface-bright)] rounded-lg transition-all"
                                    >
                                        <p className="font-semibold text-sm text-gds-text-main">{user.name}</p>
                                        <p className="text-xs text-gds-text-muted">{user.email} • {user.role}</p>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Reason */}
                    <div>
                        <label className="block text-sm font-semibold text-gds-text-main mb-2">
                            Reason for Delegation
                        </label>
                        <textarea
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            placeholder="e.g., Out of office, conflict of interest..."
                            rows={3}
                            className="w-full bg-[var(--gds-input-bg)] border border-[var(--gds-border)] rounded-xl py-3 px-4 text-sm focus:outline-none focus:border-cyan-500 resize-none"
                        />
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3 pt-4">
                        <button
                            onClick={handleDelegate}
                            disabled={loading || !delegateTo || !reason}
                            className="flex-1 py-3 px-6 bg-cyan-500 text-white font-semibold rounded-xl hover:bg-cyan-600 transition-all shadow-lg shadow-cyan-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? 'Delegating...' : 'Delegate Approval'}
                        </button>
                        <button
                            onClick={onClose}
                            className="py-3 px-6 bg-[var(--gds-surface)] border border-[var(--gds-border)] text-gds-text-muted font-semibold rounded-xl hover:bg-[var(--gds-surface-bright)] transition-all"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

interface EscalationPanelProps {
    onTrigger?: () => void;
}

export function EscalationPanel({ onTrigger }: EscalationPanelProps) {
    const [loading, setLoading] = useState(false);
    const [action, setAction] = useState<'notify' | 'escalate' | 'auto-approve'>('notify');
    const [daysOverdue, setDaysOverdue] = useState(2);
    const [result, setResult] = useState<any>(null);

    const handleEscalate = async () => {
        setLoading(true);
        setResult(null);

        try {
            const response = await fetch('/api/workflow/escalate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action, daysOverdue })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to trigger escalation');
            }

            setResult(data.results);
            onTrigger?.();
        } catch (error: any) {
            alert(error.message || 'Failed to trigger escalation');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="gds-glass p-6 space-y-6">
            <div>
                <h2 className="text-lg font-semibold text-gds-text-main mb-2">Escalation Controls</h2>
                <p className="text-sm text-gds-text-muted">
                    Automatically handle overdue approvals
                </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-semibold text-gds-text-main mb-2">
                        Days Overdue
                    </label>
                    <input
                        type="number"
                        value={daysOverdue}
                        onChange={(e) => setDaysOverdue(parseInt(e.target.value))}
                        min={1}
                        max={30}
                        className="w-full bg-[var(--gds-input-bg)] border border-[var(--gds-border)] rounded-xl py-3 px-4 text-sm focus:outline-none focus:border-emerald-500"
                    />
                </div>

                <div>
                    <label className="block text-sm font-semibold text-gds-text-main mb-2">
                        Action
                    </label>
                    <CustomSelect
                        value={action}
                        onChange={val => setAction(val as any)}
                        options={[
                            { value: 'notify', label: 'Send Reminder' },
                            { value: 'escalate', label: 'Escalate to Manager' },
                            { value: 'auto-approve', label: 'Auto-Approve' },
                        ]}
                        className="w-full bg-[var(--gds-input-bg)] border border-[var(--gds-border)] rounded-xl py-3 px-4 text-sm focus:outline-none focus:border-emerald-500"
                    />
                </div>
            </div>

            <button
                onClick={handleEscalate}
                disabled={loading}
                className="w-full py-3 px-6 bg-amber-500 text-white font-semibold rounded-xl hover:bg-amber-600 transition-all shadow-lg shadow-amber-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
            >
                {loading ? 'Processing...' : 'Trigger Escalation'}
            </button>

            {result && (
                <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                    <h3 className="font-semibold text-sm text-emerald-500 mb-2">Escalation Complete</h3>
                    <div className="grid grid-cols-3 gap-4 text-xs">
                        <div>
                            <p className="text-gds-text-muted">Notified</p>
                            <p className="font-semibold text-gds-text-main">{result.notified}</p>
                        </div>
                        <div>
                            <p className="text-gds-text-muted">Escalated</p>
                            <p className="font-semibold text-gds-text-main">{result.escalated}</p>
                        </div>
                        <div>
                            <p className="text-gds-text-muted">Auto-Approved</p>
                            <p className="font-semibold text-gds-text-main">{result.autoApproved}</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
