
"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { PiPlus, PiX, PiBookOpenText, PiSpinner, PiBank, PiNotebook, PiTrash, PiArrowsClockwise, PiMagicWand, PiPencil, PiCheck } from "react-icons/pi";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/ToastProvider";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { CustomSelect } from "@/components/ui/CustomSelect";

interface AccountingActionsProps {
    type: "NEW_ACCOUNT" | "MANUAL_JOURNAL" | "VOID_ENTRY" | "EDIT_ENTRY";
    entryId?: string;
    entryNumber?: string;
    /** Only used by EDIT_ENTRY — seeds the form with the draft's current values */
    initialEntry?: {
        date: string;
        description: string;
        reference?: string;
        lines: { accountId: string; debit: number; credit: number }[];
    };
    /** 'primary' = indigo filled (default for CoA page), 'secondary' = subtle outlined (for inline use) */
    variant?: 'primary' | 'secondary';
}

interface Account {
    id: string;
    code: string;
    name: string;
    type: string;
}

interface JournalLine {
    id: number;
    accountId: string;
    debit: number;
    credit: number;
}

export function AccountingActions({ type, entryId, entryNumber, initialEntry, variant = 'primary' }: AccountingActionsProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [mounted, setMounted] = useState(false);
    const [accounts, setAccounts] = useState<Account[]>([]);
    const router = useRouter();
    const { showToast } = useToast();

    useEffect(() => {
        setMounted(true);
    }, []);

    // Fetch Chart of Accounts
    useEffect(() => {
        if (isOpen && (type === "MANUAL_JOURNAL" || type === "EDIT_ENTRY")) {
            fetchAccounts();
        }
    }, [isOpen, type]);

    const fetchAccounts = async () => {
        try {
            const res = await fetch("/api/accounting/accounts");
            if (res.ok) {
                const data = await res.json();
                setAccounts(data);
            }
        } catch (error) {
            console.error("Failed to fetch accounts:", error);
        }
    };

    // Subtype options per account type
    const SUBTYPE_OPTIONS: Record<string, { value: string; label: string }[]> = {
        ASSET: [
            { value: 'CURRENT_ASSET',      label: 'Current Asset' },
            { value: 'FIXED_ASSET',        label: 'Fixed Asset' },
            { value: 'NON_CURRENT_ASSET',  label: 'Non-Current Asset' },
            { value: 'CASH',               label: 'Cash & Cash Equivalents' },
            { value: 'BANK',               label: 'Bank Account' },
            { value: 'ACCOUNTS_RECEIVABLE',label: 'Accounts Receivable' },
            { value: 'INVENTORY',          label: 'Inventory' },
            { value: 'OTHER_ASSET',        label: 'Other Asset' },
        ],
        LIABILITY: [
            { value: 'CURRENT_LIABILITY',  label: 'Current Liability' },
            { value: 'LONG_TERM_LIABILITY',label: 'Long-term Liability' },
            { value: 'ACCOUNTS_PAYABLE',   label: 'Accounts Payable' },
            { value: 'CREDIT_CARD',        label: 'Credit Card' },
            { value: 'OTHER_LIABILITY',    label: 'Other Liability' },
        ],
        EQUITY: [
            { value: 'COMMON_STOCK',       label: 'Common Stock' },
            { value: 'RETAINED_EARNINGS',  label: 'Retained Earnings' },
            { value: 'OWNERS_EQUITY',      label: "Owner's Equity" },
            { value: 'OTHER_EQUITY',       label: 'Other Equity' },
        ],
        REVENUE: [
            { value: 'SALES',              label: 'Sales Income' },
            { value: 'SERVICE_REVENUE',    label: 'Service Revenue' },
            { value: 'OTHER_INCOME',       label: 'Other Income' },
        ],
        EXPENSE: [
            { value: 'OPERATING_EXPENSE',  label: 'Operating Expense' },
            { value: 'COST_OF_GOODS_SOLD', label: 'Cost of Goods Sold' },
            { value: 'PAYROLL_EXPENSE',    label: 'Payroll Expense' },
            { value: 'ADMINISTRATIVE',     label: 'Administrative Expense' },
            { value: 'OTHER_EXPENSE',      label: 'Other Expense' },
        ],
    };

    const defaultSubtype = (t: string) => SUBTYPE_OPTIONS[t]?.[0]?.value ?? '';

    // ACCOUNT FORM STATE
    const [accountData, setAccountData] = useState({
        code: "",
        name: "",
        type: "EXPENSE",
        subtype: "OPERATING_EXPENSE",
        description: ""
    });

    // Account code: auto vs custom
    const [codeMode, setCodeMode] = useState<'auto' | 'custom'>('auto');
    const [autoCode, setAutoCode] = useState<string>('');
    const [codeSuggestions, setCodeSuggestions] = useState<{ code: string; name: string; available: boolean }[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [loadingCode, setLoadingCode] = useState(false);
    const codeInputRef = useRef<HTMLInputElement>(null);

    const fetchSuggestedCode = async (type: string, query = '') => {
        setLoadingCode(true);
        try {
            const res = await fetch(`/api/accounting/accounts/suggest-code?type=${type}&query=${encodeURIComponent(query)}`);
            if (res.ok) {
                const data = await res.json();
                setAutoCode(data.nextCode);
                setCodeSuggestions(data.suggestions);
                if (codeMode === 'auto') {
                    setAccountData(prev => ({ ...prev, code: data.nextCode }));
                }
            }
        } finally {
            setLoadingCode(false);
        }
    };

    // Fetch auto code whenever modal opens or type changes
    useEffect(() => {
        if (isOpen && type === 'NEW_ACCOUNT') {
            fetchSuggestedCode(accountData.type);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, accountData.type, type]);

    const handleTypeChange = (val: string) => {
        setAccountData(prev => ({ ...prev, type: val, subtype: defaultSubtype(val) }));
        // auto code re-fetched via useEffect above
    };

    const handleCodeInput = (val: string) => {
        setAccountData(prev => ({ ...prev, code: val }));
        if (val.trim().length > 0) {
            fetchSuggestedCode(accountData.type, val);
            setShowSuggestions(true);
        } else {
            setShowSuggestions(false);
        }
    };

    const switchToCustom = () => {
        setCodeMode('custom');
        setAccountData(prev => ({ ...prev, code: '' }));
        fetchSuggestedCode(accountData.type, '');
        setShowSuggestions(true);
        setTimeout(() => codeInputRef.current?.focus(), 50);
    };

    const switchToAuto = () => {
        setCodeMode('auto');
        setAccountData(prev => ({ ...prev, code: autoCode }));
        setShowSuggestions(false);
    };

    const pickSuggestion = (code: string) => {
        setAccountData(prev => ({ ...prev, code }));
        setShowSuggestions(false);
    };

    // JOURNAL FORM STATE — for EDIT_ENTRY this seeds from the draft's current values
    const [journalData, setJournalData] = useState(() => {
        if (initialEntry) {
            return {
                date: initialEntry.date,
                description: initialEntry.description,
                reference: initialEntry.reference || "",
                lines: initialEntry.lines.map((l, i) => ({ id: i + 1, ...l })) as JournalLine[]
            };
        }
        return {
            date: new Date().toISOString().split('T')[0],
            description: "",
            reference: "",
            lines: [
                { id: 1, accountId: "", debit: 0, credit: 0 },
                { id: 2, accountId: "", debit: 0, credit: 0 }
            ] as JournalLine[]
        };
    });

    // VOID FORM STATE
    const [voidReason, setVoidReason] = useState("");

    const addLine = () => {
        const newId = Math.max(...journalData.lines.map(l => l.id), 0) + 1;
        setJournalData(prev => ({
            ...prev,
            lines: [...prev.lines, { id: newId, accountId: "", debit: 0, credit: 0 }]
        }));
    };

    const removeLine = (id: number) => {
        if (journalData.lines.length <= 2) {
            showToast("You must have at least 2 lines", "error");
            return;
        }
        setJournalData(prev => ({
            ...prev,
            lines: prev.lines.filter(l => l.id !== id)
        }));
    };

    const updateLine = (id: number, field: keyof JournalLine, value: any) => {
        setJournalData(prev => ({
            ...prev,
            lines: prev.lines.map(l =>
                l.id === id ? { ...l, [field]: value } : l
            )
        }));
    };

    const getTotals = () => {
        const totalDebit = journalData.lines.reduce((s, l) => s + Number(l.debit || 0), 0);
        const totalCredit = journalData.lines.reduce((s, l) => s + Number(l.credit || 0), 0);
        const difference = totalDebit - totalCredit;
        return { totalDebit, totalCredit, difference, isBalanced: Math.abs(difference) < 0.01 };
    };

    const resetAccountForm = () => {
        setAccountData({ code: '', name: '', type: 'EXPENSE', subtype: defaultSubtype('EXPENSE'), description: '' });
        setCodeMode('auto');
        setAutoCode('');
        setCodeSuggestions([]);
        setShowSuggestions(false);
    };

    const handleCreateAccount = async () => {
        if (!accountData.name.trim()) {
            showToast("Account name is required", "error");
            return;
        }
        if (!accountData.code.trim()) {
            showToast("Account code is required", "error");
            return;
        }
        setIsSubmitting(true);
        try {
            const res = await fetch("/api/accounting/accounts", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(accountData)
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || "Failed to create account");
            }
            showToast("Account created successfully", "success");
            resetAccountForm();
            setIsOpen(false);
            router.refresh();
        } catch (error: any) {
            showToast(error.message || "Error creating account", "error");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleCreateJournal = async (asDraft: boolean = false) => {
        setIsSubmitting(true);
        const { isBalanced, totalDebit, totalCredit } = getTotals();
        if (!isBalanced) {
            showToast(`Entry not balanced! Debits: $${totalDebit.toFixed(2)}, Credits: $${totalCredit.toFixed(2)}`, "error");
            setIsSubmitting(false);
            return;
        }
        try {
            const res = await fetch("/api/accounting/journal", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ...journalData, status: asDraft ? 'DRAFT' : undefined })
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || "Failed to post journal entry");
            showToast(asDraft ? "Saved as draft" : "Journal entry posted successfully", "success");
            setIsOpen(false);
            router.refresh();
        } catch (error: any) {
            showToast(error.message || "Error posting journal", "error");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleUpdateJournal = async () => {
        if (!entryId) return;
        setIsSubmitting(true);
        const { isBalanced, totalDebit, totalCredit } = getTotals();
        if (!isBalanced) {
            showToast(`Entry not balanced! Debits: ${totalDebit.toFixed(2)}, Credits: ${totalCredit.toFixed(2)}`, "error");
            setIsSubmitting(false);
            return;
        }
        try {
            const res = await fetch("/api/accounting/journal", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ entryId, ...journalData })
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || "Failed to update entry");
            showToast("Draft updated successfully", "success");
            setIsOpen(false);
            router.refresh();
        } catch (error: any) {
            showToast(error.message || "Error updating journal entry", "error");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handlePostDraft = async () => {
        if (!entryId) return;
        setIsSubmitting(true);
        try {
            const res = await fetch("/api/accounting/journal", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "POST_DRAFT", entryId })
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || "Failed to post entry");
            showToast("Draft posted to the ledger", "success");
            setIsOpen(false);
            router.refresh();
        } catch (error: any) {
            showToast(error.message || "Error posting draft", "error");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleVoidEntry = async () => {
        if (!entryId) return;
        if (!voidReason.trim()) {
            showToast("A reason is required to void an entry", "error");
            return;
        }
        setIsSubmitting(true);
        try {
            const res = await fetch("/api/accounting/journal", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "VOID", entryId, reason: voidReason })
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || "Failed to void entry");
            showToast("Journal entry voided — a reversing entry has been posted", "success");
            setIsOpen(false);
            setVoidReason("");
            router.refresh();
        } catch (error: any) {
            showToast(error.message || "Error voiding journal entry", "error");
        } finally {
            setIsSubmitting(false);
        }
    };



    const totals = getTotals();

    const modalContent = (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6 lg:p-8 font-sans">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setIsOpen(false)}
                        className="fixed inset-0 bg-white/60 backdrop-blur-xl"
                    />
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className={cn(
                            "relative bg-white border border-gray-200 w-full rounded-xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col",
                            type === "VOID_ENTRY" ? "max-w-md" : "max-w-4xl"
                        )}
                    >
                        {/* Header */}
                        <div className={cn(
                            "px-8 flex justify-between items-center bg-white border-b border-gray-100 shrink-0",
                            type === "VOID_ENTRY" ? "h-16" : "h-[88px]"
                        )}>
                            <div className="flex items-center gap-4">
                                <div className={cn(
                                    "p-3 rounded-xl",
                                    type === "VOID_ENTRY" ? "bg-rose-50 text-rose-600 p-2" : "bg-[#F6F6F6] text-[#6366F1]"
                                )}>
                                    {type === "NEW_ACCOUNT" ? <PiBank className="text-2xl" />
                                        : type === "MANUAL_JOURNAL" || type === "EDIT_ENTRY" ? <PiNotebook className="text-2xl" />
                                        : <PiArrowsClockwise className="text-xl" />}
                                </div>
                                <div>
                                    <h3 className="text-base font-semibold text-gray-900 mb-0.5">
                                        {type === "NEW_ACCOUNT" ? "Create New Account"
                                            : type === "MANUAL_JOURNAL" ? "Post Journal Entry"
                                            : type === "EDIT_ENTRY" ? "Edit Draft Entry"
                                            : "Void Journal Entry"}
                                    </h3>
                                    {type !== "VOID_ENTRY" && (
                                        <p className="text-gray-500 text-xs font-medium">
                                            {type === "NEW_ACCOUNT" ? "Add a new GL code"
                                                : type === "EDIT_ENTRY" ? "Only drafts can be edited before posting"
                                                : "Record double-entry transaction"}
                                        </p>
                                    )}
                                </div>
                            </div>
                            <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-gray-900 h-10 w-10">
                                <PiX className="text-xl" />
                            </Button>
                        </div>

                        {/* Content */}
                        <div className={cn(
                            "flex-1 overflow-y-auto custom-scrollbar bg-[#F6F6F6] space-y-6",
                            type === "VOID_ENTRY" ? "p-6" : "p-8"
                        )}>
                            {type === "NEW_ACCOUNT" ? (
                                <div className="space-y-5">
                                    {/* Account Type — pick first so code range is known */}
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-700 uppercase mb-1.5">Type</label>
                                        <CustomSelect
                                            value={accountData.type}
                                            onChange={handleTypeChange}
                                            options={[
                                                { value: "ASSET", label: "Asset (1000–1999)" },
                                                { value: "LIABILITY", label: "Liability (2000–2999)" },
                                                { value: "EQUITY", label: "Equity (3000–3999)" },
                                                { value: "REVENUE", label: "Revenue (4000–4999)" },
                                                { value: "EXPENSE", label: "Expense (5000–5999)" },
                                            ]}
                                            className="w-full px-4 h-11 bg-white border border-gray-200 rounded-xl outline-none text-sm font-medium"
                                        />
                                    </div>

                                    {/* Account Code */}
                                    <div>
                                        <div className="flex items-center justify-between mb-1.5">
                                            <label className="block text-xs font-semibold text-gray-700 uppercase">Account Code</label>
                                            <div className="flex items-center rounded-[6px] overflow-hidden text-[11px]"
                                                style={{ border: '1px solid rgba(0,0,0,0.09)' }}>
                                                <button
                                                    type="button"
                                                    onClick={switchToAuto}
                                                    className={cn(
                                                        "flex items-center gap-1 px-2.5 py-1 transition-colors",
                                                        codeMode === 'auto'
                                                            ? "bg-[#6366F1] text-white"
                                                            : "bg-white text-gray-500 hover:bg-gray-50"
                                                    )}>
                                                    <PiMagicWand className="text-[10px]" /> Auto
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={switchToCustom}
                                                    className={cn(
                                                        "flex items-center gap-1 px-2.5 py-1 transition-colors",
                                                        codeMode === 'custom'
                                                            ? "bg-[#6366F1] text-white"
                                                            : "bg-white text-gray-500 hover:bg-gray-50"
                                                    )}
                                                    style={{ borderLeft: '1px solid rgba(0,0,0,0.09)' }}>
                                                    <PiPencil className="text-[10px]" /> Custom
                                                </button>
                                            </div>
                                        </div>

                                        {codeMode === 'auto' ? (
                                            <div className="flex items-center gap-3 h-11 px-4 bg-indigo-50 rounded-xl font-mono text-[15px] font-[600] text-[#6366F1]"
                                                style={{ border: '1px solid rgba(99,102,241,0.2)' }}>
                                                {loadingCode
                                                    ? <PiSpinner className="animate-spin text-[#6366F1]" />
                                                    : <><PiCheck className="text-[13px] shrink-0" />{autoCode}</>}
                                                <span className="ml-auto text-[11px] font-[400] text-indigo-400">auto-assigned</span>
                                            </div>
                                        ) : (
                                            <div className="relative">
                                                <Input
                                                    ref={codeInputRef}
                                                    type="text"
                                                    className="bg-white border-gray-200 h-11 font-mono"
                                                    placeholder={`e.g. ${autoCode || '5100'}`}
                                                    value={accountData.code}
                                                    onChange={(e) => handleCodeInput(e.target.value)}
                                                    onFocus={() => { fetchSuggestedCode(accountData.type, accountData.code); setShowSuggestions(true); }}
                                                    onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                                                    autoComplete="off"
                                                />
                                                <AnimatePresence>
                                                    {showSuggestions && codeSuggestions.length > 0 && (
                                                        <motion.div
                                                            initial={{ opacity: 0, y: -4 }}
                                                            animate={{ opacity: 1, y: 0 }}
                                                            exit={{ opacity: 0, y: -4 }}
                                                            className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-lg z-50 overflow-hidden"
                                                            style={{ border: '1px solid rgba(0,0,0,0.1)' }}>
                                                            <div className="px-3 py-1.5 text-[10px] font-[500] text-gray-400 uppercase tracking-wider"
                                                                style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                                                                Suggestions
                                                            </div>
                                                            {codeSuggestions.map(s => (
                                                                <button
                                                                    key={s.code}
                                                                    type="button"
                                                                    onMouseDown={() => pickSuggestion(s.code)}
                                                                    className={cn(
                                                                        "w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-indigo-50 transition-colors",
                                                                        !s.available && "opacity-40 pointer-events-none"
                                                                    )}>
                                                                    <span className="font-mono text-[13px] font-[600] text-gray-900">{s.code}</span>
                                                                    {s.name
                                                                        ? <span className="text-[11px] text-gray-400 truncate ml-3">{s.name} · taken</span>
                                                                        : <span className="text-[11px] text-emerald-500">available</span>}
                                                                </button>
                                                            ))}
                                                        </motion.div>
                                                    )}
                                                </AnimatePresence>
                                            </div>
                                        )}
                                    </div>

                                    {/* Account Name */}
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-700 uppercase mb-1.5">Account Name</label>
                                        <Input
                                            type="text"
                                            className="bg-white border-gray-200 h-11"
                                            placeholder="e.g. Office Supplies"
                                            value={accountData.name}
                                            onChange={(e) => setAccountData(prev => ({ ...prev, name: e.target.value }))}
                                        />
                                    </div>

                                    {/* Subtype — free text with suggestions */}
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-700 uppercase mb-1.5">
                                            Subtype <span className="font-normal normal-case text-gray-400">(type freely or pick a suggestion)</span>
                                        </label>
                                        <input
                                            list="new-account-subtypes"
                                            value={accountData.subtype}
                                            onChange={e => setAccountData(prev => ({ ...prev, subtype: e.target.value }))}
                                            placeholder={`e.g. ${SUBTYPE_OPTIONS[accountData.type]?.[0]?.label ?? 'Operating Expense'}`}
                                            className="w-full h-11 rounded-xl px-4 bg-white text-[13.5px] text-gray-900 outline-none focus:ring-2 focus:ring-[#6366F1]/20"
                                            style={{ border: '1px solid rgba(0,0,0,0.12)' }}
                                        />
                                        <datalist id="new-account-subtypes">
                                            {(SUBTYPE_OPTIONS[accountData.type] ?? []).map(o => (
                                                <option key={o.value} value={o.label} />
                                            ))}
                                        </datalist>
                                    </div>
                                </div>
                            ) : type === "MANUAL_JOURNAL" || type === "EDIT_ENTRY" ? (
                                <div className="space-y-6">
                                    <div className="grid grid-cols-3 gap-4">
                                        <Input type="date" value={journalData.date} onChange={e => setJournalData(p => ({ ...p, date: e.target.value }))} />
                                        <Input placeholder="Reference" value={journalData.reference} onChange={e => setJournalData(p => ({ ...p, reference: e.target.value }))} />
                                        <Input placeholder="Description" value={journalData.description} onChange={e => setJournalData(p => ({ ...p, description: e.target.value }))} />
                                    </div>
                                    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                                        {journalData.lines.map(line => (
                                            <div key={line.id} className="p-4 grid grid-cols-12 gap-3 border-b border-gray-100 last:border-0">
                                                <div className="col-span-6">
                                                    <CustomSelect
                                                        value={line.accountId}
                                                        onChange={val => updateLine(line.id, 'accountId', val)}
                                                        options={accounts.map(acc => ({ value: acc.id, label: `${acc.code} - ${acc.name}` }))}
                                                        placeholder="Select account..."
                                                        className="w-full h-10 bg-white border border-gray-200 rounded-lg text-sm"
                                                    />
                                                </div>
                                                <div className="col-span-2"><Input type="number" placeholder="Debit" value={line.debit || ''} onChange={e => updateLine(line.id, 'debit', parseFloat(e.target.value) || 0)} /></div>
                                                <div className="col-span-2"><Input type="number" placeholder="Credit" value={line.credit || ''} onChange={e => updateLine(line.id, 'credit', parseFloat(e.target.value) || 0)} /></div>
                                                <div className="col-span-2 flex justify-end">
                                                    {journalData.lines.length > 2 && <Button size="icon" variant="ghost" className="text-red-500" onClick={() => removeLine(line.id)}><PiTrash /></Button>}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    <Button variant="outline" onClick={addLine} className="text-[#6366F1]">
                                        <PiPlus className="mr-2" /> Add line
                                    </Button>
                                </div>

                            ) : (
                                <div className="space-y-4">
                                    <div className="text-center">
                                        <h3 className="text-lg font-semibold">Void {entryNumber || 'this entry'}?</h3>
                                        <p className="text-gray-500 text-sm mt-1 px-2">
                                            The entry is append-only and can't be deleted. Voiding posts a reversing
                                            entry that cancels it out and flags the original as VOID.
                                        </p>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-700 uppercase mb-1.5">Reason <span className="text-red-500">*</span></label>
                                        <textarea
                                            value={voidReason}
                                            onChange={e => setVoidReason(e.target.value)}
                                            placeholder="Why is this entry being voided?"
                                            rows={3}
                                            className="w-full rounded-xl px-4 py-2.5 bg-white text-sm outline-none focus:ring-2 focus:ring-[#6366F1]/20 resize-none"
                                            style={{ border: '1px solid rgba(0,0,0,0.12)' }}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className={cn(
                            "px-8 bg-white border-t border-gray-100 flex items-center justify-end gap-3 shrink-0",
                            type === "VOID_ENTRY" ? "h-16" : "h-[88px]"
                        )}>
                            <Button variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
                            {type === "VOID_ENTRY" ? (
                                <Button onClick={handleVoidEntry} disabled={isSubmitting || !voidReason.trim()} className="bg-rose-600 hover:bg-rose-700 text-white font-semibold">
                                    {isSubmitting ? "Voiding..." : "Void Entry"}
                                </Button>
                            ) : (
                                <>
                                    {type === "MANUAL_JOURNAL" && (
                                        <Button variant="outline" onClick={() => handleCreateJournal(true)} disabled={isSubmitting}>
                                            Save as Draft
                                        </Button>
                                    )}
                                    {type === "EDIT_ENTRY" && (
                                        <Button variant="outline" onClick={handlePostDraft} disabled={isSubmitting} className="text-emerald-600 border-emerald-200 hover:bg-emerald-50">
                                            Post to Ledger
                                        </Button>
                                    )}
                                    <Button
                                        onClick={type === "NEW_ACCOUNT" ? handleCreateAccount : type === "EDIT_ENTRY" ? handleUpdateJournal : () => handleCreateJournal(false)}
                                        disabled={isSubmitting}
                                        className="bg-[#6366F1] text-white font-semibold">
                                        {isSubmitting ? "Processing..." : type === "EDIT_ENTRY" ? "Save Changes" : type === "MANUAL_JOURNAL" ? "Post Entry" : "Submit"}
                                    </Button>
                                </>
                            )}
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );

    return (
        <>
            {type === "NEW_ACCOUNT" ? (
                variant === 'primary' ? (
                    <Button onClick={() => setIsOpen(true)} className="bg-[#6366F1] text-white">
                        <PiPlus className="mr-2" /> New Account
                    </Button>
                ) : (
                    <button onClick={() => setIsOpen(true)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] bg-white text-gray-600 text-[12px] font-[500] hover:bg-gray-50 transition-colors"
                        style={{ border: '1px solid rgba(0,0,0,0.09)' }}>
                        <PiPlus className="text-[12px]" /> New Account
                    </button>
                )
            ) : type === "MANUAL_JOURNAL" ? (
                <Button onClick={() => setIsOpen(true)} className="bg-[#6366F1] text-white">
                    <PiBookOpenText className="mr-2" /> Manual Journal
                </Button>
            ) : type === "EDIT_ENTRY" ? (
                <button onClick={() => setIsOpen(true)}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-[6px] bg-white text-gray-500 text-[11px] font-[500] hover:bg-indigo-50 hover:text-[#6366F1] transition-colors"
                    style={{ border: '1px solid rgba(0,0,0,0.09)' }}>
                    <PiPencil className="text-[12px]" /> Edit
                </button>
            ) : (
                <button onClick={() => setIsOpen(true)}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-[6px] bg-white text-gray-500 text-[11px] font-[500] hover:bg-rose-50 hover:text-rose-600 transition-colors"
                    style={{ border: '1px solid rgba(0,0,0,0.09)' }}>
                    <PiArrowsClockwise className="text-[12px]" /> Void
                </button>
            )}
            {mounted && createPortal(modalContent, document.body)}
        </>
    );
}
