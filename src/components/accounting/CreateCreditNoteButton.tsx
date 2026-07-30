"use client";

import { useState } from "react";
import { CreateCreditNoteModal } from "@/components/accounting/CreateCreditNoteModal";
import { ManageCreditNotesModal } from "@/components/accounting/ManageCreditNotesModal";
import { Button } from "@/components/ui/Button";
import { PiReceipt, PiClockCounterClockwise } from "react-icons/pi";

interface Sale {
    id: string;
    invoiceNumber: string;
    totalAmount: number;
    issueDate: Date;
    status: string;
}

interface CreateCreditNoteButtonProps {
    customerId: string;
    customerName: string;
    currency: string;
    sales?: Sale[];
}

export function CreateCreditNoteButton({
    customerId,
    customerName,
    currency,
    sales = []
}: CreateCreditNoteButtonProps) {
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);

    return (
        <div className="flex items-center gap-2">
            <Button
                variant="outline"
                onClick={() => setIsHistoryModalOpen(true)}
                className="flex items-center gap-2 border-dashed border-gray-300 text-gray-600 hover:bg-gray-50 hover:border-gray-400 text-xs"
            >
                <PiClockCounterClockwise className="text-lg" />
                Credit history
            </Button>

            <Button
                onClick={() => setIsCreateModalOpen(true)}
                className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white shadow-lg shadow-amber-500/20 text-xs"
            >
                <PiReceipt className="text-lg" />
                Credit Note
            </Button>

            <CreateCreditNoteModal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
                customerId={customerId}
                customerName={customerName}
                currency={currency}
                sales={sales}
            />

            <ManageCreditNotesModal
                isOpen={isHistoryModalOpen}
                onClose={() => setIsHistoryModalOpen(false)}
                customerId={customerId}
                customerName={customerName}
            />
        </div>
    );
}
