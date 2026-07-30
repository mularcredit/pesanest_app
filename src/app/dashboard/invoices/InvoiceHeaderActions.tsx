"use client";

import { useState } from "react";
import Link from "next/link";
import { PiPlus, PiUploadSimple } from "react-icons/pi";
import { QuickInvoiceModal } from "@/components/dashboard/QuickInvoiceModal";

export function InvoiceHeaderActions() {
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);

    return (
        <div className="flex items-center gap-2.5">
            <button onClick={() => setIsUploadModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-[6px] text-[12.5px] font-[500] text-gray-600 hover:bg-gray-50 transition-colors"
                style={{ border: '1px solid rgba(0,0,0,0.09)' }}>
                <PiUploadSimple className="text-[14px]" />
                Quick Upload
            </button>
            <Link href="/dashboard/invoices/new"
                className="flex items-center gap-2 px-4 py-2 rounded-[6px] text-[12.5px] font-[500] bg-[#6366F1] text-white hover:bg-indigo-600 transition-colors">
                <PiPlus className="text-[14px]" />
                Record Invoice
            </Link>

            <QuickInvoiceModal isOpen={isUploadModalOpen} onClose={() => setIsUploadModalOpen(false)} />
        </div>
    );
}
