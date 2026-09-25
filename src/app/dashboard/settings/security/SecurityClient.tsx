'use client';

import { useState } from 'react';
import { PiShieldCheck, PiShieldWarning, PiCheckCircle, PiWarning, PiLock, PiKey } from 'react-icons/pi';
import { changeOwnPassword } from '../actions';
import { useToast } from '@/components/ui/ToastProvider';

const CARD_STYLE: React.CSSProperties = { border: '1px solid rgba(0,0,0,0.09)' };
const INPUT_CLASS = "w-full rounded-[6px] px-3 py-[9px] text-[13px] text-gray-900 outline-none focus:ring-1 focus:ring-[#6366F1] transition-colors bg-white";
const INPUT_STYLE: React.CSSProperties = { border: '1px solid rgba(0,0,0,0.09)' };

function ChangePasswordCard() {
    const { showToast } = useToast();
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (newPassword !== confirmPassword) {
            showToast("New password and confirmation don't match", 'error');
            return;
        }
        setIsSubmitting(true);
        try {
            const result = await changeOwnPassword(currentPassword, newPassword);
            if (result.success) {
                showToast('Password updated', 'success');
                setCurrentPassword('');
                setNewPassword('');
                setConfirmPassword('');
            } else {
                showToast(result.error || 'Failed to change password', 'error');
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="bg-white rounded-[8px]" style={CARD_STYLE}>
            <div className="px-5 py-4 flex items-center gap-3" style={{ borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
                <PiKey className="text-[22px] text-gray-400 shrink-0" />
                <div>
                    <h2 className="text-[13px] font-[600] text-gray-900">Change password</h2>
                    <p className="text-[12px] text-gray-400 mt-0.5">Update the password you use to sign in</p>
                </div>
            </div>
            <form onSubmit={handleSubmit} className="px-5 py-4 space-y-3">
                <div>
                    <label className="block text-[11.5px] font-[500] text-gray-500 mb-1.5">Current password</label>
                    <input type="password" required autoComplete="current-password" value={currentPassword}
                        onChange={e => setCurrentPassword(e.target.value)}
                        className={INPUT_CLASS} style={INPUT_STYLE} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                        <label className="block text-[11.5px] font-[500] text-gray-500 mb-1.5">New password</label>
                        <input type="password" required minLength={8} autoComplete="new-password" value={newPassword}
                            onChange={e => setNewPassword(e.target.value)}
                            className={INPUT_CLASS} style={INPUT_STYLE} />
                    </div>
                    <div>
                        <label className="block text-[11.5px] font-[500] text-gray-500 mb-1.5">Confirm new password</label>
                        <input type="password" required minLength={8} autoComplete="new-password" value={confirmPassword}
                            onChange={e => setConfirmPassword(e.target.value)}
                            className={INPUT_CLASS} style={INPUT_STYLE} />
                    </div>
                </div>
                <p className="text-[11px] text-gray-400">At least 8 characters.</p>
                <div className="flex justify-end pt-1">
                    <button type="submit" disabled={isSubmitting}
                        className="px-4 py-2 rounded-[6px] text-[12.5px] font-[500] text-white bg-[#6366F1] hover:bg-[#6366F1]/90 transition-colors disabled:opacity-50">
                        {isSubmitting ? 'Updating…' : 'Update password'}
                    </button>
                </div>
            </form>
        </div>
    );
}

export function SecurityClient({
    otpExempt,
    phoneNumber,
    loginEvents,
}: {
    otpExempt: boolean;
    phoneNumber: string | null;
    loginEvents: any[];
}) {
    return (
        <div className="space-y-4">
            <ChangePasswordCard />

            {/* SMS OTP status card */}
            <div className="bg-white rounded-[8px]" style={CARD_STYLE}>
                <div className="px-5 py-4 flex items-start justify-between"
                    style={{ borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
                    <div className="flex items-center gap-3">
                        {otpExempt
                            ? <PiShieldWarning className="text-[22px] text-orange-400 shrink-0" />
                            : <PiShieldCheck className="text-[22px] text-emerald-500 shrink-0" />
                        }
                        <div>
                            <h2 className="text-[13px] font-[600] text-gray-900">Login verification</h2>
                            <p className="text-[12px] text-gray-400 mt-0.5">
                                {otpExempt
                                    ? "This account is exempt from SMS login codes (master admin)."
                                    : phoneNumber
                                        ? `A one-time code is sent by SMS to ${phoneNumber} on every login.`
                                        : "A one-time code is sent by SMS on every login — no phone number is on file yet, contact a system administrator."}
                            </p>
                        </div>
                    </div>
                    <span className={`shrink-0 text-[10px] font-[500] px-2 py-0.5 rounded-[4px] ${!otpExempt ? 'text-emerald-600 bg-emerald-50' : 'text-gray-500 bg-gray-100'}`}
                        style={{ border: !otpExempt ? '1px solid rgba(16,185,129,0.2)' : '1px solid rgba(0,0,0,0.09)' }}>
                        {otpExempt ? 'Exempt' : 'Active'}
                    </span>
                </div>
            </div>

            {/* Login history */}
            <div className="bg-white rounded-[8px] overflow-hidden" style={CARD_STYLE}>
                <div className="px-5 py-4" style={{ borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
                    <h2 className="text-[13px] font-[600] text-gray-900">Recent Login Activity</h2>
                    <p className="text-[11.5px] text-gray-400 mt-0.5">Last {loginEvents.length} sign-in attempts</p>
                </div>
                <table className="w-full">
                    <thead style={{ background: '#FAFAFA', borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
                        <tr className="text-left">
                            <th className="px-5 py-3 text-[10.5px] font-[500] text-gray-400">Time</th>
                            <th className="px-5 py-3 text-[10.5px] font-[500] text-gray-400">Result</th>
                            <th className="px-5 py-3 text-[10.5px] font-[500] text-gray-400">Reason</th>
                            <th className="px-5 py-3 text-[10.5px] font-[500] text-gray-400">IP</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loginEvents.length === 0 && (
                            <tr>
                                <td colSpan={4} className="px-5 py-8 text-center text-[12.5px] text-gray-400">
                                    No login events yet.
                                </td>
                            </tr>
                        )}
                        {loginEvents.map((ev: any, idx: number) => (
                            <tr key={ev.id}
                                style={idx < loginEvents.length - 1 ? { borderBottom: '1px solid rgba(0,0,0,0.06)' } : {}}>
                                <td className="px-5 py-3 text-[12px] text-gray-600">
                                    {new Date(ev.createdAt).toLocaleString('en-KE', { dateStyle: 'short', timeStyle: 'short' })}
                                </td>
                                <td className="px-5 py-3">
                                    {ev.success
                                        ? <span className="flex items-center gap-1 text-emerald-600 text-[12px] font-[500]"><PiCheckCircle /> Success</span>
                                        : <span className="flex items-center gap-1 text-rose-500 text-[12px] font-[500]"><PiWarning /> Failed</span>
                                    }
                                </td>
                                <td className="px-5 py-3 text-[12px] text-gray-400">{ev.reason || '—'}</td>
                                <td className="px-5 py-3 text-[12px] font-mono text-gray-400">{ev.ipAddress || '—'}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Lockout notice */}
            <div className="rounded-[8px] px-5 py-4 flex items-start gap-3"
                style={{ border: '1px solid rgba(59,130,246,0.2)', background: 'rgba(239,246,255,0.7)' }}>
                <PiLock className="text-blue-500 text-[18px] shrink-0 mt-0.5" />
                <p className="text-[12.5px] text-blue-700">
                    <strong>Account lockout:</strong> After 5 consecutive failed login attempts, your account is automatically locked for 15 minutes. Contact a system administrator to unlock immediately.
                </p>
            </div>
        </div>
    );
}
