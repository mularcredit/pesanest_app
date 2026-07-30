"use client";

import { useState } from "react";
import { PiX, PiSpinner, PiArrowUpRight } from "react-icons/pi";
import { BiWallet } from "react-icons/bi";
import { useToast } from "@/components/ui/ToastProvider";
import { createPortal } from "react-dom";

interface TopUpModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export function TopUpModal({ isOpen, onClose }: TopUpModalProps) {
    const [amount, setAmount] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const { showToast } = useToast();

    if (!isOpen) return null;

    const handleTopUp = async () => {
        const numAmount = parseFloat(amount);
        if (isNaN(numAmount) || numAmount <= 0) {
            showToast('Please enter a valid amount', 'error');
            return;
        }
        setIsLoading(true);
        try {
            const res = await fetch('/api/wallet/topup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ amount: numAmount })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            if (data.authorization_url) {
                window.location.href = data.authorization_url;
            } else {
                throw new Error('Did not receive checkout URL');
            }
        } catch (error: any) {
            showToast(error.message || 'Failed to initialize top-up', 'error');
            setIsLoading(false);
        }
    };

    const handleClose = () => { onClose(); setAmount(''); };

    return createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/30" onClick={handleClose} />
            <div className="relative bg-white rounded-[12px] w-full max-w-[400px] overflow-hidden z-10"
                style={{ border: '1px solid rgba(0,0,0,0.09)', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>

                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4"
                    style={{ borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-[7px] bg-emerald-50 flex items-center justify-center">
                            <BiWallet className="text-emerald-600 text-[15px]" />
                        </div>
                        <div>
                            <h2 className="text-[14px] font-[600] text-gray-900">Top Up Wallet</h2>
                            <p className="text-[11.5px] text-gray-400">Add funds securely via Paystack</p>
                        </div>
                    </div>
                    <button onClick={handleClose}
                        className="p-1.5 rounded-[5px] hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors">
                        <PiX className="text-[15px]" />
                    </button>
                </div>

                {/* Body */}
                <div className="px-6 py-5 space-y-4">
                    <div>
                        <label className="block text-[11.5px] font-[500] text-gray-400 mb-1.5">Amount (KES)</label>
                        <div>
                            <input type="number" value={amount}
                                onChange={e => setAmount(e.target.value)}
                                className="w-full rounded-[6px] pl-3 pr-3 py-[10px] text-[14px] font-mono text-gray-900 placeholder:text-gray-300 outline-none focus:ring-1 focus:ring-emerald-500 bg-white"
                                style={{ border: '1px solid rgba(0,0,0,0.09)' }}
                                placeholder="0" />
                        </div>
                    </div>

                    {/* Quick presets */}
                    <div className="grid grid-cols-3 gap-2">
                        {[1000, 5000, 10000].map(preset => (
                            <button key={preset} type="button" onClick={() => setAmount(preset.toString())}
                                className="py-2 rounded-[6px] text-[12px] font-[500] text-gray-600 hover:bg-emerald-50 hover:text-emerald-700 transition-colors"
                                style={{ border: '1px solid rgba(0,0,0,0.09)' }}>
                                +{preset.toLocaleString()}
                            </button>
                        ))}
                    </div>

                    {/* Paystack badge */}
                    <div className="flex items-center gap-2 px-3 py-2.5 rounded-[7px] bg-gray-50/60"
                        style={{ border: '1px solid rgba(0,0,0,0.06)' }}>
                        <div className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                        <p className="text-[11.5px] text-gray-500">
                            You will be redirected to Paystack to complete the payment securely.
                        </p>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 px-6 py-4"
                    style={{ borderTop: '1px solid rgba(0,0,0,0.07)' }}>
                    <button onClick={handleClose}
                        className="px-4 py-2 text-[12.5px] font-[500] text-gray-600 rounded-[6px] hover:bg-gray-50 transition-colors"
                        style={{ border: '1px solid rgba(0,0,0,0.09)' }}>
                        Cancel
                    </button>
                    <button onClick={handleTopUp} disabled={isLoading || !amount}
                        className="flex items-center gap-2 px-5 py-2 text-[12.5px] font-[600] text-white bg-emerald-600 rounded-[6px] hover:bg-emerald-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                        {isLoading
                            ? <><PiSpinner className="animate-spin text-[13px]" /> Processing…</>
                            : <><PiArrowUpRight className="text-[14px]" /> Secure Checkout</>
                        }
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}
