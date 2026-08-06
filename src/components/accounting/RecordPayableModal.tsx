"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { PiX, PiReceipt } from "react-icons/pi";
import { InvoiceForm } from "@/app/dashboard/invoices/new/InvoiceForm";

interface RecordPayableModalProps {
    vendors: Array<{ id: string; name: string }>;
    onClose: () => void;
}

export function RecordPayableModal({ vendors, onClose }: RecordPayableModalProps) {
    const [mounted, setMounted] = useState(false);
    useEffect(() => { setMounted(true); }, []);
    if (!mounted) return null;

    return createPortal(
        <div className="fixed inset-0 z-[9999] flex items-start justify-center p-4 overflow-y-auto">
            <div className="fixed inset-0 bg-black/30" onClick={onClose} />
            <div className="relative bg-white w-full max-w-4xl rounded-[12px] my-8"
                style={{ border: '1px solid rgba(0,0,0,0.09)', boxShadow: '0 8px 40px rgba(0,0,0,0.12)' }}>

                <div className="flex items-center justify-between px-6 py-4"
                    style={{ borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-[7px] bg-indigo-50 flex items-center justify-center shrink-0">
                            <PiReceipt className="text-[#6366F1] text-[15px]" />
                        </div>
                        <div>
                            <h3 className="text-[14px] font-[600] text-gray-900 leading-none">Record Payable</h3>
                            <p className="text-[12px] text-gray-400 mt-0.5">Enter details from a vendor invoice</p>
                        </div>
                    </div>
                    <button onClick={onClose}
                        className="p-1.5 rounded-[6px] text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors">
                        <PiX className="text-[16px]" />
                    </button>
                </div>

                <div className="px-6 py-5">
                    <InvoiceForm vendors={vendors} onSuccess={onClose} onCancel={onClose} />
                </div>
            </div>
        </div>,
        document.body
    );
}
