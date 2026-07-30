"use client";

import { useState } from "react";
import { PiTrash, PiSpinner } from "react-icons/pi";
import { useToast } from "@/components/ui/ToastProvider";
import { deleteVendor } from "@/app/actions/vendors";
import { deleteCustomer } from "@/app/actions/customers";
import { deleteRequisition } from "@/app/dashboard/requisitions/actions";
import { ConfirmationModal } from "@/components/ui/Modal";

interface DeleteEntityButtonProps {
    id: string;
    entityType: "vendor" | "customer" | "requisition";
    entityName: string;
    className?: string;
}

export function DeleteEntityButton({ id, entityType, entityName, className }: DeleteEntityButtonProps) {
    const { showToast } = useToast();
    const [isDeleting, setIsDeleting] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);

    const handleDelete = async () => {
        setIsDeleting(true);
        try {
            let result: any = { success: false, message: "Unknown entity type" };
            if (entityType === "vendor") {
                result = await deleteVendor(id);
            } else if (entityType === "customer") {
                result = await deleteCustomer(id);
            } else if (entityType === "requisition") {
                result = await deleteRequisition(id);
            }

            if (result.success) {
                showToast(result.message, "success");
                setShowConfirm(false);
            } else {
                showToast(result.message || "Failed to delete", "error");
            }
        } catch (error) {
            showToast("An unexpected error occurred", "error");
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <>
            <button
                onClick={() => setShowConfirm(true)}
                disabled={isDeleting}
                className={`p-2 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors ${className}`}
                title={`Delete ${entityType}`}
            >
                {isDeleting ? <PiSpinner className="animate-spin" /> : <PiTrash />}
            </button>

            <ConfirmationModal
                isOpen={showConfirm}
                onClose={() => setShowConfirm(false)}
                onConfirm={handleDelete}
                title={`Delete ${entityType.charAt(0).toUpperCase() + entityType.slice(1)}?`}
                description={`Are you sure you want to delete ${entityName}? This action cannot be undone.`}
                entityName={entityName}
                confirmText="Yes, Delete"
                variant="danger"
                isLoading={isDeleting}
            />
        </>
    );
}
