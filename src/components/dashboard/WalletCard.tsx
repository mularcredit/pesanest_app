"use client";

import { useState, useRef, useEffect } from "react";

import {
    PiX, PiCheck, PiArrowsLeftRight,
    PiSpinner, PiCaretDown, PiHandCoins,
    PiWifiHigh,
} from "react-icons/pi";
import { useToast } from "@/components/ui/ToastProvider";
import Image from "next/image";
import { createPortal } from "react-dom";
import Link from "next/link";

interface WalletCardProps {
    balance: number;
    currency?: string;
    branches: { id: string, name: string }[];
    isPaystack?: boolean;
    holderName?: string;
}

export function WalletCard({
    balance, currency = 'KES', branches, isPaystack = false, holderName = "Card Holder"
}: WalletCardProps) {
    const [isAllocateOpen, setIsAllocateOpen] = useState(false);

    const getCardDetails = () => {
        let hash = 0;
        for (let i = 0; i < holderName.length; i++) hash = holderName.charCodeAt(i) + ((hash << 5) - hash);
        const last4 = Math.abs(hash).toString().slice(0, 4).padEnd(4, '0');
        const d = new Date();
        d.setFullYear(d.getFullYear() + 3);
        return { last4, expiry: `${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear().toString().slice(-2)}` };
    };

    const { last4, expiry } = getCardDetails();
    const displayName = holderName.toUpperCase().slice(0, 22);

    return (
        <>
            <div className="w-full flex flex-col gap-2">

                {/* ── CARD ── */}
                <div className="w-full rounded-[16px] overflow-hidden relative"
                    style={{
                        aspectRatio: '1.586 / 1',
                        boxShadow: '0 8px 32px rgba(0,0,0,0.4), 0 2px 8px rgba(0,0,0,0.2)',
                    }}>


                    {/* Indigo base */}
                    <div className="absolute inset-0"
                        style={{ background: 'linear-gradient(135deg, #4f46e5 0%, #3730a3 35%, #1e1b4b 70%, #0a0618 100%)' }}
                    />
                    {/* Wave pattern overlay */}
                    <div className="absolute inset-0" style={{
                        backgroundImage: 'url(/card-waves.jpeg)',
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                        backgroundRepeat: 'no-repeat',
                        opacity: 0.18,
                        mixBlendMode: 'screen',
                    }} />

                    {/* Card body */}
                    <div className="absolute inset-0 p-5 flex flex-col justify-between">

                        {/* TOP: logo left · type label right */}
                        <div className="flex items-center justify-between">
                            <div style={{
                                width: 110,
                                height: 26,
                                backgroundColor: 'rgba(255,255,255,0.90)',
                                WebkitMaskImage: 'url(/off-logo.png)',
                                maskImage: 'url(/off-logo.png)',
                                WebkitMaskSize: 'contain',
                                maskSize: 'contain',
                                WebkitMaskRepeat: 'no-repeat',
                                maskRepeat: 'no-repeat',
                                WebkitMaskPosition: 'left center',
                                maskPosition: 'left center',
                            }} />
                            <span className="text-[8px] font-[700] uppercase tracking-[0.18em]"
                                style={{ color: 'rgba(255,255,255,0.35)' }}>
                                Corporate
                            </span>
                        </div>

                        {/* MID: EMV chip + NFC */}
                        <div className="flex items-center gap-2">
                            <Image
                                src="/EMV CHIP.png"
                                alt="EMV Chip"
                                width={52}
                                height={40}
                                className="object-contain"
                                style={{ filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.3)) brightness(1.1)' }}
                            />
                            <PiWifiHigh className="text-[20px] rotate-90"
                                style={{ color: 'rgba(255,255,255,0.45)' }} />
                        </div>

                        {/* BOTTOM */}
                        <div className="flex flex-col gap-2.5">

                            {/* Balance */}
                            <div>
                                <p className="text-[8px] font-[600] uppercase tracking-[0.12em] mb-1"
                                    style={{ color: 'rgba(255,255,255,0.4)' }}>
                                    Available Balance
                                </p>
                                <p className="text-[22px] font-[800] font-mono tabular-nums text-white leading-none"
                                    style={{ letterSpacing: '-0.02em' }}>
                                    {currency} {balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                </p>
                            </div>

                            {/* Card number */}
                            <p className="font-mono text-[11.5px] font-[500] tracking-[0.2em]"
                                style={{ color: 'rgba(255,255,255,0.75)' }}>
                                •••• &nbsp;•••• &nbsp;•••• &nbsp;{last4}
                            </p>

                            {/* Name · Valid Thru */}
                            <div className="flex items-end justify-between">
                                <div>
                                    <p className="text-[7px] font-[600] uppercase tracking-[0.1em] mb-0.5"
                                        style={{ color: 'rgba(255,255,255,0.35)' }}>
                                        Card Holder
                                    </p>
                                    <p className="text-[10.5px] font-[700] uppercase tracking-[0.07em] text-white">
                                        {displayName}
                                    </p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[7px] font-[600] uppercase tracking-[0.1em] mb-0.5"
                                        style={{ color: 'rgba(255,255,255,0.35)' }}>
                                        Valid Thru
                                    </p>
                                    <p className="font-mono text-[10.5px] font-[600]"
                                        style={{ color: 'rgba(255,255,255,0.85)' }}>
                                        {expiry}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                </div>

                {/* ── ACTIONS ── */}
                <div className="grid grid-cols-2 gap-2">
                    <Link href="/dashboard/requisitions"
                        className="flex items-center justify-center gap-1.5 py-2.5 rounded-[8px] text-[12px] font-[600] transition-all hover:brightness-105 active:scale-[0.98]"
                        style={{ background: '#6366f1', color: '#fff' }}>
                        <PiHandCoins className="text-[13px]" />
                        Requests
                    </Link>
                    <button onClick={() => setIsAllocateOpen(true)}
                        className="flex items-center justify-center gap-1.5 py-2.5 rounded-[8px] text-[12px] font-[600] text-gray-700 bg-white transition-all hover:bg-gray-50 active:scale-[0.98]"
                        style={{ border: '1px solid rgba(0,0,0,0.09)' }}>
                        <PiArrowsLeftRight className="text-[13px]" />
                        Allocate
                    </button>
                </div>
            </div>

            {isAllocateOpen && (
                <AllocateModal
                    onClose={() => setIsAllocateOpen(false)}
                    branches={branches}
                />
            )}
        </>
    );
}

// ── CUSTOM SELECT ──

function CustomSelect({ value, onChange, options, placeholder, inputClass, style }: {
    value: string;
    onChange: (val: string) => void;
    options: { value: string; label: string }[];
    placeholder: string;
    inputClass: string;
    style?: React.CSSProperties;
}) {
    const [isOpen, setIsOpen] = useState(false);
    const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 });
    const triggerRef = useRef<HTMLButtonElement>(null);
    const listRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (
                listRef.current && !listRef.current.contains(e.target as Node) &&
                triggerRef.current && !triggerRef.current.contains(e.target as Node)
            ) setIsOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const handleToggle = () => {
        if (!isOpen && triggerRef.current) {
            const r = triggerRef.current.getBoundingClientRect();
            setCoords({ top: r.bottom + 4, left: r.left, width: r.width });
        }
        setIsOpen(v => !v);
    };

    const selected = options.find(o => o.value === value);

    return (
        <>
            <button ref={triggerRef} type="button" onClick={handleToggle}
                className={inputClass + " flex items-center justify-between cursor-pointer text-left"}
                style={style}>
                <span className={selected ? 'text-gray-900' : 'text-gray-300'}>
                    {selected ? selected.label : placeholder}
                </span>
                <PiCaretDown className={`text-gray-400 text-[13px] shrink-0 transition-transform duration-150 ${isOpen ? 'rotate-180' : ''}`} />
            </button>
            {isOpen && typeof document !== 'undefined' && createPortal(
                <div ref={listRef}
                    style={{
                        position: 'fixed',
                        top: coords.top,
                        left: coords.left,
                        width: coords.width,
                        zIndex: 99999,
                        background: '#fff',
                        border: '1px solid rgba(0,0,0,0.09)',
                        borderRadius: '6px',
                        boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                        maxHeight: '200px',
                        overflowY: 'auto',
                    }}>
                    {options.map(opt => (
                        <button key={opt.value} type="button"
                            onClick={() => { onChange(opt.value); setIsOpen(false); }}
                            style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 12px', fontSize: '13px', color: value === opt.value ? '#6366F1' : '#374151', fontWeight: value === opt.value ? 500 : 400, background: 'transparent', border: 'none', cursor: 'pointer' }}
                            onMouseEnter={e => (e.currentTarget.style.background = '#f9fafb')}
                            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                            {opt.label}
                        </button>
                    ))}
                </div>,
                document.body
            )}
        </>
    );
}

