"use client";

import { useRouter } from "next/navigation";
import { PiReceipt } from "react-icons/pi";

export function GlobalNewRequisitionButton() {
    const router = useRouter();

    return (
        <button
            onClick={() => router.push('/dashboard/requisitions/new')}
            className="px-3 py-2 rounded-lg border border-transparent transition-all group flex items-center gap-2 hover:border-purple-500/30 hover:bg-purple-500/5 hover:scale-105 bg-white/50"
            title="New Expense"
        >
            <PiReceipt className="text-lg transition-colors text-gray-500 group-hover:text-purple-600" />
            <span className="text-xs font-semibold transition-colors text-gray-500 group-hover:text-purple-600 hidden lg:inline">Expense</span>
        </button>
    );
}
