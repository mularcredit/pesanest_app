"use client";

import { useState } from "react";
import { PiX, PiSpinner } from "react-icons/pi";
import { BiCoinStack } from "react-icons/bi";
import { useToast } from "@/components/ui/ToastProvider";
import { createPortal } from "react-dom";

export function VirtualTopUpButton() {
    const [isOpen, setIsOpen] = useState(false);
    const [amount, setAmount] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const { showToast } = useToast();

    const handleTopUp = async () => {
        const numAmount = parseFloat(amount);
        if (isNaN(numAmount) || numAmount <= 0) {
            showToast('Please enter a valid amount', 'error');
            return;
        }
        setIsLoading(true);
        try {
            const res = await fetch('/api/wallet/virtual-topup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ amount: numAmount })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            showToast(`Added KES ${numAmount.toLocaleString()} virtual funds`, 'success');
            setIsOpen(false);
            setAmount('');
            setTimeout(() => window.location.reload(), 600);
        } catch (error: any) {
            showToast(error.message || 'Failed to add virtual funds', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const handleClose = () => { setIsOpen(false); setAmount(''); };

    return (
        <>
            <button onClick={() => setIsOpen(true)}
                className="flex items-center gap-1.5 px-3 py-[7px] text-[12px] font-[500] text-gray-600 rounded-[6px] hover:bg-gray-50 transition-colors"
                style={{ border: '1px solid rgba(0,0,0,0.09)' }}
                title="Admin only — credits internal balance directly, no real payment">
                <BiCoinStack className="text-[13px]" />
                Virtual Funds
            </button>

            {isOpen && createPortal(
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/30" onClick={handleClose} />
                    <div className="relative bg-white rounded-[12px] w-full max-w-[400px] overflow-hidden z-10"
                        style={{ border: '1px solid rgba(0,0,0,0.09)', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>

                        {/* Header */}
                        <div className="flex items-center justify-between px-6 py-4"
                            style={{ borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-[7px] bg-indigo-50 flex items-center justify-center">
                                    <BiCoinStack className="text-[#6366F1] text-[15px]" />
                                </div>
                                <div>
                                    <h2 className="text-[14px] font-[600] text-gray-900">Add Virtual Funds</h2>
                                    <p className="text-[11.5px] text-gray-400">Credits internal balance — no real payment</p>
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
                                        className="w-full rounded-[6px] pl-3 pr-3 py-[10px] text-[14px] font-mono text-gray-900 placeholder:text-gray-300 outline-none focus:ring-1 focus:ring-[#6366F1] bg-white"
                                        style={{ border: '1px solid rgba(0,0,0,0.09)' }}
                                        placeholder="0" />
                                </div>
                            </div>

                            {/* Quick presets */}
                            <div className="grid grid-cols-3 gap-2">
                                {[10000, 100000, 1000000].map(preset => (
                                    <button key={preset} type="button" onClick={() => setAmount(preset.toString())}
                                        className="py-2 rounded-[6px] text-[12px] font-[500] text-gray-600 hover:bg-indigo-50 hover:text-[#6366F1] transition-colors"
                                        style={{ border: '1px solid rgba(0,0,0,0.09)' }}>
                                        +{(preset / 1000).toFixed(0)}K
                                    </button>
                                ))}
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
                                className="flex items-center gap-2 px-5 py-2 text-[12.5px] font-[600] text-white bg-[#6366F1] rounded-[6px] hover:bg-indigo-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                                {isLoading
                                    ? <><PiSpinner className="animate-spin text-[13px]" /> Adding…</>
                                    : 'Add Funds'
                                }
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </>
    );
}
