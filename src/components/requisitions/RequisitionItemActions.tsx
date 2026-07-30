"use client";

import { useState } from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { PiReceipt, PiHandCoins, PiX, PiCheckCircle, PiWarningCircle } from "react-icons/pi";
import { createItemPaymentBatch } from "@/app/dashboard/requisitions/actions";

interface RequisitionItemActionsProps {
    item: {
        id: string;
        title: string;
        quantity: number;
        unitPrice: number;
        totalPrice: number;
        status: string;
        category: string;
    };
    currency: string;
    isPrivileged: boolean;
}

function formatCurrency(amount: number, currency: string = 'KES') {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount);
}

export function RequisitionItemActions({ item, currency, isPrivileged }: RequisitionItemActionsProps) {
    const router = useRouter();
    const [showPayModal, setShowPayModal] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [result, setResult] = useState<{ success?: boolean; message?: string } | null>(null);

    const handlePay = async () => {
        setIsProcessing(true);
        setResult(null);
        try {
            const res = await createItemPaymentBatch(item.id);
            setResult(res);
            if (res.success) {
                setTimeout(() => {
                    setShowPayModal(false);
                    setResult(null);
                    router.refresh();
                }, 1800);
            }
        } catch (e: any) {
            setResult({ success: false, message: e.message || "Unexpected error" });
        } finally {
            setIsProcessing(false);
        }
    };

    const itemTotal = item.quantity * item.unitPrice;
    const canPay = isPrivileged && ["APPROVED", "PENDING"].includes(item.status.toUpperCase());

    return (
        <>
            <div className="flex items-center gap-1.5">
                {/* Voucher button — always visible */}
                <Link
                    href={`/receipt-studio?itemId=${item.id}`}
                    className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-semibold text-gray-600 bg-white border border-gray-200 rounded-md hover:bg-gray-50 hover:border-gray-300 transition-all whitespace-nowrap"
                    title="Generate voucher for this item"
                >
                    <PiReceipt className="text-xs" />
                    Voucher
                </Link>

                {/* Pay button — only for privileged users on payable items */}
                {canPay && (
                    <button
                        onClick={() => { setResult(null); setShowPayModal(true); }}
                        className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-semibold text-white bg-[#6366F1] border border-[#6366F1] rounded-md hover:bg-[#6366F1]/90 transition-all whitespace-nowrap"
                        title="Create payment for this item"
                    >
                        <PiHandCoins className="text-xs" />
                        Pay Item
                    </button>
                )}
            </div>

            {/* Pay Confirmation Modal */}
            {showPayModal && typeof document !== "undefined" && createPortal(
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-sm overflow-hidden">
                        {/* Header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-[#6366F1]/10 flex items-center justify-center">
                                    <PiHandCoins className="text-lg text-[#6366F1]" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-semibold text-gray-900">Pay Single Item</h3>
                                    <p className="text-[10px] text-gray-400 uppercase tracking-widest font-semibold">Payment Request</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowPayModal(false)}
                                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-all"
                            >
                                <PiX className="text-lg" />
                            </button>
                        </div>

                        {/* Body */}
                        <div className="px-6 py-5 space-y-4">
                            {/* Item Summary */}
                            <div className="bg-[#6366F1]/5 border border-[#6366F1]/15 rounded-xl p-4">
                                <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-1">Item</p>
                                <p className="text-sm font-semibold text-gray-900 mb-0.5">{item.title}</p>
                                <p className="text-[10px] text-gray-500">{item.category} · Qty {item.quantity} @ {formatCurrency(item.unitPrice, currency)}</p>
                                <div className="mt-3 pt-3 border-t border-[#6366F1]/10 flex items-center justify-between">
                                    <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Total</span>
                                    <span className="text-lg font-semibold text-[#6366F1]">{formatCurrency(itemTotal, currency)}</span>
                                </div>
                            </div>

                            <p className="text-xs text-gray-500 leading-relaxed">
                                This will create a payment batch for <span className="font-semibold text-gray-900">{formatCurrency(itemTotal, currency)}</span> pending finance authorization. Only this item will be included.
                            </p>

                            {/* Result feedback */}
                            {result && (
                                <div className={`flex items-start gap-2 p-3 rounded-lg text-xs font-medium ${result.success ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
                                    {result.success
                                        ? <PiCheckCircle className="text-base shrink-0 mt-0.5" />
                                        : <PiWarningCircle className="text-base shrink-0 mt-0.5" />}
                                    <span>{result.message}</span>
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-end gap-3">
                            <button
                                onClick={() => setShowPayModal(false)}
                                disabled={isProcessing}
                                className="px-4 py-2 text-xs font-semibold text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-all"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handlePay}
                                disabled={isProcessing || result?.success === true}
                                className="px-5 py-2 text-xs font-semibold text-white bg-[#6366F1] rounded-lg hover:bg-[#6366F1]/90 transition-all disabled:opacity-50 flex items-center gap-2"
                            >
                                {isProcessing ? (
                                    <>
                                        <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                        Processing...
                                    </>
                                ) : result?.success ? (
                                    <>
                                        <PiCheckCircle />
                                        Done!
                                    </>
                                ) : (
                                    <>
                                        <PiHandCoins />
                                        Confirm Payment
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </>
    );
}
