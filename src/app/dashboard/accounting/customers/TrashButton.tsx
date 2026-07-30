"use client";

import { useState } from "react";
import { PiTrash, PiArrowCounterClockwise, PiSpinner } from "react-icons/pi";
import { useToast } from "@/components/ui/ToastProvider";
import { trashVendor, restoreVendor } from "@/app/actions/vendors";
import { trashCustomer, restoreCustomer } from "@/app/actions/customers";

interface TrashButtonProps {
    id: string;
    entityType: "vendor" | "customer";
    isRestore?: boolean;
}

export function TrashButton({ id, entityType, isRestore = false }: TrashButtonProps) {
    const { showToast } = useToast();
    const [isLoading, setIsLoading] = useState(false);

    const handleClick = async () => {
        setIsLoading(true);
        try {
            let result: any;
            if (entityType === "vendor") {
                result = isRestore ? await restoreVendor(id) : await trashVendor(id);
            } else {
                result = isRestore ? await restoreCustomer(id) : await trashCustomer(id);
            }

            if (result.success) {
                showToast(result.message, "success");
            } else {
                showToast(result.message || "Action failed", "error");
            }
        } catch (error) {
            showToast("An unexpected error occurred", "error");
        } finally {
            setIsLoading(false);
        }
    };

    if (isRestore) {
        return (
            <button
                onClick={handleClick}
                disabled={isLoading}
                className="py-1.5 px-3 rounded-md text-xs font-semibold text-emerald-600 bg-emerald-50 hover:bg-emerald-100 transition-all flex items-center gap-1.5"
                title="Restore item"
            >
                {isLoading ? <PiSpinner className="animate-spin" /> : <PiArrowCounterClockwise className="text-sm shadow-sm" />}
                Restore
            </button>
        );
    }

    return (
        <button
            onClick={handleClick}
            disabled={isLoading}
            className="p-2 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
            title="Move to Trash"
        >
            {isLoading ? <PiSpinner className="animate-spin" /> : <PiTrash className="text-lg" />}
        </button>
    );
}
