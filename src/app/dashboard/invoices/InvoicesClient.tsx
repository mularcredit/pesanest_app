'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import {
    PiFileText, PiBuildings, PiCalendarBlank, PiCheckCircle,
    PiClock, PiWarningCircle, PiPaperclip, PiMagnifyingGlass,
} from 'react-icons/pi';
import { InvoiceHeaderActions } from './InvoiceHeaderActions';

interface InvoiceRow {
    id: string;
    invoiceNumber: string;
    invoiceDate: string;
    dueDate: string;
    amount: number;
    status: string;
    currency: string;
    fileUrl: string | null;
    vendorName: string;
    createdByName: string;
}

interface InvoicesClientProps { invoices: InvoiceRow[] }

const CARD_STYLE: React.CSSProperties = { border: '1px solid rgba(0,0,0,0.09)' };
const ROW_BORDER: React.CSSProperties = { borderBottom: '1px solid rgba(0,0,0,0.06)' };

const STATUS_META: Record<string, { label: string; cls: string; border: string; Icon: React.ElementType }> = {
    PAID:             { label: 'Paid',     cls: 'text-emerald-600 bg-emerald-50', border: 'rgba(16,185,129,0.2)',  Icon: PiCheckCircle  },
    APPROVED:         { label: 'Approved', cls: 'text-blue-600 bg-blue-50',       border: 'rgba(59,130,246,0.2)', Icon: PiCheckCircle  },
    PENDING_APPROVAL: { label: 'Pending',  cls: 'text-amber-600 bg-amber-50',     border: 'rgba(245,158,11,0.2)', Icon: PiClock        },
    REJECTED:         { label: 'Rejected', cls: 'text-rose-600 bg-rose-50',       border: 'rgba(239,68,68,0.2)',  Icon: PiWarningCircle },
    DRAFT:            { label: 'Draft',    cls: 'text-gray-500 bg-gray-100',      border: 'rgba(0,0,0,0.09)',     Icon: PiFileText     },
};

const TABS = [
    { id: 'ALL',              label: 'All'      },
    { id: 'PENDING_APPROVAL', label: 'Pending'  },
    { id: 'APPROVED',         label: 'Approved' },
    { id: 'PAID',             label: 'Paid'     },
    { id: 'REJECTED',         label: 'Rejected' },
    { id: 'DRAFT',            label: 'Draft'    },
];

