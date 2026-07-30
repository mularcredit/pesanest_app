"use client";

import { useState } from "react";
import { RecordPaymentModal } from "@/components/accounting/RecordPaymentModal";
import { ManagePaymentsModal } from "@/components/accounting/ManagePaymentsModal";
import { Button } from "@/components/ui/Button";
import { PiPlus, PiClockCounterClockwise } from "react-icons/pi";

interface Sale {
    id: string;
    invoiceNumber: string;
    totalAmount: number;
    issueDate: Date;
    status: string;
}

interface RecordPaymentButtonProps {
    customerId: string;
    customerName: string;
    currency: string;
    unpaidSales?: Sale[];
}

export function RecordPaymentButton({
    customerId,
    customerName,
    currency,
    unpaidSales = []
}: RecordPaymentButtonProps) {
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);

    return (
        <div className="flex items-center gap-2">
            <Button
                variant="outline"
                onClick={() => setIsHistoryModalOpen(true)}
                className="flex items-center gap-2 border-dashed border-gray-300 text-gray-600 hover:bg-gray-50 hover:border-gray-400 text-xs"
            >
                <PiClockCounterClockwise className="text-lg" />
                History
            </Button>

            <Button
                onClick={() => setIsPaymentModalOpen(true)}
                className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/20 text-xs"
            >
                <PiPlus className="text-lg" />
                Record Payment
            </Button>

            <RecordPaymentModal
                isOpen={isPaymentModalOpen}
                onClose={() => setIsPaymentModalOpen(false)}
                customerId={customerId}
                customerName={customerName}
                currency={currency}
                sales={unpaidSales}
            />

            <ManagePaymentsModal
                isOpen={isHistoryModalOpen}
                onClose={() => setIsHistoryModalOpen(false)}
                customerId={customerId}
                customerName={customerName}
            />
        </div>
    );
}
