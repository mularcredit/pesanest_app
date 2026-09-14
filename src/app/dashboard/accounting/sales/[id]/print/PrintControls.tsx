"use client";

import { PiPrinter, PiArrowLeft } from "react-icons/pi";

export function PrintControls() {
    return (
        <>
            <button
                onClick={() => window.history.back()}
                className="inline-flex items-center gap-1.5 rounded-[8px] border border-gray-200 bg-white px-4 py-2 text-[12.5px] font-[500] text-gray-600 hover:bg-gray-50"
            >
                <PiArrowLeft className="text-[14px]" /> Back
            </button>
            <button
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 rounded-[8px] bg-indigo-600 px-4 py-2 text-[12.5px] font-[600] text-white hover:bg-indigo-700"
            >
                <PiPrinter className="text-[14px]" /> Download / Print (Save as PDF)
            </button>
        </>
    );
}
