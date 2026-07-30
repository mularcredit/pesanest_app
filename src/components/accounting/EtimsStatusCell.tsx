'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PiShieldCheck, PiShieldWarning, PiArrowsCounterClockwise, PiProhibit, PiCheckCircle, PiWarning, PiSpinner } from 'react-icons/pi';

const STATUS_CONFIG: Record<string, { label: string; cls: string; border: string; icon: any }> = {
    ACCEPTED:     { label: 'eTIMS OK',   cls: 'text-emerald-700 bg-emerald-50', border: 'rgba(16,185,129,0.2)',  icon: PiShieldCheck },
    PENDING:      { label: 'Pending',    cls: 'text-amber-700 bg-amber-50',     border: 'rgba(245,158,11,0.2)', icon: PiArrowsCounterClockwise },
    SUBMITTED:    { label: 'Submitted',  cls: 'text-blue-700 bg-blue-50',       border: 'rgba(59,130,246,0.2)', icon: PiArrowsCounterClockwise },
    FAILED:       { label: 'Failed',     cls: 'text-rose-700 bg-rose-50',       border: 'rgba(239,68,68,0.2)',  icon: PiShieldWarning },
    NOT_REQUIRED: { label: 'No VAT',     cls: 'text-gray-500 bg-gray-50',       border: 'rgba(0,0,0,0.09)',     icon: PiProhibit },
};

export function EtimsStatusCell({ saleId, etimsStatus, etimsInvoiceNumber, taxAmount }: {
    saleId: string;
    etimsStatus: string;
    etimsInvoiceNumber: string | null;
    taxAmount: number;
}) {
    const router = useRouter();
    const [loading, setLoading] = useState<'verify' | 'resubmit' | null>(null);
    const [result, setResult] = useState<any>(null);
    const [showDetail, setShowDetail] = useState(false);

    const config = STATUS_CONFIG[etimsStatus] || STATUS_CONFIG['PENDING'];
    const Icon = config.icon;
    const canVerify = etimsStatus === 'ACCEPTED' && !!etimsInvoiceNumber;
    const canResubmit = etimsStatus === 'FAILED' || etimsStatus === 'PENDING';

    const verify = async (e: React.MouseEvent) => {
        e.stopPropagation(); e.preventDefault();
        setLoading('verify'); setResult(null);
        try {
            const res = await fetch(`/api/accounting/sales/${saleId}/etims-verify`, { method: 'POST' });
            setResult(await res.json()); setShowDetail(true);
        } finally { setLoading(null); }
    };

    const resubmit = async (e: React.MouseEvent) => {
        e.stopPropagation(); e.preventDefault();
        setLoading('resubmit'); setResult(null);
        try {
            const res = await fetch(`/api/accounting/sales/${saleId}/etims-resubmit`, { method: 'POST' });
            const data = await res.json();
            setResult(data); setShowDetail(true);
            if (data.success) router.refresh();
        } finally { setLoading(null); }
    };

    return (
        <div className="flex flex-col gap-1 items-start">
            <div className="flex items-center gap-1.5">
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-[4px] text-[10px] font-[500] ${config.cls}`}
                    style={{ border: `1px solid ${config.border}` }}>
                    <Icon className="text-[11px]" />
                    {config.label}
                </span>
                {etimsInvoiceNumber && (
                    <span className="text-[10px] font-mono text-gray-400">
                        {etimsInvoiceNumber.slice(0, 16)}{etimsInvoiceNumber.length > 16 ? '…' : ''}
                    </span>
                )}
            </div>

            <div className="flex gap-1">
                {canVerify && (
                    <button onClick={verify} disabled={loading !== null}
                        className="text-[10px] text-[#6366F1] hover:text-indigo-700 flex items-center gap-0.5 disabled:opacity-50">
                        {loading === 'verify'
                            ? <><PiSpinner className="animate-spin" /> Checking…</>
                            : <><PiCheckCircle /> Verify</>}
                    </button>
                )}
                {canResubmit && (
                    <button onClick={resubmit} disabled={loading !== null}
                        className="text-[10px] text-amber-600 hover:text-amber-800 flex items-center gap-0.5 disabled:opacity-50">
                        {loading === 'resubmit'
                            ? <><PiSpinner className="animate-spin" /> Submitting…</>
                            : <><PiArrowsCounterClockwise /> Resubmit</>}
                    </button>
                )}
            </div>

            {showDetail && result && (
                <div className={`mt-1 p-2.5 rounded-[6px] text-[10px] max-w-xs ${result.valid ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800'}`}
                    style={{ border: result.valid ? '1px solid rgba(16,185,129,0.2)' : '1px solid rgba(239,68,68,0.2)' }}
                    onClick={e => { e.stopPropagation(); e.preventDefault(); }}>
                    <div className="flex justify-between items-start gap-2">
                        <div className="space-y-0.5">
                            {result.valid
                                ? <p className="font-[600] flex items-center gap-1"><PiCheckCircle /> KRA record confirmed</p>
                                : <p className="font-[600] flex items-center gap-1"><PiWarning /> {result.error}</p>}
                            {result.etimsInvoiceNumber && <p>eTIMS #: <span className="font-mono">{result.etimsInvoiceNumber}</span></p>}
                            {result.controlUnit && <p>Control Unit: <span className="font-mono">{result.controlUnit}</span></p>}
                            {result.totalAmount != null && <p>KRA Amount: KES {Number(result.totalAmount).toLocaleString()}</p>}
                            {result.taxAmount != null && <p>KRA VAT: KES {Number(result.taxAmount).toLocaleString()}</p>}
                            {result.error && result.valid && <p className="text-amber-700 mt-1">{result.error}</p>}
                        </div>
                        <button onClick={() => setShowDetail(false)} className="text-gray-400 hover:text-gray-600 shrink-0">✕</button>
                    </div>
                </div>
            )}
        </div>
    );
}
