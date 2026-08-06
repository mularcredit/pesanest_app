"use client";

import { useMemo, useState } from "react";
import { PiBuildings, PiCurrencyDollar, PiClock, PiFileText, PiMagnifyingGlass } from "react-icons/pi";
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

interface PayablesLedgerProps {
    invoices: Invoice[];
}

const CARD_STYLE: React.CSSProperties = { border: '1px solid rgba(0,0,0,0.09)' };
const ROW_BORDER: React.CSSProperties = { borderBottom: '1px solid rgba(0,0,0,0.06)' };

const TABS = [
    { id: 'ALL', label: 'All Outstanding' },
    { id: 'APPROVED', label: 'Ready to Pay' },
    { id: 'PENDING_APPROVAL', label: 'Awaiting Approval' },
];

function fmtAmt(amount: number, currency: string) {
    return `${currency} ${amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
}

function PayableRow({ invoice, isLast }: { invoice: Invoice; isLast: boolean }) {
    const [showPayModal, setShowPayModal] = useState(false);
    const canPay = invoice.status === 'APPROVED';
    const overdue = new Date(invoice.dueDate) < new Date();

    return (
        <>
            <tr className="hover:bg-gray-50/60 transition-colors" style={isLast ? {} : ROW_BORDER}>
                <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2">
                        <PiBuildings className="text-gray-300 text-[14px] shrink-0" />
                        <span className="text-[13px] font-[500] text-gray-900">{invoice.vendor.name}</span>
                    </div>
                </td>
                <td className="px-5 py-3.5 font-mono text-[12.5px] text-gray-500">{invoice.invoiceNumber}</td>
                <td className="px-5 py-3.5">
                    <span className={cn('text-[12.5px] font-[500]', overdue ? 'text-rose-500' : 'text-gray-400')}>
                        {new Date(invoice.dueDate).toLocaleDateString()}
                    </span>
                </td>
                <td className="px-5 py-3.5 text-[13px] font-[600] text-gray-900 tabular-nums">
                    {fmtAmt(invoice.amount, invoice.currency)}
                </td>
                <td className="px-5 py-3.5">
                    <span className={cn(
                        'inline-flex items-center gap-1 text-[10.5px] font-[500] px-2 py-0.5 rounded-[4px]',
                        canPay ? 'text-blue-600 bg-blue-50' : 'text-amber-600 bg-amber-50'
                    )} style={{ border: `1px solid ${canPay ? 'rgba(59,130,246,0.2)' : 'rgba(245,158,11,0.2)'}` }}>
                        {canPay ? 'Approved' : 'Pending Approval'}
                    </span>
                </td>
                <td className="px-5 py-3.5 text-right">
                    {canPay ? (
                        <button onClick={() => setShowPayModal(true)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] text-[11.5px] font-[500] text-white bg-emerald-600 hover:bg-emerald-700 transition-colors">
                            <PiCurrencyDollar className="text-[13px]" />
                            Pay Now
                        </button>
                    ) : (
                        <span className="inline-flex items-center gap-1.5 text-[11.5px] text-gray-400" title="Route to Approvals to review this invoice">
                            <PiClock className="text-[13px]" />
                            Awaiting approval
                        </span>
                    )}
                </td>
            </tr>

            {showPayModal && (
                <PayInvoiceModal invoice={invoice} onClose={() => setShowPayModal(false)} />
            )}
        </>
    );
}

export function PayablesLedger({ invoices }: PayablesLedgerProps) {
    const [tab, setTab] = useState('ALL');
    const [search, setSearch] = useState('');

    const filtered = useMemo(() => {
        let list = tab === 'ALL' ? invoices : invoices.filter(i => i.status === tab);
        if (search.trim()) {
            const q = search.toLowerCase();
            list = list.filter(i =>
                i.invoiceNumber.toLowerCase().includes(q) ||
                i.vendor.name.toLowerCase().includes(q)
            );
        }
        return [...list].sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
    }, [invoices, tab, search]);

    return (
        <div className="space-y-3">
            <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-1 bg-white rounded-[8px] p-1" style={CARD_STYLE}>
                    {TABS.map(t => {
                        const count = t.id === 'ALL' ? invoices.length : invoices.filter(i => i.status === t.id).length;
                        const isActive = tab === t.id;
                        return (
                            <button key={t.id} onClick={() => setTab(t.id)}
                                className={cn(
                                    'px-3 py-1.5 rounded-[5px] text-[12px] font-[500] transition-colors whitespace-nowrap',
                                    isActive ? 'bg-[#6366F1] text-white' : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
                                )}>
                                {t.label}
                                {count > 0 && <span className={cn('ml-1.5 text-[10px]', isActive ? 'text-indigo-200' : 'text-gray-400')}>({count})</span>}
                            </button>
                        );
                    })}
                </div>

                <div className="flex-1 max-w-xs ml-auto relative">
                    <PiMagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300 text-[13px]" />
                    <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                        placeholder="Search invoice # or vendor…"
                        className="w-full rounded-[6px] pl-8 pr-3 py-[9px] text-[12.5px] text-gray-900 placeholder:text-gray-300 outline-none focus:ring-1 focus:ring-[#6366F1] bg-white"
                        style={{ border: '1px solid rgba(0,0,0,0.09)' }} />
                </div>
            </div>

            {filtered.length === 0 ? (
                <div className="bg-white rounded-[8px] py-16 flex flex-col items-center" style={CARD_STYLE}>
                    <div className="w-10 h-10 rounded-[8px] bg-gray-50 flex items-center justify-center mb-3"
                        style={{ border: '1px solid rgba(0,0,0,0.07)' }}>
                        <PiFileText className="text-gray-300 text-xl" />
                    </div>
                    <p className="text-[13px] font-[500] text-gray-700">
                        {search ? 'No payables match your search' : 'Nothing in this view'}
                    </p>
                </div>
            ) : (
                <div className="bg-white rounded-[8px] overflow-hidden" style={CARD_STYLE}>
                    <table className="w-full">
                        <thead>
                            <tr className="bg-gray-50/60" style={{ borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
                                {['Vendor', 'Invoice #', 'Due Date', 'Amount', 'Status', 'Action'].map((h, i) => (
                                    <th key={h} className={cn(
                                        'px-5 py-2.5 text-[10.5px] font-[500] uppercase tracking-[0.08em] text-gray-400',
                                        i === 5 ? 'text-right' : 'text-left'
                                    )}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map((invoice, idx) => (
                                <PayableRow key={invoice.id} invoice={invoice} isLast={idx === filtered.length - 1} />
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