// ── ALLOCATE MODAL ──

function AllocateModal({ onClose, branches }: {
    onClose: () => void;
    branches: { id: string; name: string }[];
}) {
    const { showToast } = useToast();
    const [selectedBranchId,   setSelectedBranchId]   = useState('');
    const [selectedBranchName, setSelectedBranchName] = useState('');
    const [amount,             setAmount]             = useState('');
    const [description,        setDescription]        = useState('');
    const [isSubmitting,       setIsSubmitting]       = useState(false);
    const [error,              setError]              = useState('');

    const LABEL  = "block text-[11.5px] font-[500] text-gray-400 mb-1.5";
    const INPUT  = "w-full rounded-[6px] px-3 py-[10px] text-[13px] text-gray-900 placeholder:text-gray-300 outline-none focus:ring-1 focus:ring-[#6366F1] bg-white";
    const BORDER: React.CSSProperties = { border: '1px solid rgba(0,0,0,0.09)' };

    const handleAllocate = async () => {
        if (!selectedBranchId || !amount) {
            setError('Please fill in all required fields');
            return;
        }
        setIsSubmitting(true);
        setError('');
        try {
            const res  = await fetch('/api/wallet/allocate', {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    branchId:    selectedBranchId,
                    amount:      parseFloat(amount),
                    description: description || `Allocation to ${selectedBranchName}`,
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to allocate funds');
            showToast(`Allocated KES ${amount} to ${selectedBranchName}`, 'success');
            setTimeout(() => window.location.reload(), 1000);
        } catch (err: any) {
            setError(err.message || 'Failed to allocate funds');
        } finally {
            setIsSubmitting(false);
        }
    };

    return createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/30" onClick={onClose} />
            <div className="relative bg-white rounded-[12px] w-full max-w-[460px] overflow-hidden flex flex-col max-h-[90vh] z-10"
                style={{ border: '1px solid rgba(0,0,0,0.09)', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>

                <div className="flex items-center justify-between px-6 py-4 shrink-0"
                    style={{ borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-[7px] bg-indigo-50 flex items-center justify-center">
                            <PiArrowsLeftRight className="text-[#6366F1] text-[15px]" />
                        </div>
                        <div>
                            <h3 className="text-[14px] font-[600] text-gray-900">Allocate Funds</h3>
                            <p className="text-[11.5px] text-gray-400">Distribute corporate funds to a branch</p>
                        </div>
                    </div>
                    <button onClick={onClose}
                        className="p-1.5 rounded-[5px] hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors">
                        <PiX className="text-[15px]" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
                    {error && (
                        <div className="px-4 py-3 rounded-[7px] text-[12.5px] font-[500] text-rose-600"
                            style={{ background: '#fff8f8', border: '1px solid rgba(239,68,68,0.2)' }}>
                            {error}
                        </div>
                    )}
                    <div>
                        <label className={LABEL}>Target Branch <span className="text-rose-400">*</span></label>
                        <CustomSelect
                            value={selectedBranchId}
                            onChange={val => {
                                setSelectedBranchId(val);
                                const b = branches.find(x => x.id === val);
                                if (b) setSelectedBranchName(b.name);
                            }}
                            options={branches.map(b => ({ value: b.id, label: b.name }))}
                            placeholder="Select target branch"
                            inputClass={INPUT}
                            style={BORDER}
                        />
                    </div>
                    <div>
                        <label className={LABEL}>Amount <span className="text-rose-400">*</span></label>
                        <input type="number" step="0.01" value={amount}
                            onChange={e => setAmount(e.target.value)}
                            className={INPUT + " pl-3"} style={BORDER}
                            placeholder="0.00" name="allocateAmtNew" id="allocateAmtNew"
                            autoComplete="off" data-form-type="other" />
                    </div>
                    <div>
                        <label className={LABEL}>Notes <span className="text-gray-300">(optional)</span></label>
                        <textarea value={description} onChange={e => setDescription(e.target.value)}
                            rows={2} placeholder="Allocation reasoning…"
                            className={INPUT + " resize-none"} style={BORDER}
                            name="allocateDescNew" id="allocateDescNew"
                            autoComplete="off" data-form-type="other" />
                    </div>
                </div>

                <div className="flex items-center justify-end gap-3 px-6 py-4 shrink-0"
                    style={{ borderTop: '1px solid rgba(0,0,0,0.07)' }}>
                    <button onClick={onClose}
                        className="px-4 py-2 text-[12.5px] font-[500] text-gray-600 rounded-[6px] hover:bg-gray-50 transition-colors"
                        style={{ border: '1px solid rgba(0,0,0,0.09)' }}>
                        Cancel
                    </button>
                    <button onClick={handleAllocate}
                        disabled={isSubmitting || !selectedBranchId || !amount}
                        className="flex items-center gap-2 px-5 py-2 text-[12.5px] font-[600] text-white bg-[#6366F1] rounded-[6px] hover:bg-indigo-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                        {isSubmitting
                            ? <><PiSpinner className="animate-spin text-[14px]" /> Processing…</>
                            : <><PiCheck className="text-[14px]" /> Confirm Allocation</>}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}