function fmtAmt(amount: number, currency: string) {
    return `${currency} ${amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
}

function fmtDate(iso: string) {
    return new Date(iso).toLocaleDateString();
}

export function InvoicesClient({ invoices }: InvoicesClientProps) {
    const [tab, setTab]       = useState('ALL');
    const [search, setSearch] = useState('');

    const now = new Date();

    const stats = useMemo(() => ({
        total:      invoices.length,
        pending:    invoices.filter(i => i.status === 'PENDING_APPROVAL').length,
        pendingAmt: invoices.filter(i => i.status === 'PENDING_APPROVAL').reduce((s, i) => s + i.amount, 0),
        paid:       invoices.filter(i => i.status === 'PAID').length,
        paidAmt:    invoices.filter(i => i.status === 'PAID').reduce((s, i) => s + i.amount, 0),
        overdue:    invoices.filter(i => !['PAID','REJECTED','DRAFT'].includes(i.status) && new Date(i.dueDate) < now).length,
    }), [invoices]);

    const filtered = useMemo(() => {
        let list = tab === 'ALL' ? invoices : invoices.filter(i => i.status === tab);
        if (search.trim()) {
            const q = search.toLowerCase();
            list = list.filter(i =>
                i.invoiceNumber.toLowerCase().includes(q) ||
                i.vendorName.toLowerCase().includes(q)
            );
        }
        return list;
    }, [invoices, tab, search]);

    const summaryChips = [
        { label: 'Total invoices', value: stats.total.toString(), sub: null, accent: 'text-gray-900' },
        { label: 'Pending approval', value: stats.pending.toString(), sub: stats.pending > 0 ? `${stats.pendingAmt.toLocaleString(undefined, { minimumFractionDigits: 0 })}` : null, accent: 'text-amber-600' },
        { label: 'Paid', value: stats.paid.toString(), sub: stats.paid > 0 ? `${stats.paidAmt.toLocaleString(undefined, { minimumFractionDigits: 0 })}` : null, accent: 'text-emerald-600' },
        { label: 'Overdue', value: stats.overdue.toString(), sub: null, accent: stats.overdue > 0 ? 'text-rose-600' : 'text-gray-400' },
    ];

    return (
        <div className="space-y-5 pb-24">
            {/* Page header */}
            <div className="flex items-start justify-between">
                <div>
                    <h1 className="text-[20px] font-[600] text-gray-900 tracking-tight">Invoices</h1>
                    <p className="text-[12.5px] text-gray-400 mt-0.5">Vendor invoices and accounts payable</p>
                </div>
                <InvoiceHeaderActions />
            </div>

            {/* Summary chips */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {summaryChips.map(chip => (
                    <div key={chip.label} className="bg-white rounded-[8px] px-4 py-3" style={CARD_STYLE}>
                        <p className="text-[11px] font-[500] uppercase tracking-[0.07em] text-gray-400">{chip.label}</p>
                        <p className={cn('text-[22px] font-[700] tabular-nums leading-snug mt-0.5', chip.accent)}>{chip.value}</p>
                        {chip.sub && <p className="text-[11px] text-gray-400 mt-0.5 tabular-nums">{chip.sub}</p>}
                    </div>
                ))}
            </div>

            {/* Filter bar */}
            <div className="flex items-center gap-3 flex-wrap">
                {/* Tabs */}
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

                {/* Search */}
                <div className="flex-1 max-w-xs ml-auto">
                    <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                        placeholder="Search invoice # or vendor…"
                        className="w-full rounded-[6px] pl-3 pr-3 py-[9px] text-[12.5px] text-gray-900 placeholder:text-gray-300 outline-none focus:ring-1 focus:ring-[#6366F1] bg-white"
                        style={{ border: '1px solid rgba(0,0,0,0.09)' }} />
                </div>
            </div>

            {/* Empty state */}
            {filtered.length === 0 && (
                <div className="bg-white rounded-[8px] py-20 flex flex-col items-center" style={CARD_STYLE}>
                    <div className="w-10 h-10 rounded-[8px] bg-gray-50 flex items-center justify-center mb-3"
                        style={{ border: '1px solid rgba(0,0,0,0.07)' }}>
                        <PiFileText className="text-gray-300 text-xl" />
                    </div>
                    <p className="text-[13px] font-[500] text-gray-700">
                        {search ? 'No invoices match your search' : 'No invoices yet'}
                    </p>
                    {!search && <p className="text-[12px] text-gray-400 mt-0.5">Record your first vendor invoice to start tracking payables.</p>}
                </div>
            )}

            {/* Table */}
            {filtered.length > 0 && (
                <div className="bg-white rounded-[8px] overflow-hidden" style={CARD_STYLE}>
                    <table className="w-full">
                        <thead>
                            <tr className="bg-gray-50/60" style={{ borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
                                {['Invoice #', 'Vendor', 'Date', 'Due Date', 'Amount', 'Status', 'Actions'].map((h, i) => (
                                    <th key={h} className={cn(
                                        'px-5 py-2.5 text-[10.5px] font-[500] uppercase tracking-[0.08em] text-gray-400',
                                        i === 6 ? 'text-right' : 'text-left'
                                    )}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map((invoice, idx) => {
                                const meta    = STATUS_META[invoice.status] ?? STATUS_META.DRAFT;
                                const overdue = !['PAID','REJECTED','DRAFT'].includes(invoice.status) && new Date(invoice.dueDate) < now;
                                return (
                                    <tr key={invoice.id} className="hover:bg-gray-50/60 transition-colors"
                                        style={idx < filtered.length - 1 ? ROW_BORDER : {}}>
                                        <td className="px-5 py-3.5">
                                            <div className="flex items-center gap-2">
                                                <span className="font-mono text-[12.5px] text-gray-900">{invoice.invoiceNumber}</span>
                                                {invoice.fileUrl && (
                                                    <a href={invoice.fileUrl} target="_blank" rel="noopener noreferrer"
                                                        className="text-gray-300 hover:text-[#6366F1] transition-colors" title="View Attachment">
                                                        <PiPaperclip className="text-[13px]" />
                                                    </a>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-5 py-3.5">
                                            <div className="flex items-center gap-2">
                                                <PiBuildings className="text-gray-300 text-[14px] shrink-0" />
                                                <span className="text-[13px] font-[500] text-gray-900">{invoice.vendorName}</span>
                                            </div>
                                        </td>
                                        <td className="px-5 py-3.5 text-[12.5px] text-gray-400">{fmtDate(invoice.invoiceDate)}</td>
                                        <td className="px-5 py-3.5">
                                            <div className={cn('flex items-center gap-1.5 text-[12.5px] font-[500]', overdue ? 'text-rose-500' : 'text-gray-400')}>
                                                <PiCalendarBlank className="text-[13px]" />
                                                {fmtDate(invoice.dueDate)}
                                            </div>
                                        </td>
                                        <td className="px-5 py-3.5 text-[13px] font-[600] text-gray-900 tabular-nums">
                                            {fmtAmt(invoice.amount, invoice.currency)}
                                        </td>
                                        <td className="px-5 py-3.5">
                                            <span className={cn('inline-flex items-center gap-1 text-[10.5px] font-[500] px-2 py-0.5 rounded-[4px]', meta.cls)}
                                                style={{ border: `1px solid ${meta.border}` }}>
                                                <meta.Icon className="text-[11px]" />
                                                {meta.label}
                                            </span>
                                        </td>
                                        <td className="px-5 py-3.5">
                                            <div className="flex items-center justify-end gap-2">
                                                {['APPROVED','PAID'].includes(invoice.status) && (
                                                    <Link href={`/receipt-studio?invoiceId=${invoice.id}`}
                                                        className="flex items-center gap-1 text-[11px] font-[500] text-gray-500 hover:text-gray-800 px-2.5 py-1.5 rounded-[5px] transition-colors hover:bg-gray-50"
                                                        style={{ border: '1px solid rgba(0,0,0,0.09)' }}>
                                                        <PiFileText className="text-[12px]" />
                                                        Voucher
                                                    </Link>
                                                )}
                                                <Link href={`/dashboard/invoices/${invoice.id}`}
                                                    className="text-[12px] font-[500] text-[#6366F1] hover:underline whitespace-nowrap">
                                                    View
                                                </Link>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
