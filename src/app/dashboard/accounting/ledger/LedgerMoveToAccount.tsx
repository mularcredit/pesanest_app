"use client";

import { useState } from "react";
import { PiArrowsLeftRight } from "react-icons/pi";
import { MoveToAccountModal } from "@/components/requisitions/MoveToAccountModal";

interface LedgerMoveToAccountProps {
    entryId: string;
    description: string;
}

export function LedgerMoveToAccount({ entryId, description }: LedgerMoveToAccountProps) {
    const [open, setOpen] = useState(false);

    return (
        <>
            <button
                onClick={() => setOpen(true)}
                className="p-1.5 rounded-md hover:bg-indigo-50 text-slate-400 hover:text-[#6366F1] transition-all"
                title="Move to Account"
            >
                <PiArrowsLeftRight className="text-base" />
            </button>
            <MoveToAccountModal
                entry={open ? { id: entryId, title: description } : null}
                onClose={() => setOpen(false)}
            />
        </>
    );
}
