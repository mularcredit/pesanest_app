'use client';

import { useState } from 'react';
import { useToast } from '@/components/ui/ToastProvider';
import { useRouter } from 'next/navigation';
import { PiShieldCheck, PiShieldWarning, PiCheckCircle, PiWarning, PiLock } from 'react-icons/pi';
import Image from 'next/image';

const CARD_STYLE: React.CSSProperties = { border: '1px solid rgba(0,0,0,0.09)' };

export function SecurityClient({
    totpEnabled,
    loginEvents,
}: {
    totpEnabled: boolean;
    loginEvents: any[];
}) {
    const router = useRouter();
    const { showToast } = useToast();
    const [setupState, setSetupState] = useState<'idle' | 'setup' | 'disable'>('idle');
    const [qrDataUrl, setQrDataUrl] = useState('');
    const [secret, setSecret] = useState('');
    const [tokenInput, setTokenInput] = useState('');
    const [loading, setLoading] = useState(false);

    const startSetup = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/auth/2fa/setup');
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            setQrDataUrl(data.qrDataUrl);
            setSecret(data.secret);
            setSetupState('setup');
        } catch (err: any) {
            showToast(err.message, 'error');
        } finally { setLoading(false); }
    };

    const verifyAndEnable = async () => {
        if (tokenInput.length !== 6) { showToast('Enter the 6-digit code', 'error'); return; }
        setLoading(true);
        try {
            const res = await fetch('/api/auth/2fa/setup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: tokenInput })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            showToast('2FA enabled successfully', 'success');
            setSetupState('idle');
            setTokenInput('');
            router.refresh();
        } catch (err: any) {
            showToast(err.message, 'error');
        } finally { setLoading(false); }
    };

    const disable2FA = async () => {
        if (tokenInput.length !== 6) { showToast('Enter the 6-digit code to confirm', 'error'); return; }
        setLoading(true);
        try {
            const res = await fetch('/api/auth/2fa/disable', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: tokenInput })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            showToast('2FA disabled', 'success');
            setSetupState('idle');
            setTokenInput('');
            router.refresh();
        } catch (err: any) {
            showToast(err.message, 'error');
        } finally { setLoading(false); }
    };

    const codeInput = (value: string, onChange: (v: string) => void) => (
        <input
            type="text"
            inputMode="numeric"
            maxLength={6}
            value={value}
            onChange={e => onChange(e.target.value.replace(/\D/g, ''))}
            placeholder="000000"
            className="w-[130px] rounded-[6px] px-3 py-[10px] text-[13px] text-gray-900 text-center tracking-[0.3em] font-mono placeholder:text-gray-300 outline-none focus:ring-1 focus:ring-[#6366F1] bg-white"
            style={CARD_STYLE}
        />
    );

    return (
        <div className="space-y-4">
            {/* 2FA Card */}
            <div className="bg-white rounded-[8px]" style={CARD_STYLE}>
                <div className="px-5 py-4 flex items-start justify-between"
                    style={{ borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
                    <div className="flex items-center gap-3">
                        {totpEnabled
                            ? <PiShieldCheck className="text-[22px] text-emerald-500 shrink-0" />
                            : <PiShieldWarning className="text-[22px] text-orange-400 shrink-0" />
                        }
                        <div>
                            <h2 className="text-[13px] font-[600] text-gray-900">Two-Factor Authentication</h2>
                            <p className="text-[12px] text-gray-400 mt-0.5">
                                {totpEnabled
                                    ? 'Your account is protected with TOTP 2FA.'
                                    : 'Add an extra layer of security to your account.'}
                            </p>
                        </div>
                    </div>
                    <span className={`shrink-0 text-[10px] font-[500] px-2 py-0.5 rounded-[4px] ${totpEnabled ? 'text-emerald-600 bg-emerald-50' : 'text-gray-500 bg-gray-100'}`}
                        style={{ border: totpEnabled ? '1px solid rgba(16,185,129,0.2)' : '1px solid rgba(0,0,0,0.09)' }}>
                        {totpEnabled ? 'Enabled' : 'Disabled'}
                    </span>
                </div>

                <div className="px-5 py-4">
                    {setupState === 'idle' && (
                        <div className="flex gap-2">
                            {!totpEnabled ? (
                                <button onClick={startSetup} disabled={loading}
                                    className="px-4 py-2 rounded-[6px] text-[12.5px] font-[500] text-white bg-[#6366F1] hover:bg-indigo-600 transition-colors disabled:opacity-60">
                                    Set up 2FA
                                </button>
                            ) : (
                                <button onClick={() => setSetupState('disable')}
                                    className="px-4 py-2 rounded-[6px] text-[12.5px] font-[500] text-gray-600 bg-white hover:bg-gray-50 transition-colors"
                                    style={CARD_STYLE}>
                                    Disable 2FA
                                </button>
                            )}
                        </div>
                    )}

                    {setupState === 'setup' && (
                        <div className="space-y-4 pt-4" style={{ borderTop: '1px solid rgba(0,0,0,0.07)' }}>
                            <p className="text-[12.5px] text-gray-600">
                                Scan this QR code with <strong>Google Authenticator</strong>, <strong>Authy</strong>, or any TOTP app.
                            </p>
                            {qrDataUrl && (
                                <div className="flex gap-6 items-start flex-wrap">
                                    <Image src={qrDataUrl} alt="2FA QR Code" width={160} height={160}
                                        className="rounded-[6px]" style={CARD_STYLE} />
                                    <div>
                                        <p className="text-[11.5px] text-gray-400 mb-1.5">Or enter manually:</p>
                                        <code className="block bg-gray-50 px-3 py-2 rounded-[6px] text-[12px] font-mono break-all text-gray-700"
                                            style={{ border: '1px solid rgba(0,0,0,0.07)' }}>
                                            {secret}
                                        </code>
                                    </div>
                                </div>
                            )}
                            <div className="flex gap-2 items-center flex-wrap">
                                {codeInput(tokenInput, setTokenInput)}
                                <button onClick={verifyAndEnable} disabled={loading || tokenInput.length !== 6}
                                    className="px-4 py-2 rounded-[6px] text-[12.5px] font-[500] text-white bg-[#6366F1] hover:bg-indigo-600 transition-colors disabled:opacity-60">
                                    {loading ? 'Verifying…' : 'Verify & Enable'}
                                </button>
                                <button onClick={() => { setSetupState('idle'); setTokenInput(''); }}
                                    className="px-4 py-2 rounded-[6px] text-[12.5px] font-[500] text-gray-600 bg-white hover:bg-gray-50 transition-colors"
                                    style={CARD_STYLE}>
                                    Cancel
                                </button>
                            </div>
                        </div>
                    )}

                    {setupState === 'disable' && (
                        <div className="space-y-3 pt-4" style={{ borderTop: '1px solid rgba(0,0,0,0.07)' }}>
                            <p className="text-[12.5px] text-gray-600">
                                Enter your current authenticator code to confirm disabling 2FA.
                            </p>
                            <div className="flex gap-2 items-center flex-wrap">
                                {codeInput(tokenInput, setTokenInput)}
                                <button onClick={disable2FA} disabled={loading || tokenInput.length !== 6}
                                    className="px-4 py-2 rounded-[6px] text-[12.5px] font-[500] text-gray-600 bg-white hover:bg-gray-50 transition-colors disabled:opacity-60"
                                    style={CARD_STYLE}>
                                    {loading ? 'Disabling…' : 'Confirm Disable'}
                                </button>
                                <button onClick={() => { setSetupState('idle'); setTokenInput(''); }}
                                    className="px-4 py-2 rounded-[6px] text-[12.5px] font-[500] text-gray-600 bg-white hover:bg-gray-50 transition-colors"
                                    style={CARD_STYLE}>
                                    Cancel
                                </button>
                            </div>
                        </div>
                    )}
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
