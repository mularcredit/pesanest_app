"use client";

import { useState } from "react";
import { PiPlus } from "react-icons/pi";
import { RecordPayableModal } from "@/components/accounting/RecordPayableModal";

interface PayablesHeaderActionsProps {
    vendors: Array<{ id: string; name: string }>;
}

export function PayablesHeaderActions({ vendors }: PayablesHeaderActionsProps) {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <>
            <button onClick={() => setIsOpen(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-[6px] text-[12.5px] font-[500] bg-[#6366F1] text-white hover:bg-indigo-600 transition-colors">
                <PiPlus className="text-[14px]" />
                Record Payable
            </button>

            {isOpen && (
                <RecordPayableModal vendors={vendors} onClose={() => setIsOpen(false)} />
            )}
        </>
    );
}
