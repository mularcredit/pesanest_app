'use client';

import { useState } from 'react';
import { PiShieldCheck, PiShieldWarning, PiSpinner, PiQuestion } from 'react-icons/pi';

interface EtrReceiptInputProps {
    value: string;
    onChange: (val: string) => void;
    onVerified: (verified: boolean, result: any) => void;
    expenseId?: string;
}

export function EtrReceiptInput({ value, onChange, onVerified, expenseId }: EtrReceiptInputProps) {
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<any>(null);

    const handleVerify = async () => {
        if (!value.trim()) return;
        setLoading(true);
        setResult(null);
        try {
            const res = await fetch('/api/accounting/etims/verify-receipt', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ etrNumber: value.trim(), expenseId }),
            });
            const data = await res.json();
            setResult(data);
            onVerified(data.valid === true, data);
        } catch {
            setResult({ valid: false, error: 'Network error — could not reach verification service' });
            onVerified(false, null);
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        onChange(e.target.value);
        if (result) {
            setResult(null);
            onVerified(false, null);
        }
    };

    return (
        <div className="space-y-2">
            <label className="block text-[11px] font-semibold text-gray-700 uppercase tracking-widest">
                Vendor ETR / eTIMS Number
                <span className="ml-1 text-gray-400 font-normal normal-case tracking-normal">(from vendor receipt)</span>
            </label>

            <div className="flex gap-2">
                <input
                    type="text"
                    value={value}
                    onChange={handleChange}
                    placeholder="e.g. ETIMS-000012345 or KRA-ETR-..."
                    className="flex-1 px-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300 font-mono placeholder-gray-300 bg-white"
                />
                <button
                    type="button"
                    onClick={handleVerify}
                    disabled={loading || !value.trim()}
                    className="px-3 py-2 text-xs font-semibold rounded-lg bg-indigo-500 text-white hover:bg-indigo-600 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 transition-colors"
                >
                    {loading ? <PiSpinner className="animate-spin text-sm" /> : <PiShieldCheck className="text-sm" />}
                    {loading ? 'Checking…' : 'Verify'}
                </button>
            </div>

            {result && (
                <div className={`flex items-start gap-2 p-2.5 rounded-lg border text-[11px] ${
                    result.valid
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                        : 'bg-red-50 border-red-200 text-red-700'
                }`}>
                    {result.valid
                        ? <PiShieldCheck className="text-emerald-600 mt-0.5 shrink-0 text-sm" />
                        : <PiShieldWarning className="text-red-500 mt-0.5 shrink-0 text-sm" />
                    }
                    <div className="space-y-0.5">
                        {result.valid ? (
                            <>
                                <p className="font-semibold">ETR verified with KRA</p>
                                {result.vendorName && <p>Vendor: <span className="font-mono">{result.vendorName}</span></p>}
                                {result.vendorPin && <p>PIN: <span className="font-mono">{result.vendorPin}</span></p>}
                                {result.receiptDate && <p>Date: {result.receiptDate}</p>}
                                {result.totalAmount != null && result.totalAmount > 0 && (
                                    <p>Amount: KSh {Number(result.totalAmount).toLocaleString()}</p>
                                )}
                                {result.error && <p className="text-amber-700 mt-1 italic">{result.error}</p>}
                            </>
                        ) : (
                            <p className="font-semibold">{result.error || 'ETR number not found in KRA records'}</p>
                        )}
                    </div>
                </div>
            )}

            {!result && (
                <p className="text-[10px] text-gray-400 flex items-center gap-1">
                    <PiQuestion className="text-xs" />
                    Enter the ETR number printed on the vendor receipt and click Verify to confirm with KRA.
                </p>
            )}
        </div>
    );
}
