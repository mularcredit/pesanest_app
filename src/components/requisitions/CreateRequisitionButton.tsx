"use client";

import { useRouter } from "next/navigation";
import { PiPlus } from "react-icons/pi";

export function CreateRequisitionButton() {
    const router = useRouter();

    return (
        <button
            onClick={() => router.push('/dashboard/requisitions/new')}
            className="px-4 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-md font-medium text-xs hover:bg-gray-50 transition-all flex items-center gap-2 shadow-none"
        >
            <PiPlus />
            <span>Create New Expense</span>
        </button>
    );
}
