'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { SouthSudanReceiptTemplate } from '@/components/finance-studio/SouthSudanReceiptTemplate';
import { StudioDatePicker } from '@/components/finance-studio/StudioDatePicker';
import { PiFloppyDisk, PiArrowLeft, PiPlus, PiTrash } from 'react-icons/pi';
import { BrandLogo } from '@/components/ui/BrandLogo';
import { useSearchParams, useRouter } from 'next/navigation';
import {
    getPaymentDetailsForReceipt, getRequisitionDetailsForReceipt,
    getInvoiceDetailsForReceipt, getExpenseDetailsForReceipt, getRequisitionItemDetailsForReceipt
} from '@/app/actions/receipt-studio';
import { pdf } from '@react-pdf/renderer';
import { VoucherPDF } from '@/components/finance-studio/VoucherPDF';

const HAIRLINE = '1px solid rgba(0,0,0,0.07)';

const InputLabel = ({ children }: { children: React.ReactNode }) => (
    <label className="block text-[10.5px] font-[600] uppercase tracking-[0.08em] text-gray-400 mb-1.5">
        {children}
    </label>
);

const StudioInput = ({ value, onChange, placeholder, ...props }: any) => (
    <input
        type="text"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="w-full rounded-[7px] px-3 py-2.5 text-[12.5px] text-gray-900 bg-white outline-none focus:ring-2 focus:ring-[#6366F1]/15 transition-all"
        style={{ border: HAIRLINE }}
        {...props}
    />
);

const SectionHeader = ({ title }: { title: string }) => (
    <div className="pb-2 mb-4" style={{ borderBottom: HAIRLINE }}>
        <p className="text-[10px] font-[700] uppercase tracking-[0.09em] text-gray-400">{title}</p>
    </div>
);

function ReceiptStudioContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const paymentId     = searchParams.get('paymentId');
    const requisitionId = searchParams.get('requisitionId');
    const invoiceId     = searchParams.get('invoiceId');
    const expenseId     = searchParams.get('expenseId');
    const itemId        = searchParams.get('itemId');

    const [isLoading, setIsLoading] = useState(false);
    const [settings, setSettings] = useState<Record<string, string>>({});
    const [draftSaved, setDraftSaved] = useState(false);

    const [receiptData, setReceiptData] = useState({
        receiptNo: 'VCH-2026-8892',
        date: new Date(),
        amount: 4250.00,
        beneficiary: {
            name: 'TechFlow Systems Inc.',
            address: '45 Innovation Blvd\nSan Francisco, CA'
        },
        paymentMode: 'Wire Transfer',
        paymentRef: 'TRX-998273',
        items: [
            { description: 'Platform Subscription', subtext: 'Enterprise Tier - Q1 2026', date: new Date(), amount: 3000.00 },
            { description: 'Onboarding & Setup',    subtext: 'One-time professional fee',  date: new Date(), amount: 1250.00 }
        ],
        approvals: {
            requestedBy: 'Sarah Jenkins',
            authorizedBy: 'James K.',
            paidBy: '',
            receivedBy: ''
        }
    });

    useEffect(() => {
        const hydrate = async (loader: () => Promise<any>) => {
            setIsLoading(true);
            const data = await loader();
            if (data) {
                setReceiptData({
                    ...data,
                    date:  new Date(data.date),
                    items: data.items.map((it: any) => ({ ...it, date: new Date(it.date) })),
                });
            }
            setIsLoading(false);
        };

        if      (itemId)        hydrate(() => getRequisitionItemDetailsForReceipt(itemId));
        else if (paymentId)     hydrate(() => getPaymentDetailsForReceipt(paymentId));
        else if (requisitionId) hydrate(() => getRequisitionDetailsForReceipt(requisitionId));
        else if (invoiceId)     hydrate(() => getInvoiceDetailsForReceipt(invoiceId));
        else if (expenseId)     hydrate(() => getExpenseDetailsForReceipt(expenseId));

        const fetchSettings = async () => {
            try {
                const keys = ['voucher_header_logo', 'voucher_footer_logo', 'voucher_watermark_logo', 'studio_draft_voucher'].join(',');
                const res = await fetch(`/api/settings?keys=${keys}`);
                if (res.ok) {
                    const data = await res.json();
                    setSettings(data);
                    if (!paymentId && !requisitionId && !invoiceId && !expenseId && !itemId) {
                        try {
                            if (data.studio_draft_voucher) {
                                const parsed = JSON.parse(data.studio_draft_voucher);
                                setReceiptData({
                                    ...parsed,
                                    date:  new Date(parsed.date),
                                    items: parsed.items.map((it: any) => ({ ...it, date: new Date(it.date) })),
                                });
                            }
                        } catch (e) { console.warn('Could not restore voucher draft:', e); }
                    }
                }
            } catch (err) { console.error("Failed to fetch settings:", err); }
        };
        fetchSettings();
    }, [paymentId, requisitionId, invoiceId, expenseId, itemId]);

    const handleAddItem = () =>
        setReceiptData(prev => ({
            ...prev,
            items: [...prev.items, { description: 'New Item', subtext: '', date: new Date(), amount: 0 }]
        }));

    const handleRemoveItem = (index: number) =>
        setReceiptData(prev => ({ ...prev, items: prev.items.filter((_, i) => i !== index) }));

    const handleItemChange = (index: number, field: string, value: any) => {
        const newItems: any[] = [...receiptData.items];
        newItems[index][field] = value;
        setReceiptData({ ...receiptData, items: newItems });
    };

    const saveDraft = async () => {
        try {
            const res = await fetch('/api/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ updates: [{ key: 'studio_draft_voucher', value: JSON.stringify(receiptData), description: 'Voucher Studio draft' }] }),
            });
            if (res.ok) { setDraftSaved(true); setTimeout(() => setDraftSaved(false), 2500); }
            else throw new Error('Server error');
        } catch { alert('Could not save draft. Please try again.'); }
    };

    const downloadPDF = async (e: React.MouseEvent<HTMLButtonElement>) => {
        const btn = e.currentTarget;
        const originalContent = btn.innerHTML;
        try {
            btn.innerHTML = 'Generating PDF…';
            btn.disabled = true;
            const origin = typeof window !== 'undefined' ? window.location.origin : '';
            const blob = await pdf(<VoucherPDF data={receiptData} baseUrl={origin} settings={settings} />).toBlob();
            if (!blob) throw new Error('Empty PDF blob');
            window.open(URL.createObjectURL(blob), '_blank');
            btn.innerHTML = originalContent;
            btn.disabled = false;
        } catch (err: any) {
            console.error('PDF Error:', err);
            alert(`PDF generation failed: ${err.message || 'Unknown error'}. Falling back to print.`);
            window.print();
            btn.innerHTML = originalContent;
            btn.disabled = false;
        }
    };

    return (
        <div className="flex h-screen bg-white overflow-hidden" data-theme="light">
            <style jsx global>{`
                @media print {
                    @page { size: A4; margin: 0 !important; }
                    * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
                    body { margin: 0 !important; padding: 0 !important; visibility: hidden !important; background: white !important; }
                    .print-container-wrapper {
                        visibility: visible !important;
                        position: absolute !important;
                        left: 0 !important; top: 0 !important;
                        width: 100% !important;
                        margin: 0 !important; padding: 0 !important;
                        transform: none !important; box-shadow: none !important;
                        min-height: 297mm !important; height: auto !important; overflow: visible !important;
                    }
                    .print-container-wrapper * { visibility: visible !important; }
                }
                .studio-scroll::-webkit-scrollbar { width: 4px; }
                .studio-scroll::-webkit-scrollbar-track { background: transparent; }
                .studio-scroll::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.1); border-radius: 4px; }
                .studio-scroll::-webkit-scrollbar-thumb:hover { background: rgba(0,0,0,0.18); }
                @keyframes logo-pulse {
                    0%, 100% { opacity: 1; }
                    50%       { opacity: 0.35; }
                }
                @media screen {
                    .studio-workspace {
                        background-color: #F1F0ED;
                        background-image: radial-gradient(rgba(0,0,0,0.07) 1px, transparent 1px);
                        background-size: 20px 20px;
                    }
                }
            `}</style>

            {/* ── LEFT PANEL ─────────────────────────────────── */}
            <div className="w-[400px] bg-white flex flex-col h-full shrink-0 print:hidden" style={{ borderRight: HAIRLINE }}>

                {/* Header */}
                <div className="px-5 pt-5 pb-4 shrink-0" style={{ borderBottom: HAIRLINE }}>
                    <button onClick={() => router.push('/dashboard')}
                        className="flex items-center gap-1.5 mb-4 text-[11px] font-[500] text-gray-400 hover:text-[#6366F1] transition-colors">
                        <PiArrowLeft className="text-[13px]" /> Back to Dashboard
                    </button>
                    <div style={isLoading ? { animation: 'logo-pulse 1.2s ease-in-out infinite' } : {}}>
                        <BrandLogo width={140} height={32} color="#4338ca" />
                    </div>
                </div>

                {/* Scrollable form */}
                <div className="flex-1 overflow-y-auto px-5 py-5 space-y-7 studio-scroll">

                    {/* Voucher Details */}
                    <div>
                        <SectionHeader title="Voucher Details" />
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <InputLabel>Voucher No</InputLabel>
                                <StudioInput
                                    value={receiptData.receiptNo}
                                    onChange={(e: any) => setReceiptData({ ...receiptData, receiptNo: e.target.value })}
                                />
                            </div>
                            <div>
                                <InputLabel>Date</InputLabel>
                                <StudioDatePicker
                                    value={receiptData.date}
                                    onChange={(date: Date) => setReceiptData({ ...receiptData, date })}
                                    align="right"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Beneficiary */}
                    <div>
                        <SectionHeader title="Beneficiary" />
                        <div className="space-y-3">
                            <div>
                                <InputLabel>Name</InputLabel>
                                <StudioInput
                                    value={receiptData.beneficiary.name}
                                    onChange={(e: any) => setReceiptData({ ...receiptData, beneficiary: { ...receiptData.beneficiary, name: e.target.value } })}
                                    placeholder="Beneficiary name"
                                />
                            </div>
                            <div>
                                <InputLabel>Address</InputLabel>
                                <textarea
                                    value={receiptData.beneficiary.address}
                                    onChange={(e) => setReceiptData({ ...receiptData, beneficiary: { ...receiptData.beneficiary, address: e.target.value } })}
                                    rows={3}
                                    className="w-full rounded-[7px] px-3 py-2.5 text-[12.5px] text-gray-900 bg-white outline-none focus:ring-2 focus:ring-[#6366F1]/15 transition-all resize-none"
                                    style={{ border: HAIRLINE }}
                                    placeholder="Street address"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Payment Info */}
                    <div>
                        <SectionHeader title="Payment Info" />
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <InputLabel>Mode</InputLabel>
                                <StudioInput
                                    value={receiptData.paymentMode}
                                    onChange={(e: any) => setReceiptData({ ...receiptData, paymentMode: e.target.value })}
                                    placeholder="e.g. Wire Transfer"
                                />
                            </div>
                            <div>
                                <InputLabel>Reference</InputLabel>
                                <StudioInput
                                    value={receiptData.paymentRef}
                                    onChange={(e: any) => setReceiptData({ ...receiptData, paymentRef: e.target.value })}
                                    placeholder="TRX-000000"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Line Items */}
                    <div>
                        <div className="flex items-center justify-between pb-2 mb-4" style={{ borderBottom: HAIRLINE }}>
                            <p className="text-[10px] font-[700] uppercase tracking-[0.09em] text-gray-400">
                                Line Items
                                <span className="ml-2 text-gray-300 font-[600]">({receiptData.items.length})</span>
                            </p>
                            <button onClick={handleAddItem}
                                className="w-[26px] h-[26px] flex items-center justify-center rounded-[5px] text-white transition-colors"
                                style={{ background: '#6366F1' }} title="Add item">
                                <PiPlus className="text-[13px]" />
                            </button>
                        </div>

                        {receiptData.items.length === 0 ? (
                            <div className="py-8 text-center rounded-[7px]" style={{ border: `1px dashed rgba(0,0,0,0.1)` }}>
                                <p className="text-[11.5px] text-gray-400">No items yet</p>
                                <p className="text-[10.5px] text-gray-300 mt-0.5">Click + to add a line item</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {receiptData.items.map((item, idx) => (
                                    <div key={idx} className="rounded-[7px] p-3.5 group relative" style={{ border: HAIRLINE }}>
                                        <button onClick={() => handleRemoveItem(idx)}
                                            className="absolute top-2.5 right-2.5 text-gray-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all p-1 rounded-[4px] hover:bg-rose-50"
                                            title="Remove">
                                            <PiTrash className="text-[12px]" />
                                        </button>

                                        <div className="pr-8 mb-2.5">
                                            <p className="text-[9.5px] font-[600] uppercase tracking-[0.08em] text-gray-400 mb-1">Description</p>
                                            <input
                                                type="text"
                                                value={item.description}
                                                onChange={(e) => handleItemChange(idx, 'description', e.target.value)}
                                                placeholder="Item name"
                                                className="w-full rounded-[6px] px-2.5 py-1.5 text-[12px] text-gray-900 bg-white outline-none focus:ring-1 focus:ring-[#6366F1]/20 mb-1.5 transition-all"
                                                style={{ border: HAIRLINE }}
                                            />
                                            <input
                                                type="text"
                                                value={item.subtext}
                                                onChange={(e) => handleItemChange(idx, 'subtext', e.target.value)}
                                                placeholder="Subtext (optional)"
                                                className="w-full rounded-[6px] px-2.5 py-1.5 text-[11.5px] text-gray-500 bg-gray-50 outline-none focus:ring-1 focus:ring-[#6366F1]/20 transition-all"
                                                style={{ border: HAIRLINE }}
                                            />
                                        </div>

                                        <div className="grid grid-cols-2 gap-2">
                                            <div>
                                                <p className="text-[9.5px] font-[600] uppercase tracking-[0.08em] text-gray-400 mb-1">Amount</p>
                                                <input
                                                    type="number"
                                                    value={item.amount || ''}
                                                    onChange={(e) => handleItemChange(idx, 'amount', parseFloat(e.target.value) || 0)}
                                                    placeholder="0.00"
                                                    className="w-full rounded-[6px] px-2.5 py-1.5 text-[11.5px] font-mono tabular-nums text-gray-900 bg-white outline-none focus:ring-1 focus:ring-[#6366F1]/20 transition-all"
                                                    style={{ border: HAIRLINE }}
                                                />
                                            </div>
                                            <div>
                                                <p className="text-[9.5px] font-[600] uppercase tracking-[0.08em] text-gray-400 mb-1">Date</p>
                                                <StudioDatePicker
                                                    value={item.date}
                                                    onChange={(date: Date) => handleItemChange(idx, 'date', date)}
                                                    align="right"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Signatories */}
                    <div>
                        <SectionHeader title="Signatories" />
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <InputLabel>Requested By</InputLabel>
                                <StudioInput
                                    value={receiptData.approvals.requestedBy}
                                    onChange={(e: any) => setReceiptData({ ...receiptData, approvals: { ...receiptData.approvals, requestedBy: e.target.value } })}
                                    placeholder="Name"
                                />
                            </div>
                            <div>
                                <InputLabel>Authorized By</InputLabel>
                                <StudioInput
                                    value={receiptData.approvals.authorizedBy}
                                    onChange={(e: any) => setReceiptData({ ...receiptData, approvals: { ...receiptData.approvals, authorizedBy: e.target.value } })}
                                    placeholder="Name"
                                />
                            </div>
                            <div>
                                <InputLabel>Paid By</InputLabel>
                                <StudioInput
                                    value={receiptData.approvals.paidBy}
                                    onChange={(e: any) => setReceiptData({ ...receiptData, approvals: { ...receiptData.approvals, paidBy: e.target.value } })}
                                    placeholder="Name"
                                />
                            </div>
                            <div>
                                <InputLabel>Received By</InputLabel>
                                <StudioInput
                                    value={receiptData.approvals.receivedBy}
                                    onChange={(e: any) => setReceiptData({ ...receiptData, approvals: { ...receiptData.approvals, receivedBy: e.target.value } })}
                                    placeholder="Name"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Bottom actions */}
                <div className="px-5 py-4 grid grid-cols-2 gap-3 shrink-0" style={{ borderTop: HAIRLINE }}>
                    <button onClick={saveDraft}
                        className="flex items-center justify-center gap-2 py-2.5 rounded-[7px] text-[12px] font-[600] transition-all"
                        style={draftSaved
                            ? { background: 'rgba(5,150,105,0.08)', color: '#059669', border: '1px solid rgba(5,150,105,0.2)' }
                            : { background: 'white', color: '#374151', border: HAIRLINE }}>
                        <PiFloppyDisk className="text-[15px]" />
                        {draftSaved ? 'Saved!' : 'Save Draft'}
                    </button>
                    <button onClick={downloadPDF}
                        className="flex items-center justify-center gap-2 py-2.5 rounded-[7px] text-[12px] font-[600] text-white hover:opacity-90 transition-opacity"
                        style={{ background: '#6366F1' }}>
                        <img src="/adobe.png" alt="PDF" className="w-4 h-4 object-contain" />
                        Download PDF
                    </button>
                </div>
            </div>

            {/* ── RIGHT PANEL: DOCUMENT PREVIEW ─────────────── */}
            <div className="flex-1 overflow-auto studio-workspace relative print:bg-white flex flex-col items-center print:block print:overflow-visible">
                <div className="w-full h-full p-12 flex justify-center items-start print:p-0 print:m-0 overflow-y-auto print:overflow-visible">
                    <div
                        className="preview-canvas bg-white shadow-[0_8px_40px_-12px_rgba(0,0,0,0.18)] z-10 print:shadow-none print:m-0 print-container-wrapper rounded-[2px] print:w-full print:h-full print:transform-none"
                        style={{ width: '210mm', minHeight: '297mm', transform: 'scale(0.85)', transformOrigin: 'top center' }}>
                        <SouthSudanReceiptTemplate
                            {...receiptData}
                            settings={settings}
                            onSettingChange={(key: string, value: string) =>
                                setSettings(prev => ({ ...prev, [key]: value }))}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function ReceiptStudioPage() {
    return (
        <Suspense fallback={null}>
            <ReceiptStudioContent />
        </Suspense>
    );
}
