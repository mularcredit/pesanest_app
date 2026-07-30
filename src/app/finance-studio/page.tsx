'use client';

import React, { useState, useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { CreditNoteTemplate } from '@/components/finance-studio/CreditNoteTemplate';
import { PaymentReceiptTemplate } from '@/components/finance-studio/PaymentReceiptTemplate';
import { CustomerStatementTemplate, Transaction } from '@/components/finance-studio/CustomerStatementTemplate';
import { StudioDatePicker } from '@/components/finance-studio/StudioDatePicker';
import { StudioDateRangePicker } from '@/components/finance-studio/StudioDateRangePicker';
import { read, utils, writeFile } from 'xlsx';
import { pdf } from '@react-pdf/renderer';
import { ReceiptPDF, CreditNotePDF, StatementPDF } from '@/components/finance-studio/VectorTemplates';
import { checkCreditNoteNumberUniqueness, getCustomersForStudio, getStatementData } from '@/app/actions/finance-studio';
import { format } from "date-fns";
import {
    PiTrash, PiPlus, PiFloppyDisk, PiFileText, PiReceipt, PiListBullets,
    PiArrowLeft, PiUpload, PiInfo, PiWarningCircle,
    PiSortAscending, PiBuildings,
} from 'react-icons/pi';

const HAIRLINE = '1px solid rgba(0,0,0,0.07)';

const KNOWN_AIRLINES = [
    "Ethiopian Airlines", "Emirates", "Qatar Airways", "FlyDubai", "Kenya Airways",
    "Turkish Airlines", "EgyptAir", "Flyadeal", "Saudi Arabian Airlines",
    "RwandAir", "Uganda Airlines", "Tarco Aviation", "Badr Airlines",
    "Sudan Airways", "Air Arabia"
];

const InputLabel = ({ children }: { children: React.ReactNode }) => (
    <label className="block text-[10.5px] font-[600] uppercase tracking-[0.08em] text-gray-400 mb-1.5">
        {children}
    </label>
);

const StudioInput = ({ value, onChange, placeholder, className, ...props }: any) => (
    <input
        type="text"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className={`w-full rounded-[7px] px-3 py-2.5 text-[12.5px] text-gray-900 bg-white outline-none focus:ring-2 focus:ring-[#6366F1]/15 transition-all ${className ?? ''}`}
        style={{ border: HAIRLINE }}
        {...props}
    />
);

const StudioNumberInput = ({ value, onChange, placeholder }: any) => (
    <input
        type="number"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="w-full rounded-[7px] px-3 py-2.5 text-[12.5px] font-mono tabular-nums text-gray-900 bg-white outline-none focus:ring-2 focus:ring-[#6366F1]/15 transition-all"
        style={{ border: HAIRLINE }}
    />
);

const SectionHeader = ({ title }: { title: string }) => (
    <div className="pb-2 mb-4" style={{ borderBottom: HAIRLINE }}>
        <p className="text-[10px] font-[700] uppercase tracking-[0.09em] text-gray-400">{title}</p>
    </div>
);

function FinanceStudioContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [activeTab, setActiveTab] = useState<'CREDIT_NOTE' | 'RECEIPT' | 'STATEMENT'>('CREDIT_NOTE');
    const [settings, setSettings] = useState<Record<string, string>>({});
    const [draftSaved, setDraftSaved] = useState(false);

    const [availableCustomers, setAvailableCustomers] = useState<any[]>([]);
    const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
    const [isCnNumberChecking, setIsCnNumberChecking] = useState(false);
    const [cnNumberError, setCnNumberError] = useState<string | null>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const fetchCustomers = async () => {
            const customers = await getCustomersForStudio();
            setAvailableCustomers(customers);

            const urlCustomerId = searchParams.get('customerId');
            if (urlCustomerId && customers.length > 0) {
                const match = customers.find((c: any) => c.id === urlCustomerId);
                if (match) {
                    const type = searchParams.get('type');
                    if (type === 'CREDIT_NOTE') {
                        setCreditNoteData(prev => ({
                            ...prev,
                            customer: { ...prev.customer, name: match.name, address: match.address || '', tin: match.taxId || '' }
                        }));
                    }
                }
            }
        };
        fetchCustomers();

        const fetchSettings = async () => {
            try {
                const keys = [
                    'pesanest_statement_logo', 'nra_statement_logo_left', 'caa_statement_logo_right',
                    'statement_footer_logo_left', 'statement_footer_logo_center', 'statement_footer_logo_right',
                    'pesanest_receipt_logo', 'nra_receipt_logo_left', 'caa_receipt_logo_right',
                    'receipt_footer_logo_left', 'receipt_footer_logo_center', 'receipt_footer_logo_right',
                    'watermark_logo',
                    'studio_draft_credit_note', 'studio_draft_receipt', 'studio_draft_statement'
                ].join(',');
                const res = await fetch(`/api/settings?keys=${keys}`);
                if (res.ok) {
                    const data = await res.json();
                    setSettings(data);
                    try {
                        if (data.studio_draft_credit_note) {
                            const cn = JSON.parse(data.studio_draft_credit_note);
                            setCreditNoteData(prev => ({ ...prev, ...cn, date: new Date(cn.date) }));
                        }
                        if (data.studio_draft_receipt) {
                            const r = JSON.parse(data.studio_draft_receipt);
                            setReceiptData(prev => ({ ...prev, ...r, receiptDate: new Date(r.receiptDate), paymentDate: new Date(r.paymentDate) }));
                        }
                        if (data.studio_draft_statement) {
                            const s = JSON.parse(data.studio_draft_statement);
                            setStatementData(prev => ({
                                ...prev, ...s, date: new Date(s.date),
                                periodStart: s.periodStart ? new Date(s.periodStart) : null,
                                periodEnd: s.periodEnd ? new Date(s.periodEnd) : null
                            }));
                        }
                    } catch (e) { console.warn('Could not restore studio drafts:', e); }
                }
            } catch (err) { console.error("Failed to fetch settings:", err); }
        };
        fetchSettings();

        const type = searchParams.get('type');
        const customerId = searchParams.get('customerId');
        const fromDate = searchParams.get('from');
        const toDate = searchParams.get('to');

        if (type === 'STATEMENT' && customerId && fromDate && toDate) {
            setActiveTab('STATEMENT');
            getStatementData(customerId, fromDate, toDate).then(data => {
                if (data) {
                    setStatementData(prev => ({
                        ...prev,
                        period: `${new Date(fromDate).toLocaleDateString()} - ${new Date(toDate).toLocaleDateString()}`,
                        customer: { ...prev.customer, ...data.customer },
                        summary: data.summary,
                        transactions: data.transactions as Transaction[]
                    }));
                }
            });
        } else if (type === 'CREDIT_NOTE') {
            setActiveTab('CREDIT_NOTE');
            setCreditNoteData(prev => ({
                ...prev,
                cnNumber: searchParams.get('cnNumber') || prev.cnNumber,
                invoiceRef: searchParams.get('invoiceRef') || prev.invoiceRef,
                amount: parseFloat(searchParams.get('amount') || '0') || prev.amount,
                reason: searchParams.get('reason') || prev.reason,
                date: searchParams.get('date') ? new Date(searchParams.get('date')!) : new Date(),
                customer: { ...prev.customer, name: searchParams.get('customerName') || prev.customer.name }
            }));
        } else if (type === 'RECEIPT') {
            setActiveTab('RECEIPT');
            const amount = parseFloat(searchParams.get('originalAmount') || '0');
            setReceiptData(prev => ({
                ...prev,
                receiptNo: searchParams.get('transactionRef') ? `REC-${searchParams.get('transactionRef')}` : prev.receiptNo,
                receivedFrom: searchParams.get('receivedFrom') || prev.receivedFrom,
                paymentMethod: searchParams.get('paymentMethod') || prev.paymentMethod,
                transactionRef: searchParams.get('transactionRef') || prev.transactionRef,
                originalAmount: amount || prev.originalAmount,
                creditNoteApplied: amount || prev.creditNoteApplied,
                adjustedAmountDue: 0,
                notes: searchParams.get('transactionRef') ? `Applied Credit Note: ${searchParams.get('transactionRef')}` : prev.notes
            }));
        }

        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setShowCustomerDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [searchParams]);

    // --- STATE ---
    const [creditNoteData, setCreditNoteData] = useState({
        cnNumber: `CN-${format(new Date(), 'yyyyMMdd')}-001`,
        invoiceRef: '',
        amount: 0,
        reason: '',
        date: new Date(),
        customer: { name: '', address: '', tin: '' }
    });

    const [receiptData, setReceiptData] = useState({
        receiptNo: `REC-${format(new Date(), 'yyyyMMdd')}-001`,
        receiptDate: new Date(),
        currency: 'KES',
        receivedFrom: '',
        paymentMethod: 'Bank Transfer',
        transactionRef: '',
        paymentDate: new Date(),
        invoiceNumber: '',
        serviceType: '',
        billingPeriod: '',
        originalAmount: 0,
        creditNoteApplied: 0,
        adjustedAmountDue: 0,
        amountPaid: 0,
        notes: ''
    });

    const [statementData, setStatementData] = useState({
        statementNo: `SOA-${format(new Date(), 'yyyyMMdd')}-001`,
        date: new Date(),
        periodStart: null as Date | null,
        periodEnd: null as Date | null,
        customer: { name: '', group: '', country: '', accountType: '' },
        summary: { openingBalance: 0, totalCharges: 0, totalPayments: 0, outstandingBalance: 0 },
        transactions: [] as Transaction[],
        notes: [
            'This statement provides a detailed summary of your account activity for the specified period.',
            'Please review all transactions and contact our finance department for any discrepancies.',
            'Outstanding balances are due upon receipt of this statement.'
        ]
    });

    // --- UNIQUENESS CHECK ---
    useEffect(() => {
        if (activeTab !== 'CREDIT_NOTE' || !creditNoteData.cnNumber) return;
        const checkUniqueness = async () => {
            const urlCnNumber = searchParams.get('cnNumber');
            if (creditNoteData.cnNumber === urlCnNumber) { setCnNumberError(null); return; }
            setIsCnNumberChecking(true);
            const result = await checkCreditNoteNumberUniqueness(creditNoteData.cnNumber);
            setIsCnNumberChecking(false);
            setCnNumberError(result.exists ? "This Credit Note number is already in use." : null);
        };
        const timer = setTimeout(checkUniqueness, 500);
        return () => clearTimeout(timer);
    }, [creditNoteData.cnNumber, activeTab, searchParams]);

    // --- HELPERS ---
    const recalculateStatementSummary = (transactions: Transaction[], openingBalance: number) => {
        const totalCharges = transactions.reduce((sum, tx) => sum + (tx.debit || 0), 0);
        const totalPayments = transactions.reduce((sum, tx) => sum + (tx.credit || 0), 0);
        return { openingBalance, totalCharges, totalPayments, outstandingBalance: openingBalance + totalCharges - totalPayments };
    };

    const handleStatementTransactionChange = (idx: number, field: keyof Transaction, value: any) => {
        const newTransactions = [...statementData.transactions];
        newTransactions[idx] = { ...newTransactions[idx], [field]: value };
        let runningBalance = statementData.summary.openingBalance;
        newTransactions.forEach(tx => {
            const debit = parseFloat(tx.debit as any) || 0;
            const credit = parseFloat(tx.credit as any) || 0;
            runningBalance = runningBalance + debit - credit;
            tx.balance = runningBalance;
        });
        setStatementData({ ...statementData, transactions: newTransactions, summary: recalculateStatementSummary(newTransactions, statementData.summary.openingBalance) });
    };

    const addStatementTransaction = () => {
        const newTx: Transaction = { id: Date.now(), operator: 'New Description', invoiceRef: 'INV-NEW', period: 'Period', debit: 0, credit: 0, balance: 0 };
        const newTransactions = [...statementData.transactions, newTx];
        setStatementData({ ...statementData, transactions: newTransactions, summary: recalculateStatementSummary(newTransactions, statementData.summary.openingBalance) });
        handleStatementTransactionChange(newTransactions.length - 1, 'balance', 0);
    };

    const removeStatementTransaction = (idx: number) => {
        const newTransactions = statementData.transactions.filter((_, i) => i !== idx);
        let runningBalance = statementData.summary.openingBalance;
        newTransactions.forEach(tx => {
            tx.balance = runningBalance = runningBalance + (parseFloat(tx.debit as any) || 0) - (parseFloat(tx.credit as any) || 0);
        });
        setStatementData({ ...statementData, transactions: newTransactions, summary: recalculateStatementSummary(newTransactions, statementData.summary.openingBalance) });
    };

    const sortTransactions = () => {
        const getDate = (d: string) => {
            const parts = d.split('/');
            if (parts.length === 3) return new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0])).getTime();
            return new Date(d).getTime() || 0;
        };
        const sorted = [...statementData.transactions].sort((a, b) => getDate(a.period) - getDate(b.period));
        let runningBalance = statementData.summary.openingBalance;
        sorted.forEach(tx => {
            tx.balance = runningBalance = runningBalance + (parseFloat(tx.debit as any) || 0) - (parseFloat(tx.credit as any) || 0);
        });
        setStatementData({ ...statementData, transactions: sorted, summary: recalculateStatementSummary(sorted, statementData.summary.openingBalance) });
    };

    const handleDownloadTemplate = () => {
        const ws = utils.json_to_sheet([{ Description: 'Example Description', Reference: 'INV-001', Period: 'Jan 2026', Debit: 1000, Credit: 0 }]);
        const wb = utils.book_new();
        utils.book_append_sheet(wb, ws, "Transactions");
        writeFile(wb, "Statement_Template.xlsx");
    };

    const handleUploadTemplate = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (evt) => {
            const bstr = evt.target?.result;
            const wb = read(bstr, { type: 'binary' });
            const ws = wb.Sheets[wb.SheetNames[0]];
            const data = utils.sheet_to_json(ws);
            const newTransactions = data.map((row: any, idx) => ({
                id: Date.now() + idx,
                operator: row['Description'] || row['Operator'] || '',
                invoiceRef: row['Reference'] || row['Invoice Ref'] || '',
                period: row['Period'] || '',
                debit: row['Debit'] || 0,
                credit: row['Credit'] || 0,
                balance: 0
            })) as Transaction[];

            newTransactions.sort((a, b) => {
                const getDate = (d: string) => {
                    const parts = d?.split('/') || [];
                    if (parts.length === 3) return new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0])).getTime();
                    return new Date(d).getTime() || 0;
                };
                return getDate(a.period) - getDate(b.period);
            });

            let runningBalance = statementData.summary.openingBalance;
            newTransactions.forEach(tx => {
                tx.balance = runningBalance = runningBalance + (parseFloat(tx.debit as any) || 0) - (parseFloat(tx.credit as any) || 0);
            });

            setStatementData({ ...statementData, transactions: newTransactions, summary: recalculateStatementSummary(newTransactions, statementData.summary.openingBalance) });
        };
        reader.readAsBinaryString(file);
    };

    const handleCustomerSelect = (customer: any) => {
        if (activeTab === 'STATEMENT') {
            setStatementData(prev => ({ ...prev, customer: { ...prev.customer, name: customer.name, country: customer.country || prev.customer.country } }));
        } else if (activeTab === 'CREDIT_NOTE') {
            setCreditNoteData(prev => ({ ...prev, customer: { ...prev.customer, name: customer.name, address: customer.address || prev.customer.address, tin: customer.taxId || prev.customer.tin } }));
        } else if (activeTab === 'RECEIPT') {
            setReceiptData(prev => ({ ...prev, receivedFrom: customer.name }));
        }
        setShowCustomerDropdown(false);
    };

    const renderCustomerInput = (value: string, onChange: (val: string) => void) => {
        const filteredDB = availableCustomers.filter(c => c.name.toLowerCase().includes(value.toLowerCase()));
        const filteredKnown = KNOWN_AIRLINES
            .filter(a => a.toLowerCase().includes(value.toLowerCase()))
            .filter(a => !filteredDB.find(db => db.name === a));
        const hasSuggestions = filteredDB.length > 0 || filteredKnown.length > 0;

        return (
            <div className="relative" ref={dropdownRef}>
                <div>
                    <StudioInput
                        value={value}
                        onChange={(e: any) => { onChange(e.target.value); setShowCustomerDropdown(true); }}
                        onFocus={() => setShowCustomerDropdown(true)}
                        placeholder="Search customer..."
                    />
                </div>
                {showCustomerDropdown && hasSuggestions && (
                    <div className="absolute z-50 w-full mt-1 bg-white rounded-[8px] shadow-lg max-h-48 overflow-y-auto" style={{ border: HAIRLINE }}>
                        {filteredDB.length > 0 && (
                            <div className="py-1">
                                <div className="px-3 py-1.5 text-[9.5px] font-[700] uppercase tracking-[0.1em] text-[#6366F1]" style={{ borderBottom: HAIRLINE }}>
                                    Saved Customers
                                </div>
                                {filteredDB.map((c: any) => (
                                    <button key={c.id} onClick={() => handleCustomerSelect(c)}
                                        className="w-full text-left px-3 py-2 hover:bg-indigo-50 transition-colors flex flex-col">
                                        <span className="text-[12px] font-[500] text-gray-900">{c.name}</span>
                                        <span className="text-[10.5px] text-gray-400">{c.city}, {c.country}</span>
                                    </button>
                                ))}
                            </div>
                        )}
                        {filteredDB.length > 0 && filteredKnown.length > 0 && (
                            <div style={{ borderTop: HAIRLINE }} />
                        )}
                        {filteredKnown.length > 0 && (
                            <div className="py-1">
                                <div className="px-3 py-1.5 text-[9.5px] font-[700] uppercase tracking-[0.1em] text-gray-400" style={{ borderBottom: HAIRLINE }}>
                                    Suggestions
                                </div>
                                {filteredKnown.map((name: string, i: number) => (
                                    <button key={i} onClick={() => handleCustomerSelect({ name })}
                                        className="w-full text-left px-3 py-2 text-[12px] text-gray-700 hover:bg-gray-50 transition-colors">
                                        {name}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        );
    };

    // --- RENDER ---
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
                        transform: none !important;
                        box-shadow: none !important;
                        min-height: 297mm !important;
                        height: auto !important;
                        overflow: visible !important;
                    }
                    .print-container-wrapper * { visibility: visible !important; }
                    .print-container-wrapper .flex { display: flex !important; }
                    .print-container-wrapper .grid { display: grid !important; }
                }
                .studio-scroll::-webkit-scrollbar { width: 4px; }
                .studio-scroll::-webkit-scrollbar-track { background: transparent; }
                .studio-scroll::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.1); border-radius: 4px; }
                .studio-scroll::-webkit-scrollbar-thumb:hover { background: rgba(0,0,0,0.18); }
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

                {/* Panel header */}
                <div className="px-5 pt-5 pb-4 shrink-0" style={{ borderBottom: HAIRLINE }}>
                    <button onClick={() => router.push('/dashboard')}
                        className="flex items-center gap-1.5 mb-4 text-[11px] font-[500] text-gray-400 hover:text-[#6366F1] transition-colors">
                        <PiArrowLeft className="text-[13px]" /> Back to Dashboard
                    </button>
                    <div className="flex items-center gap-2.5 mb-4">
                        <div className="w-[30px] h-[30px] rounded-[7px] bg-[#6366F1] flex items-center justify-center shrink-0">
                            <PiFileText className="text-white text-[15px]" />
                        </div>
                        <div>
                            <p className="text-[14px] font-[700] text-gray-900 tracking-tight leading-tight">Finance Studio</p>
                            <p className="text-[10.5px] text-gray-400">Credit notes, receipts &amp; statements</p>
                        </div>
                    </div>
                    {/* Tab switcher */}
                    <div className="grid grid-cols-3 gap-1.5">
                        {([
                            { key: 'CREDIT_NOTE', label: 'Credit Note', icon: PiFileText,    color: '#6366F1' },
                            { key: 'RECEIPT',     label: 'Receipt',     icon: PiReceipt,     color: '#059669' },
                            { key: 'STATEMENT',   label: 'Statement',   icon: PiListBullets, color: '#7c3aed' },
                        ] as const).map(({ key, label, icon: Icon, color }) => {
                            const isActive = activeTab === key;
                            return (
                                <button key={key} onClick={() => setActiveTab(key)}
                                    className="flex items-center justify-center gap-1.5 py-2 rounded-[7px] text-[11px] font-[600] transition-all"
                                    style={isActive
                                        ? { background: color, color: 'white', border: `1px solid ${color}` }
                                        : { background: 'white', color: '#6b7280', border: HAIRLINE }}>
                                    <Icon className="text-[13px] shrink-0" />
                                    <span className="truncate">{label}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Scrollable form */}
                <div className="flex-1 overflow-y-auto px-5 py-5 space-y-7 studio-scroll">

                    {/* ── CREDIT NOTE FORM ── */}
                    {activeTab === 'CREDIT_NOTE' && (
                        <motion.div key="credit-note" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="space-y-7">
                            <div>
                                <SectionHeader title="Document Details" />
                                <div className="space-y-4">
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <InputLabel>Date</InputLabel>
                                            <StudioDatePicker value={creditNoteData.date} onChange={(date) => setCreditNoteData({ ...creditNoteData, date })} />
                                        </div>
                                        <div>
                                            <InputLabel>CN Number</InputLabel>
                                            <StudioInput
                                                value={creditNoteData.cnNumber}
                                                onChange={(e: any) => setCreditNoteData({ ...creditNoteData, cnNumber: e.target.value })}
                                                className={cnNumberError ? 'ring-2 ring-rose-300' : ''}
                                            />
                                            {cnNumberError && (
                                                <p className="mt-1 text-[10px] text-rose-500 font-[600] flex items-center gap-1">
                                                    <PiWarningCircle className="text-[11px]" /> {cnNumberError}
                                                </p>
                                            )}
                                            {isCnNumberChecking && (
                                                <p className="mt-1 text-[10px] text-gray-400">Checking...</p>
                                            )}
                                        </div>
                                    </div>
                                    <div>
                                        <InputLabel>Invoice Ref</InputLabel>
                                        <StudioInput value={creditNoteData.invoiceRef} onChange={(e: any) => setCreditNoteData({ ...creditNoteData, invoiceRef: e.target.value })} />
                                    </div>
                                    <div>
                                        <InputLabel>Amount (KES)</InputLabel>
                                        <div>
                                            <input
                                                type="number"
                                                value={creditNoteData.amount || ''}
                                                onChange={(e) => setCreditNoteData({ ...creditNoteData, amount: parseFloat(e.target.value) || 0 })}
                                                className="w-full rounded-[7px] pl-3 pr-3 py-2.5 text-[12.5px] font-mono tabular-nums text-gray-900 bg-white outline-none focus:ring-2 focus:ring-[#6366F1]/15 transition-all"
                                                style={{ border: HAIRLINE }}
                                                placeholder="0.00"
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <InputLabel>Reason / Description</InputLabel>
                                        <textarea
                                            rows={3}
                                            value={creditNoteData.reason}
                                            onChange={(e) => setCreditNoteData({ ...creditNoteData, reason: e.target.value })}
                                            className="w-full rounded-[7px] px-3 py-2.5 text-[12.5px] text-gray-900 bg-white outline-none focus:ring-2 focus:ring-[#6366F1]/15 transition-all resize-none"
                                            style={{ border: HAIRLINE }}
                                        />
                                    </div>
                                </div>
                            </div>
                            <div>
                                <SectionHeader title="Customer Info" />
                                <div className="space-y-4">
                                    <div>
                                        <InputLabel>Customer Name</InputLabel>
                                        {renderCustomerInput(creditNoteData.customer.name, (val) =>
                                            setCreditNoteData({ ...creditNoteData, customer: { ...creditNoteData.customer, name: val } }))}
                                    </div>
                                    <div>
                                        <InputLabel>Address</InputLabel>
                                        <textarea
                                            rows={3}
                                            value={creditNoteData.customer.address}
                                            onChange={(e) => setCreditNoteData({ ...creditNoteData, customer: { ...creditNoteData.customer, address: e.target.value } })}
                                            className="w-full rounded-[7px] px-3 py-2.5 text-[12.5px] text-gray-900 bg-white outline-none focus:ring-2 focus:ring-[#6366F1]/15 transition-all resize-none"
                                            style={{ border: HAIRLINE }}
                                        />
                                    </div>
                                    <div>
                                        <InputLabel>TIN / Tax ID</InputLabel>
                                        <StudioInput value={creditNoteData.customer.tin} onChange={(e: any) => setCreditNoteData({ ...creditNoteData, customer: { ...creditNoteData.customer, tin: e.target.value } })} />
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {/* ── RECEIPT FORM ── */}
                    {activeTab === 'RECEIPT' && (
                        <motion.div key="receipt" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="space-y-7">
                            <div>
                                <SectionHeader title="Receipt Details" />
                                <div className="space-y-4">
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <InputLabel>Receipt Date</InputLabel>
                                            <StudioDatePicker value={receiptData.receiptDate} onChange={(date) => setReceiptData({ ...receiptData, receiptDate: date })} />
                                        </div>
                                        <div>
                                            <InputLabel>Payment Date</InputLabel>
                                            <StudioDatePicker value={receiptData.paymentDate} onChange={(date) => setReceiptData({ ...receiptData, paymentDate: date })} />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <InputLabel>Receipt No</InputLabel>
                                            <StudioInput value={receiptData.receiptNo} onChange={(e: any) => setReceiptData({ ...receiptData, receiptNo: e.target.value })} />
                                        </div>
                                        <div>
                                            <InputLabel>Currency</InputLabel>
                                            <StudioInput value={receiptData.currency} onChange={(e: any) => setReceiptData({ ...receiptData, currency: e.target.value })} />
                                        </div>
                                    </div>
                                    <div>
                                        <InputLabel>Received From</InputLabel>
                                        {renderCustomerInput(receiptData.receivedFrom, (val) => setReceiptData({ ...receiptData, receivedFrom: val }))}
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <InputLabel>Payment Method</InputLabel>
                                            <StudioInput value={receiptData.paymentMethod} onChange={(e: any) => setReceiptData({ ...receiptData, paymentMethod: e.target.value })} />
                                        </div>
                                        <div>
                                            <InputLabel>Transaction Ref</InputLabel>
                                            <StudioInput value={receiptData.transactionRef} onChange={(e: any) => setReceiptData({ ...receiptData, transactionRef: e.target.value })} />
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div>
                                <SectionHeader title="Invoice Linking" />
                                <div className="space-y-4">
                                    <div>
                                        <InputLabel>Invoice Number</InputLabel>
                                        <StudioInput value={receiptData.invoiceNumber} onChange={(e: any) => setReceiptData({ ...receiptData, invoiceNumber: e.target.value })} />
                                    </div>
                                    <div>
                                        <InputLabel>Service Type</InputLabel>
                                        <StudioInput value={receiptData.serviceType} onChange={(e: any) => setReceiptData({ ...receiptData, serviceType: e.target.value })} />
                                    </div>
                                    <div>
                                        <InputLabel>Billing Period</InputLabel>
                                        <StudioInput value={receiptData.billingPeriod} onChange={(e: any) => setReceiptData({ ...receiptData, billingPeriod: e.target.value })} />
                                    </div>
                                </div>
                            </div>
                            <div>
                                <SectionHeader title="Financials" />
                                <div className="space-y-4">
                                    <div>
                                        <InputLabel>Original Amount</InputLabel>
                                        <StudioNumberInput value={receiptData.originalAmount || ''} onChange={(e: any) => setReceiptData({ ...receiptData, originalAmount: parseFloat(e.target.value) || 0 })} placeholder="0.00" />
                                    </div>
                                    <div>
                                        <InputLabel>Credit Note Applied</InputLabel>
                                        <StudioNumberInput value={receiptData.creditNoteApplied || ''} onChange={(e: any) => setReceiptData({ ...receiptData, creditNoteApplied: parseFloat(e.target.value) || 0 })} placeholder="0.00" />
                                    </div>
                                    <div>
                                        <InputLabel>Adjusted Amount Due</InputLabel>
                                        <StudioNumberInput value={receiptData.adjustedAmountDue || ''} onChange={(e: any) => setReceiptData({ ...receiptData, adjustedAmountDue: parseFloat(e.target.value) || 0 })} placeholder="0.00" />
                                    </div>
                                    <div>
                                        <InputLabel>Total Amount Paid</InputLabel>
                                        <StudioNumberInput value={receiptData.amountPaid || ''} onChange={(e: any) => setReceiptData({ ...receiptData, amountPaid: parseFloat(e.target.value) || 0 })} placeholder="0.00" />
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {/* ── STATEMENT FORM ── */}
                    {activeTab === 'STATEMENT' && (
                        <motion.div key="statement" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="space-y-7">
                            {/* Info callout */}
                            <div className="flex items-start gap-2.5 px-3.5 py-3 rounded-[7px]"
                                style={{ background: 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.13)' }}>
                                <PiInfo className="text-[#6366F1] text-[14px] shrink-0 mt-0.5" />
                                <p className="text-[11px] text-gray-600 leading-relaxed">
                                    Select a <span className="font-[600] text-[#6366F1]">Date Range</span> below to generate a complete transaction history for the customer.
                                </p>
                            </div>

                            <div>
                                <SectionHeader title="Statement Settings" />
                                <div className="space-y-4">
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <InputLabel>Statement Date</InputLabel>
                                            <StudioDatePicker value={statementData.date} onChange={(date) => setStatementData({ ...statementData, date })} />
                                        </div>
                                        <div>
                                            <InputLabel>Statement No</InputLabel>
                                            <StudioInput value={statementData.statementNo} onChange={(e: any) => setStatementData({ ...statementData, statementNo: e.target.value })} />
                                        </div>
                                    </div>
                                    <div>
                                        <InputLabel>Period (Date Range)</InputLabel>
                                        <StudioDateRangePicker
                                            startDate={statementData.periodStart}
                                            endDate={statementData.periodEnd}
                                            onChange={(start, end) => setStatementData({ ...statementData, periodStart: start, periodEnd: end })}
                                            placeholder="Select period range"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div>
                                <SectionHeader title="Customer Details" />
                                <div className="space-y-4">
                                    <div>
                                        <InputLabel>Customer Name</InputLabel>
                                        {renderCustomerInput(statementData.customer.name, (val) =>
                                            setStatementData({ ...statementData, customer: { ...statementData.customer, name: val } }))}
                                    </div>
                                    <div>
                                        <InputLabel>Group</InputLabel>
                                        <StudioInput value={statementData.customer.group} onChange={(e: any) => setStatementData({ ...statementData, customer: { ...statementData.customer, group: e.target.value } })} />
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <InputLabel>Country</InputLabel>
                                            <StudioInput value={statementData.customer.country} onChange={(e: any) => setStatementData({ ...statementData, customer: { ...statementData.customer, country: e.target.value } })} />
                                        </div>
                                        <div>
                                            <InputLabel>Account Type</InputLabel>
                                            <StudioInput value={statementData.customer.accountType} onChange={(e: any) => setStatementData({ ...statementData, customer: { ...statementData.customer, accountType: e.target.value } })} />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Transactions */}
                            <div>
                                <div className="flex items-center justify-between pb-2 mb-4" style={{ borderBottom: HAIRLINE }}>
                                    <p className="text-[10px] font-[700] uppercase tracking-[0.09em] text-gray-400">
                                        Transactions
                                        <span className="ml-2 text-gray-300 font-[600]">({statementData.transactions.length})</span>
                                    </p>
                                    <div className="flex items-center gap-1.5">
                                        <button onClick={sortTransactions}
                                            className="w-[26px] h-[26px] flex items-center justify-center rounded-[5px] text-gray-400 hover:text-[#6366F1] hover:bg-indigo-50 transition-colors"
                                            style={{ border: HAIRLINE }} title="Sort Chronologically">
                                            <PiSortAscending className="text-[13px]" />
                                        </button>
                                        <button onClick={handleDownloadTemplate}
                                            className="flex items-center gap-1 px-2.5 py-1 rounded-[5px] text-[10px] font-[600] text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                                            style={{ border: HAIRLINE }}>
                                            Template
                                        </button>
                                        <label className="flex items-center gap-1 px-2.5 py-1 rounded-[5px] text-[10px] font-[600] cursor-pointer transition-colors"
                                            style={{ border: '1px solid rgba(5,150,105,0.2)', color: '#059669', background: 'rgba(5,150,105,0.05)' }}>
                                            <PiUpload className="text-[11px]" /> Upload
                                            <input type="file" accept=".xlsx,.xls" className="hidden" onChange={handleUploadTemplate} />
                                        </label>
                                        <button onClick={addStatementTransaction}
                                            className="w-[26px] h-[26px] flex items-center justify-center rounded-[5px] text-white transition-colors"
                                            style={{ background: '#6366F1' }} title="Add Line">
                                            <PiPlus className="text-[13px]" />
                                        </button>
                                    </div>
                                </div>

                                {statementData.transactions.length === 0 ? (
                                    <div className="py-8 text-center rounded-[7px]" style={{ border: `1px dashed rgba(0,0,0,0.1)` }}>
                                        <p className="text-[11.5px] text-gray-400">No transactions yet</p>
                                        <p className="text-[10.5px] text-gray-300 mt-0.5">Click + to add a line or upload an Excel file</p>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        {statementData.transactions.map((tx, idx) => (
                                            <div key={tx.id || idx}
                                                className="rounded-[7px] p-3.5 group relative"
                                                style={{ border: HAIRLINE }}>
                                                <button onClick={() => removeStatementTransaction(idx)}
                                                    className="absolute top-2.5 right-2.5 text-gray-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all p-1 rounded-[4px] hover:bg-rose-50"
                                                    title="Remove">
                                                    <PiTrash className="text-[12px]" />
                                                </button>
                                                <div className="grid grid-cols-2 gap-2 mb-2">
                                                    <div>
                                                        <p className="text-[9.5px] font-[600] uppercase tracking-[0.08em] text-gray-400 mb-1">Description</p>
                                                        <input type="text" value={tx.operator}
                                                            onChange={(e) => handleStatementTransactionChange(idx, 'operator', e.target.value)}
                                                            className="w-full rounded-[5px] px-2.5 py-1.5 text-[11.5px] text-gray-900 bg-gray-50 outline-none focus:ring-1 focus:ring-[#6366F1]/20 transition-all"
                                                            style={{ border: HAIRLINE }} />
                                                    </div>
                                                    <div>
                                                        <p className="text-[9.5px] font-[600] uppercase tracking-[0.08em] text-gray-400 mb-1">Reference</p>
                                                        <input type="text" value={tx.invoiceRef}
                                                            onChange={(e) => handleStatementTransactionChange(idx, 'invoiceRef', e.target.value)}
                                                            className="w-full rounded-[5px] px-2.5 py-1.5 text-[11.5px] text-gray-900 bg-gray-50 outline-none focus:ring-1 focus:ring-[#6366F1]/20 transition-all"
                                                            style={{ border: HAIRLINE }} />
                                                    </div>
                                                </div>
                                                <div className="mb-2">
                                                    <p className="text-[9.5px] font-[600] uppercase tracking-[0.08em] text-gray-400 mb-1">Period</p>
                                                    <input type="text" value={tx.period}
                                                        onChange={(e) => handleStatementTransactionChange(idx, 'period', e.target.value)}
                                                        className="w-full rounded-[5px] px-2.5 py-1.5 text-[11.5px] text-gray-900 bg-gray-50 outline-none focus:ring-1 focus:ring-[#6366F1]/20 transition-all"
                                                        style={{ border: HAIRLINE }} />
                                                </div>
                                                <div className="grid grid-cols-2 gap-2">
                                                    <div>
                                                        <p className="text-[9.5px] font-[600] uppercase tracking-[0.08em] text-gray-400 mb-1">Debit</p>
                                                        <input type="number" value={tx.debit || ''}
                                                            onChange={(e) => handleStatementTransactionChange(idx, 'debit', e.target.value ? parseFloat(e.target.value) : 0)}
                                                            className="w-full rounded-[5px] px-2.5 py-1.5 text-[11.5px] font-mono text-gray-900 bg-gray-50 outline-none focus:ring-1 focus:ring-[#6366F1]/20 transition-all"
                                                            style={{ border: HAIRLINE }} placeholder="0.00" />
                                                    </div>
                                                    <div>
                                                        <p className="text-[9.5px] font-[600] uppercase tracking-[0.08em] text-gray-400 mb-1">Credit</p>
                                                        <input type="number" value={tx.credit || ''}
                                                            onChange={(e) => handleStatementTransactionChange(idx, 'credit', e.target.value ? parseFloat(e.target.value) : 0)}
                                                            className="w-full rounded-[5px] px-2.5 py-1.5 text-[11.5px] font-mono text-gray-900 bg-gray-50 outline-none focus:ring-1 focus:ring-[#6366F1]/20 transition-all"
                                                            style={{ border: HAIRLINE }} placeholder="0.00" />
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Summary Override */}
                            <div>
                                <SectionHeader title="Summary Override" />
                                <div>
                                    <InputLabel>Opening Balance</InputLabel>
                                    <StudioNumberInput
                                        value={statementData.summary.openingBalance || ''}
                                        onChange={(e: any) => {
                                            const newOpening = parseFloat(e.target.value) || 0;
                                            setStatementData({ ...statementData, summary: recalculateStatementSummary(statementData.transactions, newOpening) });
                                        }}
                                        placeholder="0.00"
                                    />
                                </div>
                            </div>

                            {/* Notes */}
                            <div>
                                <div className="flex items-center justify-between pb-2 mb-4" style={{ borderBottom: HAIRLINE }}>
                                    <p className="text-[10px] font-[700] uppercase tracking-[0.09em] text-gray-400">Notes to Customer</p>
                                    <button onClick={() => setStatementData({ ...statementData, notes: [...statementData.notes, 'New note line...'] })}
                                        className="flex items-center gap-1 px-2.5 py-1 rounded-[5px] text-[10px] font-[600] text-[#6366F1] transition-colors"
                                        style={{ border: '1px solid rgba(99,102,241,0.2)', background: 'rgba(99,102,241,0.05)' }}>
                                        <PiPlus className="text-[11px]" /> Add Note
                                    </button>
                                </div>
                                <div className="space-y-2">
                                    {statementData.notes.map((note, idx) => (
                                        <div key={idx} className="relative group">
                                            <textarea
                                                value={note}
                                                rows={2}
                                                onChange={(e) => {
                                                    const newNotes = [...statementData.notes];
                                                    newNotes[idx] = e.target.value;
                                                    setStatementData({ ...statementData, notes: newNotes });
                                                }}
                                                className="w-full rounded-[7px] px-3 py-2.5 text-[11.5px] text-gray-700 bg-white outline-none focus:ring-2 focus:ring-[#6366F1]/15 transition-all resize-none pr-8"
                                                style={{ border: HAIRLINE }}
                                            />
                                            <button
                                                onClick={() => {
                                                    const newNotes = [...statementData.notes];
                                                    newNotes.splice(idx, 1);
                                                    setStatementData({ ...statementData, notes: newNotes });
                                                }}
                                                className="absolute top-2 right-2 text-gray-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all p-0.5">
                                                <PiTrash className="text-[12px]" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </motion.div>
                    )}
                </div>

                {/* Bottom actions */}
                <div className="px-5 py-4 grid grid-cols-2 gap-3 shrink-0" style={{ borderTop: HAIRLINE }}>
                    <button
                        onClick={async () => {
                            try {
                                let key = '';
                                let value = '';
                                if (activeTab === 'STATEMENT') { key = 'studio_draft_statement'; value = JSON.stringify(statementData); }
                                else if (activeTab === 'CREDIT_NOTE') { key = 'studio_draft_credit_note'; value = JSON.stringify(creditNoteData); }
                                else if (activeTab === 'RECEIPT') { key = 'studio_draft_receipt'; value = JSON.stringify(receiptData); }
                                if (!key) return;
                                const res = await fetch('/api/settings', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ updates: [{ key, value, description: 'Finance Studio draft' }] })
                                });
                                if (res.ok) { setDraftSaved(true); setTimeout(() => setDraftSaved(false), 2500); }
                                else throw new Error('Server error');
                            } catch { alert('Could not save draft. Please try again.'); }
                        }}
                        className="flex items-center justify-center gap-2 py-2.5 rounded-[7px] text-[12px] font-[600] transition-all"
                        style={draftSaved
                            ? { background: 'rgba(5,150,105,0.08)', color: '#059669', border: '1px solid rgba(5,150,105,0.2)' }
                            : { background: 'white', color: '#374151', border: HAIRLINE }}>
                        <PiFloppyDisk className="text-[15px]" />
                        {draftSaved ? 'Saved!' : 'Save Draft'}
                    </button>
                    <button
                        onClick={async (e) => {
                            const btn = e.currentTarget;
                            const originalContent = btn.innerHTML;
                            try {
                                btn.innerHTML = 'Generating PDF…';
                                btn.disabled = true;
                                const origin = typeof window !== 'undefined' ? window.location.origin : '';
                                let MyDocument;
                                if (activeTab === 'STATEMENT') {
                                    const { periodStart: ps, periodEnd: pe, ...stmtRest } = statementData;
                                    const stmtPeriod = ps && pe ? `${format(ps, 'dd MMM yyyy')} - ${format(pe, 'dd MMM yyyy')}` : 'All Time';
                                    MyDocument = <StatementPDF data={{ ...stmtRest, period: stmtPeriod }} baseUrl={origin} settings={settings} />;
                                } else if (activeTab === 'CREDIT_NOTE') {
                                    MyDocument = <CreditNotePDF data={creditNoteData} baseUrl={origin} settings={settings} />;
                                } else {
                                    MyDocument = <ReceiptPDF data={receiptData} baseUrl={origin} settings={settings} />;
                                }
                                const blob = await pdf(MyDocument).toBlob();
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
                        }}
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
                        className="preview-canvas bg-white shadow-[0_8px_40px_-12px_rgba(0,0,0,0.18)] z-10 print:shadow-none print:m-0 print-container-wrapper rounded-[2px] transition-transform duration-300 print:w-full print:h-full print:transform-none"
                        style={{
                            width: '210mm',
                            minHeight: '297mm',
                            transform: 'scale(0.85)',
                            transformOrigin: 'top center',
                        }}>
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={activeTab}
                                initial={{ opacity: 0, scale: 0.99 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.99 }}
                                transition={{ duration: 0.2, ease: "easeOut" }}
                                className="print:h-full flex flex-col"
                            >
                                {activeTab === 'CREDIT_NOTE' && <CreditNoteTemplate {...creditNoteData} />}
                                {activeTab === 'RECEIPT' && <PaymentReceiptTemplate {...receiptData} />}
                                {activeTab === 'STATEMENT' && (() => {
                                    const { periodStart, periodEnd, ...rest } = statementData;
                                    const period = periodStart && periodEnd
                                        ? `${format(periodStart, 'dd MMM yyyy')} - ${format(periodEnd, 'dd MMM yyyy')}`
                                        : '';
                                    return <CustomerStatementTemplate {...rest} period={period} />;
                                })()}
                            </motion.div>
                        </AnimatePresence>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function FinanceStudioPage() {
    return (
        <Suspense fallback={
            <div className="flex items-center justify-center h-screen bg-white">
                <div className="flex flex-col items-center gap-3">
                    <div className="w-[30px] h-[30px] rounded-[7px] bg-[#6366F1] flex items-center justify-center">
                        <PiFileText className="text-white text-[15px]" />
                    </div>
                    <p className="text-[12px] text-gray-400">Loading Finance Studio…</p>
                </div>
            </div>
        }>
            <FinanceStudioContent />
        </Suspense>
    );
}
