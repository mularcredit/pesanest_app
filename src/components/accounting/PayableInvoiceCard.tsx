"use client";

import { useState } from "react";
import { PiBuildings, PiCurrencyDollar } from "react-icons/pi";
import { cn } from "@/lib/utils";
import { PayInvoiceModal } from "@/components/accounting/PayInvoiceModal";

interface Invoice {
    id: string;
    invoiceNumber: string;
    amount: number;
    dueDate: Date;
    status: string;
    vendor: {
        name: string;
        currency: string;
        bankName?: string | null;
        bankAccount?: string | null;
    };
    currency: string;
}

interface PayableInvoiceCardProps {
    invoice: Invoice;
    variant?: 'overdue' | 'upcoming';
}

const CARD_STYLE: React.CSSProperties = { border: '1px solid rgba(0,0,0,0.09)' };

export function PayableInvoiceCard({ invoice, variant = 'upcoming' }: PayableInvoiceCardProps) {
    const [showPayModal, setShowPayModal] = useState(false);
    const isOverdue = variant === 'overdue';

    return (
        <>
            <div className="flex items-center justify-between px-4 py-3 bg-white rounded-[8px] transition-colors hover:bg-gray-50/60"
                style={CARD_STYLE}>
                <div className="flex items-center gap-3">
                    <div className={cn(
                        'w-8 h-8 rounded-[7px] flex items-center justify-center shrink-0',
                        isOverdue ? 'bg-rose-50' : 'bg-amber-50'
                    )}>
                        <PiBuildings className={cn('text-[14px]', isOverdue ? 'text-rose-500' : 'text-amber-500')} />
                    </div>
                    <div>
                        <p className="text-[13px] font-[500] text-gray-900">{invoice.vendor.name}</p>
                        <p className="text-[11px] font-mono text-gray-400">{invoice.invoiceNumber}</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <div className="text-right">
                        <p className="text-[13px] font-[600] text-gray-900 tabular-nums">
                            {invoice.currency} {invoice.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </p>
                        <p className={cn('text-[11px] font-[500]', isOverdue ? 'text-rose-500' : 'text-amber-600')}>
                            Due {new Date(invoice.dueDate).toLocaleDateString()}
                        </p>
                    </div>
                    <button onClick={() => setShowPayModal(true)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] text-[11.5px] font-[500] text-white bg-emerald-600 hover:bg-emerald-700 transition-colors">
                        <PiCurrencyDollar className="text-[13px]" />
                        Pay Now
                    </button>
                </div>
            </div>

            {showPayModal && (
                <PayInvoiceModal invoice={invoice} onClose={() => setShowPayModal(false)} />
            )}
        </>
    );
}
