"use client";

import { useState } from "react";
import { PiArrowUpRight } from "react-icons/pi";
import { TopUpModal } from "./TopUpModal";

export function TopUpButton() {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <>
            <button onClick={() => setIsOpen(true)}
                className="flex items-center gap-1.5 px-3 py-[7px] text-[12px] font-[500] text-white bg-[#6366F1] rounded-[6px] hover:bg-indigo-600 transition-colors">
                <PiArrowUpRight className="text-[13px]" />
                Top Up
            </button>
            <TopUpModal isOpen={isOpen} onClose={() => setIsOpen(false)} />
        </>
    );
}
