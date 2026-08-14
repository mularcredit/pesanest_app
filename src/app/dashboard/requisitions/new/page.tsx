"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { useToast } from "@/components/ui/ToastProvider";
import { Select } from "@/components/ui/Select";
import {
    PiCaretLeft,
    PiCheckCircle,
    PiInfo,
    PiPlus,
    PiPaperPlaneRight,
    PiUploadSimple,
    PiFile,
    PiX,
    PiTag,
    PiCreditCard,
    PiCalendarBlank,
    PiStorefront,
    PiPaperclip,
} from "react-icons/pi";
import { DatePicker } from "@/components/ui/DatePicker";
import {
    createRequisitionWithItems,
    getCategoriesAction,
    getVendorsAction,
    getUserBranchAndDepartmentAction,
    getExpenseAccountsAction,
    createExpenseAccountAction,
} from "./multi-item-actions";

const INPUT_CLASS = "w-full rounded-[6px] px-3 py-[10px] text-[13px] text-gray-900 placeholder:text-gray-300 outline-none focus:ring-1 focus:ring-[#6366F1] transition-colors bg-white";
const INPUT_STYLE: React.CSSProperties = { border: '1px solid rgba(0,0,0,0.09)' };
const LABEL_CLASS = "block text-[11.5px] font-[500] text-gray-400 mb-1.5";

function SectionDivider({ title, optional }: { title: string; optional?: boolean }) {
    return (
        <div className="flex items-center gap-2 px-6 py-3.5 bg-gray-50/60" style={{ borderTop: '1px solid rgba(0,0,0,0.07)', borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
            <span className="text-[10.5px] font-[600] uppercase tracking-[0.08em] text-gray-400">{title}</span>
            {optional && <span className="text-[10px] text-gray-300">(optional)</span>}
        </div>
    );
}

function NewRequisitionForm() {
    const { showToast } = useToast();
    const searchParams = useSearchParams();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);

    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [amount, setAmount] = useState("");
    const [category, setCategory] = useState(searchParams.get("category") ?? "");
    const [currency, setCurrency] = useState("KES");
    const [branch, setBranch] = useState("");
    const [department, setDepartment] = useState("");
    const [expectedDate, setExpectedDate] = useState<Date | undefined>(undefined);
    const [vendor, setVendor] = useState("");

    const [paymentMethod, setPaymentMethod] = useState("MPESA_TILL");
    const [paymentReference, setPaymentReference] = useState("");
    const [paybillNumber, setPaybillNumber] = useState("");
    const [paybillAccountNumber, setPaybillAccountNumber] = useState("");

    const [customAccountId, setCustomAccountId] = useState("");
    const [expenseAccounts, setExpenseAccounts] = useState<any[]>([]);
    const [isCreatingAccount, setIsCreatingAccount] = useState(false);
    const [newAccountName, setNewAccountName] = useState("");
    const [newAccountCode, setNewAccountCode] = useState("");
    const [accountCreateError, setAccountCreateError] = useState("");
    const [isSavingAccount, setIsSavingAccount] = useState(false);

    const [receiptFile, setReceiptFile] = useState<File | null>(null);
    const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
    const [isUploadingReceipt, setIsUploadingReceipt] = useState(false);

    const [allCategories, setAllCategories] = useState<string[]>([]);
    const [vendors, setVendors] = useState<any[]>([]);

    const CURRENCIES = [
        { code: 'KES', symbol: 'KSh', flag: '🇰🇪' },
        { code: 'UGX', symbol: 'USh', flag: '🇺🇬' },
        { code: 'TZS', symbol: 'TSh', flag: '🇹🇿' },
        { code: 'RWF', symbol: 'Fr',  flag: '🇷🇼' },
        { code: 'USD', symbol: '$',   flag: '🇺🇸' },
        { code: 'EUR', symbol: '€',   flag: '🇪🇺' },
        { code: 'GBP', symbol: '£',   flag: '🇬🇧' },
        { code: 'NGN', symbol: '₦',   flag: '🇳🇬' },
        { code: 'GHS', symbol: '₵',   flag: '🇬🇭' },
        { code: 'ZAR', symbol: 'R',   flag: '🇿🇦' },
        { code: 'AED', symbol: 'د.إ', flag: '🇦🇪' },
        { code: 'ETB', symbol: 'Br',  flag: '🇪🇹' },
        { code: 'SSP', symbol: 'SSP', flag: '🇸🇸' },
        { code: 'SOS', symbol: 'Sh',  flag: '🇸🇴' },
        { code: 'BIF', symbol: 'Fr',  flag: '🇧🇮' },
        { code: 'DJF', symbol: 'Fr',  flag: '🇩🇯' },
        { code: 'XOF', symbol: 'Fr',  flag: '🌍' },
        { code: 'CNY', symbol: '¥',   flag: '🇨🇳' },
        { code: 'INR', symbol: '₹',   flag: '🇮🇳' },
        { code: 'JPY', symbol: '¥',   flag: '🇯🇵' },
        { code: 'CAD', symbol: 'CA$', flag: '🇨🇦' },
        { code: 'AUD', symbol: 'A$',  flag: '🇦🇺' },
        { code: 'CHF', symbol: 'Fr',  flag: '🇨🇭' },
        { code: 'SAR', symbol: '﷼',   flag: '🇸🇦' },
    ];

    const getCurrencySymbol = (code: string) => CURRENCIES.find(c => c.code === code)?.symbol ?? code;

    const CATEGORY_GROUPS = [
        { group: "Fixed Recurring", items: ["Rent", "Internet & Connectivity", "Airtime & Communication", "Fuel Allocation", "Hired Bike Payments"] },
        { group: "Operational", items: ["Stationery", "Office Supplies", "Meetings & Conferences", "Accommodation", "Emergency Field Expenses"] },
        { group: "Petty Cash", items: ["Electricity", "Fuel", "Repairs", "Maintenance", "Water"] },
        { group: "Procurement", items: ["ICT Equipment", "Furniture", "Hardware"] },
        {
            group: "General / Other",
            items: allCategories.filter(c =>
                !["Rent", "Internet & Connectivity", "Airtime & Communication", "Fuel Allocation", "Hired Bike Payments",
                    "Stationery", "Office Supplies", "Meetings & Conferences", "Accommodation", "Emergency Field Expenses",
                    "Electricity", "Fuel", "Repairs", "Maintenance", "Water", "ICT Equipment", "Furniture", "Hardware"].includes(c)
            )
        }
    ].map(g => ({
        label: g.group,
        options: g.items
            .filter(i => allCategories.includes(i) || g.group === "General / Other")
            .map(i => ({ value: i, label: i }))
    })).filter(g => g.options.length > 0);

    const paymentOptions = [
        { value: 'MPESA',         label: 'M-Pesa (Personal)', img: '/pay/Mpesa-Logo.png' },
        { value: 'MPESA_TILL',    label: 'M-Pesa Till',    img: '/pay/Mpesa-Logo.png' },
        { value: 'MPESA_PAYBILL', label: 'M-Pesa Paybill', img: '/pay/Mpesa-Logo.png' },
        { value: 'BANK_TRANSFER', label: 'Bank Transfer',   img: '/pay/accepted.png' },
        { value: 'AIRTEL_MONEY',  label: 'Airtel Money',   img: '/pay/Airtel-Logo.png' },
        { value: 'CASH',          label: 'Cash',            img: '/pay/money-stack.png' },
        { value: 'CHEQUE',        label: 'Cheque',          img: '/pay/cheque.png' },
        { value: 'PETTY_CASH',    label: 'Petty Cash',      img: '/pay/petty-cash.svg' },
    ];

    useEffect(() => {
        (async () => {
            const [cats, vens, accs, userDetails] = await Promise.all([
                getCategoriesAction(),
                getVendorsAction(),
                getExpenseAccountsAction(),
                getUserBranchAndDepartmentAction(),
            ]);
            setAllCategories(cats);
            setVendors(vens);
            setExpenseAccounts(accs);
            if (userDetails.branch) setBranch(userDetails.branch);
            if (userDetails.department) setDepartment(userDetails.department);

            const prefilledCategory = searchParams.get("category");
            if (prefilledCategory) {
                const matchedAccount = accs.find((a: any) => a.name === prefilledCategory);
                if (matchedAccount) setCustomAccountId(matchedAccount.id);
            }
        })();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (!vendor || vendors.length === 0) return;
        const matched = vendors.find(v => v.name === vendor);
        if (matched?.preferredPaymentMethod) {
            setPaymentMethod(matched.preferredPaymentMethod);
            if (matched.preferredPaymentMethod === "MPESA_PAYBILL") {
                const [pb, acc] = (matched.bankAccount || "").split('|');
                setPaybillNumber(pb || "");
                setPaybillAccountNumber(acc || "");
            } else {
                setPaymentReference(matched.bankAccount || "");
            }
        }
    }, [vendor, vendors]);

    const handleCreateAccount = async () => {
        setAccountCreateError("");
        if (!newAccountName.trim() || !newAccountCode.trim()) {
            setAccountCreateError("Name and code are required.");
            return;
        }
        setIsSavingAccount(true);
        const res = await createExpenseAccountAction({ name: newAccountName, code: newAccountCode });
        setIsSavingAccount(false);
        if (res?.error) {
            setAccountCreateError(res.error);
        } else if (res?.success && res.account) {
            setExpenseAccounts([...expenseAccounts, res.account]);
            setCustomAccountId(res.account.id);
            setIsCreatingAccount(false);
            setNewAccountName("");
            setNewAccountCode("");
        }
    };

    const handleReceiptChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setReceiptFile(file);
        setIsUploadingReceipt(true);
        try {
            const fd = new FormData();
            fd.append("file", file);
            const res = await fetch("/api/upload", { method: "POST", body: fd });
            const data = await res.json();
            if (data.url) {
                setReceiptUrl(data.url);
                showToast("Receipt uploaded", "success");
            } else {
                showToast("Upload failed", "error");
                setReceiptFile(null);
            }
        } catch {
            showToast("Upload failed", "error");
            setReceiptFile(null);
        } finally {
            setIsUploadingReceipt(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim()) { showToast("Expense title is required.", "error", "Missing Title"); return; }
        if (!description.trim() || description.length < 15) { showToast("Please provide a justification of at least 15 characters.", "error", "Justification Too Short"); return; }
        if (!category) { showToast("Please select a category.", "error", "Category Required"); return; }
        const amt = parseFloat(amount);
        if (!amount || isNaN(amt) || amt <= 0) { showToast("Please enter a valid amount.", "error", "Invalid Amount"); return; }

        const resolvedItems = [{ id: Date.now().toString(), title, description, quantity: 1, unitPrice: amt, category }];
        setIsSubmitting(true);
        setSubmitError(null);

        const formData = new FormData();
        formData.append("title", title);
        formData.append("description", description);
        formData.append("currency", currency);
        formData.append("items", JSON.stringify(resolvedItems));
        formData.append("branch", branch);
        formData.append("department", department);
        formData.append("vendor", vendor);
        formData.append("paymentMethod", paymentMethod);
        formData.append("paymentReference", paymentReference);
        formData.append("paybillNumber", paybillNumber);
        formData.append("paybillAccountNumber", paybillAccountNumber);
        if (customAccountId) formData.append("accountId", customAccountId);
        if (expectedDate) formData.append("expectedDate", expectedDate.toISOString());
        if (receiptUrl) formData.append("receiptUrl", receiptUrl);

        try {
            const result = await createRequisitionWithItems(formData);
            if (result?.errors) {
                const first = Object.values(result.errors).flat()[0] as string;
                setSubmitError(first || "Validation failed.");
                setIsSubmitting(false);
                return;
            }
            if (result?.message) {
                setSubmitError(result.message);
                setIsSubmitting(false);
                return;
            }
        } catch (err) {
            console.error(err);
            showToast("Something went wrong.", "error", "Submission Failed");
            setIsSubmitting(false);
        }
    };

    const calculateTotal = () => parseFloat(amount) || 0;
    const getPaymentName = () => paymentOptions.find(o => o.value === paymentMethod)?.label || 'Not set';

    return (
        <div className="-mt-[22px] -mx-[26px] -mb-[52px] min-h-[calc(100vh-64px)] flex bg-gray-50/50">

            {/* ── LEFT: FORM ── */}
            <div className="flex-1 overflow-y-auto px-10 py-8 min-w-0">
                {/* Back link inline — no redundant sub-header bar */}
                <Link href="/dashboard/requisitions"
                    className="inline-flex items-center gap-1.5 text-[12px] text-gray-400 hover:text-gray-700 transition-colors mb-6">
                    <PiCaretLeft className="text-[13px]" /> Back to Expenses
                </Link>

                <form onSubmit={handleSubmit}>
                    {/* ── ONE connected card ── */}
                    <div className="bg-white rounded-[8px] mb-3 overflow-hidden"
                        style={{ border: '1px solid rgba(0,0,0,0.09)' }}>

                        {/* Section 1: Request Details */}
                        <SectionDivider title="Request Details" />
                        <div className="px-6 py-5 grid grid-cols-2 gap-4">
                            {/* Title — full width */}
                            <div className="col-span-2">
                                <label className={LABEL_CLASS}>Title <span className="text-[#6366F1]">*</span></label>
                                <input
                                    type="text"
                                    value={title}
                                    onChange={e => setTitle(e.target.value)}
                                    placeholder="e.g. Office supplies for Nairobi HQ"
                                    className={INPUT_CLASS}
                                    style={INPUT_STYLE}
                                />
                            </div>

                            {/* Ledger account */}
                            <div>
                                <div className="flex items-center justify-between mb-1.5">
                                    <label className={LABEL_CLASS.replace('mb-1.5', '')}>Ledger account <span className="text-[#6366F1]">*</span></label>
                                    <button type="button" onClick={() => setIsCreatingAccount(true)}
                                        className="flex items-center gap-1 text-[11px] text-[#6366F1] hover:text-indigo-700 transition-colors">
                                        <PiPlus className="text-[10px]" /> create new
                                    </button>
                                </div>
                                <Select
                                    value={customAccountId}
                                    onChange={setCustomAccountId}
                                    placeholder="Auto-mapped by category…"
                                    searchable
                                    className="!bg-white !rounded-[6px] !py-[10px] !px-3 !text-[13px]"
                                    options={expenseAccounts.map(acc => ({ value: acc.id, label: `${acc.code} · ${acc.name}` }))}
                                />
                            </div>

                            {/* Category */}
                            <div>
                                <label className={LABEL_CLASS}>Category <span className="text-[#6366F1]">*</span></label>
                                <Select
                                    value={category}
                                    onChange={setCategory}
                                    placeholder="Select category…"
                                    searchable
                                    className="!bg-white !rounded-[6px] !py-[10px] !px-3 !text-[13px]"
                                    groups={CATEGORY_GROUPS}
                                />
                            </div>

                            {/* Justification — full width */}
                            <div className="col-span-2">
                                <label className={LABEL_CLASS}>Justification <span className="text-[#6366F1]">*</span></label>
                                <textarea
                                    value={description}
                                    onChange={e => setDescription(e.target.value)}
                                    placeholder="Explain the business need for this request (min. 15 characters)…"
                                    rows={3}
                                    className={INPUT_CLASS + " resize-none"}
                                    style={INPUT_STYLE}
                                />
                            </div>
                        </div>

                        {/* Section 2: Amount & Logistics */}
                        <SectionDivider title="Amount & Logistics" />
                        <div className="px-6 py-5 grid grid-cols-4 gap-4">
                            <div>
                                <label className={LABEL_CLASS}>Amount <span className="text-[#6366F1]">*</span></label>
                                <input
                                    type="number" min="0"
                                    value={amount}
                                    onChange={e => setAmount(e.target.value)}
                                    placeholder="0.00"
                                    className={INPUT_CLASS + " font-mono tabular-nums"}
                                    style={INPUT_STYLE}
                                />
                            </div>
                            <div>
                                <label className={LABEL_CLASS}>Currency</label>
                                <Select
                                    value={currency}
                                    onChange={setCurrency}
                                    searchable
                                    className="!bg-white !rounded-[6px] !py-[10px] !px-3 !text-[13px]"
                                    options={CURRENCIES.map(c => ({ value: c.code, label: `${c.flag} ${c.code}` }))}
                                />
                            </div>
                            <div>
                                <label className={LABEL_CLASS}>Expected delivery</label>
                                <DatePicker value={expectedDate} onChange={setExpectedDate} placeholder="Pick a date…" />
                            </div>
                            <div>
                                <label className={LABEL_CLASS}>Preferred vendor <span className="text-gray-300">(optional)</span></label>
                                <Select
                                    value={vendor}
                                    onChange={setVendor}
                                    placeholder="Select or search…"
                                    searchable
                                    className="!bg-white !rounded-[6px] !py-[10px] !px-3 !text-[13px]"
                                    options={vendors.map(v => ({ value: v.name, label: v.name }))}
                                />
                            </div>
                        </div>

                        {/* Section 3: Payment Method */}
                        <SectionDivider title="Payment Method" />
                        <div className="px-6 py-5">
                            <div className="grid grid-cols-7 gap-2 mb-4">
                                {paymentOptions.map(opt => {
                                    const isSelected = paymentMethod === opt.value;
                                    return (
                                        <button key={opt.value} type="button"
                                            onClick={() => { setPaymentMethod(opt.value); setPaymentReference(""); }}
                                            className="flex flex-col items-center gap-2 p-3 rounded-[7px] cursor-pointer transition-all"
                                            style={{
                                                border: isSelected ? '1px solid #6366F1' : '1px solid rgba(0,0,0,0.09)',
                                                background: isSelected ? 'rgba(99,102,241,0.05)' : 'white',
                                            }}>
                                            <div className="w-8 h-8 flex items-center justify-center">
                                                {opt.img.endsWith('.svg') ? (
                                                    <img src={opt.img} alt={opt.label} width={32} height={32} className="object-contain w-full h-full" />
                                                ) : (
                                                    <Image src={opt.img} alt={opt.label} width={32} height={32} className="object-contain w-full h-full" />
                                                )}
                                            </div>
                                            <span className={`text-[10.5px] font-[500] text-center leading-tight ${isSelected ? 'text-[#6366F1]' : 'text-gray-400'}`}>
                                                {opt.label}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>

                            {paymentMethod && paymentMethod !== 'CASH' && (
                                <div className="grid grid-cols-2 gap-3">
                                    {paymentMethod === 'MPESA_PAYBILL' ? (
                                        <>
                                            <div>
                                                <label className={LABEL_CLASS}>Paybill number</label>
                                                <input type="text" value={paybillNumber} onChange={e => setPaybillNumber(e.target.value)} placeholder="e.g. 247247" className={INPUT_CLASS} style={INPUT_STYLE} />
                                            </div>
                                            <div>
                                                <label className={LABEL_CLASS}>Account number</label>
                                                <input type="text" value={paybillAccountNumber} onChange={e => setPaybillAccountNumber(e.target.value)} placeholder="e.g. 12345678" className={INPUT_CLASS} style={INPUT_STYLE} />
                                            </div>
                                        </>
                                    ) : (
                                        <div className="col-span-2">
                                            <label className={LABEL_CLASS}>
                                                {paymentMethod === 'MPESA' ? 'M-Pesa phone number' :
                                                 paymentMethod === 'MPESA_TILL' ? 'M-Pesa till number' :
                                                 paymentMethod === 'BANK_TRANSFER' ? 'Bank account' :
                                                 paymentMethod === 'AIRTEL_MONEY' ? 'Airtel Money number' :
                                                 paymentMethod === 'PETTY_CASH' ? 'Petty cash voucher no.' : 'Reference'}
                                            </label>
                                            <input type="text" value={paymentReference} onChange={e => setPaymentReference(e.target.value)}
                                                placeholder={paymentMethod === 'MPESA' ? 'e.g. 0712345678' :
                                                             paymentMethod === 'PETTY_CASH' ? 'e.g. PCV-0012' : 'Enter detail…'}
                                                className={INPUT_CLASS} style={INPUT_STYLE} />
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Section 4: Supporting Document */}
                        <SectionDivider title="Supporting Document" optional />
                        <div className="px-6 py-5">
                            <input type="file" id="req-receipt-upload" accept="image/*,.pdf" className="hidden" onChange={handleReceiptChange} />

                            {!receiptFile ? (
                                <label htmlFor="req-receipt-upload"
                                    className="flex items-center gap-4 p-4 rounded-[7px] border border-dashed cursor-pointer hover:bg-indigo-50/40 transition-colors group"
                                    style={{ borderColor: 'rgba(99,102,241,0.25)' }}>
                                    <div className="w-9 h-9 rounded-[6px] bg-indigo-50 flex items-center justify-center shrink-0 group-hover:bg-indigo-100 transition-colors">
                                        <PiUploadSimple className="text-[#6366F1] text-lg" />
                                    </div>
                                    <div>
                                        <p className="text-[13px] font-[500] text-gray-700">Attach a receipt or quote</p>
                                        <p className="text-[11.5px] text-gray-400 mt-0.5">PDF or image — helps approvers verify the request</p>
                                    </div>
                                </label>
                            ) : (
                                <div className="flex items-center gap-3 p-4 rounded-[7px] bg-indigo-50/30"
                                    style={{ border: '1px solid rgba(99,102,241,0.2)' }}>
                                    <div className="w-9 h-9 rounded-[6px] bg-indigo-100 flex items-center justify-center shrink-0">
                                        {isUploadingReceipt
                                            ? <div className="w-4 h-4 border-2 border-[#6366F1] border-t-transparent rounded-full animate-spin" />
                                            : <PiFile className="text-[#6366F1] text-lg" />}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[13px] font-[500] text-gray-900 truncate">{receiptFile.name}</p>
                                        <p className="text-[11.5px] text-gray-400 mt-0.5">
                                            {isUploadingReceipt ? "Uploading…" : receiptUrl ? "Uploaded successfully" : "Ready to attach"}
                                        </p>
                                    </div>
                                    <button type="button" onClick={() => { setReceiptFile(null); setReceiptUrl(null); }}
                                        className="p-1.5 rounded-[5px] text-gray-400 hover:text-gray-700 hover:bg-white/60 transition-colors shrink-0">
                                        <PiX className="text-sm" />
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="pb-10">
                        {submitError && (
                            <div className="mb-4 px-4 py-3 rounded-[7px] bg-rose-50 text-rose-600 text-[12.5px] flex items-center gap-2"
                                style={{ border: '1px solid rgba(239,68,68,0.15)' }}>
                                <PiInfo className="text-[15px] shrink-0" /> {submitError}
                            </div>
                        )}
                        <div className="flex items-center justify-between">
                            <Link href="/dashboard/requisitions"
                                className="text-[13px] text-gray-400 hover:text-gray-700 transition-colors">
                                Cancel
                            </Link>
                            <button type="submit" disabled={isSubmitting}
                                className="flex items-center gap-2 bg-[#6366F1] text-white px-5 py-2.5 rounded-[6px] text-[13px] font-[500] hover:bg-indigo-600 transition-colors disabled:opacity-50">
                                {isSubmitting ? 'Submitting…' : <><PiPaperPlaneRight className="text-[14px]" /> Submit expense</>}
                            </button>
                        </div>
                    </div>
                </form>

                {/* Create account overlay */}
                {isCreatingAccount && (
                    <div className="fixed inset-0 z-[50] flex items-center justify-center p-4">
                        <div className="absolute inset-0 bg-black/20" onClick={() => setIsCreatingAccount(false)} />
                        <div className="relative bg-white rounded-[10px] w-[460px] overflow-hidden"
                            style={{ border: '1px solid rgba(0,0,0,0.09)', boxShadow: '0 20px 60px rgba(0,0,0,0.12)' }}>
                            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
                                <h3 className="text-[14px] font-[600] text-gray-900">Create Ledger Account</h3>
                                <button onClick={() => setIsCreatingAccount(false)}
                                    className="p-1.5 rounded-[5px] hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors">
                                    <PiX className="text-[15px]" />
                                </button>
                            </div>
                            <div className="px-5 py-5">
                                {accountCreateError && (
                                    <div className="mb-4 px-3 py-2.5 rounded-[6px] bg-rose-50 text-rose-600 text-[12px] flex items-center gap-2"
                                        style={{ border: '1px solid rgba(239,68,68,0.15)' }}>
                                        <PiInfo className="shrink-0" /> {accountCreateError}
                                    </div>
                                )}
                                <div className="flex gap-3">
                                    <div className="flex-1">
                                        <label className={LABEL_CLASS}>Account name</label>
                                        <input type="text" placeholder="e.g. Server Hosting" value={newAccountName} onChange={e => setNewAccountName(e.target.value)} className={INPUT_CLASS} style={INPUT_STYLE} />
                                    </div>
                                    <div className="w-[120px]">
                                        <label className={LABEL_CLASS}>GL Code</label>
                                        <input type="text" placeholder="e.g. 6005" value={newAccountCode} onChange={e => setNewAccountCode(e.target.value)} className={INPUT_CLASS + " font-mono"} style={INPUT_STYLE} />
                                    </div>
                                </div>
                            </div>
                            <div className="flex justify-end gap-2 px-5 py-4" style={{ borderTop: '1px solid rgba(0,0,0,0.07)' }}>
                                <button type="button" onClick={() => setIsCreatingAccount(false)} disabled={isSavingAccount}
                                    className="px-4 py-2 text-[13px] font-[500] text-gray-500 rounded-[6px] hover:bg-gray-50 transition-colors"
                                    style={{ border: '1px solid rgba(0,0,0,0.09)' }}>
                                    Cancel
                                </button>
                                <button type="button" onClick={handleCreateAccount} disabled={isSavingAccount}
                                    className="px-4 py-2 text-[13px] font-[600] text-white bg-[#6366F1] hover:bg-indigo-600 rounded-[6px] transition-colors disabled:opacity-50">
                                    {isSavingAccount ? 'Saving…' : 'Save Account'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* ── RIGHT: SUMMARY SIDEBAR ── */}
            <div className="w-[280px] flex-shrink-0 bg-white sticky top-0 h-[calc(100vh-64px)] overflow-y-auto flex flex-col"
                style={{ borderLeft: '1px solid rgba(0,0,0,0.07)' }}>

                {/* ── Header + progress ── */}
                <div className="px-5 pt-5 pb-4" style={{ borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
                    <p className="text-[10.5px] font-[600] uppercase tracking-[0.08em] text-gray-400 mb-3">Request Preview</p>
                    {(() => {
                        const filled = [!!title.trim(), !!category, !!customAccountId, parseFloat(amount) > 0].filter(Boolean).length;
                        const pct = (filled / 4) * 100;
                        const ready = filled === 4;
                        return (
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-[11.5px] text-gray-400">{filled} of 4 required</span>
                                    <span className={`text-[11px] font-[600] ${ready ? 'text-emerald-600' : 'text-gray-300'}`}>
                                        {ready ? 'Ready to submit' : 'Incomplete'}
                                    </span>
                                </div>
                                <div className="h-[3px] rounded-full overflow-hidden bg-gray-100">
                                    <div className="h-full rounded-full transition-all duration-500"
                                        style={{ width: `${pct}%`, background: ready ? '#10b981' : '#6366F1' }} />
                                </div>
                            </div>
                        );
                    })()}
                </div>

                {/* ── Title preview ── */}
                <div className="px-5 py-4" style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                    <p className="text-[10px] font-[500] uppercase tracking-[0.07em] text-gray-400 mb-1.5">Title</p>
                    <p className={`text-[13px] font-[500] leading-snug ${title ? 'text-gray-900' : 'text-gray-300 italic'}`}>
                        {title || 'Not entered yet…'}
                    </p>
                </div>

                {/* ── Icon rows ── */}
                <div className="px-5 py-2">
                    {[
                        { Icon: PiTag,           label: 'Category',          value: category,          accent: false, green: false },
                        { Icon: PiCreditCard,    label: 'Payment method',    value: getPaymentName(),  accent: true,  green: false },
                        { Icon: PiCalendarBlank, label: 'Expected delivery', value: expectedDate ? expectedDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '', accent: false, green: false },
                        { Icon: PiStorefront,    label: 'Vendor',            value: vendor,            accent: false, green: false },
                        { Icon: PiPaperclip,     label: 'Receipt',           value: receiptUrl ? 'Attached' : '', accent: false, green: !!receiptUrl },
                    ].map((row, idx, arr) => (
                        <div key={row.label} className="flex items-center gap-3 py-3"
                            style={idx < arr.length - 1 ? { borderBottom: '1px solid rgba(0,0,0,0.05)' } : {}}>
                            <div className="w-[30px] h-[30px] rounded-[6px] flex items-center justify-center shrink-0 bg-gray-50"
                                style={{ border: '1px solid rgba(0,0,0,0.07)' }}>
                                <row.Icon className="text-gray-400 text-[14px]" />
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="text-[10.5px] text-gray-400">{row.label}</p>
                                <p className={`text-[12.5px] font-[500] truncate mt-0.5 ${
                                    row.green   ? 'text-emerald-600' :
                                    row.accent  ? 'text-[#6366F1]' :
                                    row.value   ? 'text-gray-900' : 'text-gray-300'
                                }`}>
                                    {row.value || '—'}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>

                {/* ── Total amount ── */}
                <div className="mx-5 mt-2 mb-5 rounded-[8px] px-4 py-5 text-center"
                    style={{ background: 'rgba(99,102,241,0.04)', border: '1px solid rgba(99,102,241,0.13)' }}>
                    <p className="text-[10px] font-[600] uppercase tracking-[0.08em] text-indigo-300 mb-2">Total Requested</p>
                    <p className="text-[34px] font-[250] text-[#6366F1] tracking-tight tabular-nums leading-none">
                        {getCurrencySymbol(currency)}{calculateTotal().toLocaleString()}
                    </p>
                    <p className="text-[11px] text-indigo-300 mt-2 font-[500]">{currency}</p>
                </div>

                {/* ── Approval flow ── */}
                <div className="px-5 pb-6 mt-auto" style={{ borderTop: '1px solid rgba(0,0,0,0.07)', paddingTop: '16px' }}>
                    <p className="text-[10px] font-[600] uppercase tracking-[0.08em] text-gray-400 mb-4">Approval Flow</p>
                    <div className="relative">
                        {/* Vertical connector line */}
                        <div className="absolute left-[8px] top-5 bottom-5 w-px bg-gray-100" />
                        <div className="space-y-5">
                            {[
                                { label: 'Draft created',     sub: 'Submission ready',    done: true },
                                { label: 'Manager review',    sub: 'Awaiting submission', done: false },
                                { label: 'Finance approval',  sub: 'Budget verification', done: false },
                                { label: 'Payment processed', sub: 'Via selected channel',done: false },
                            ].map((step, idx) => (
                                <div key={idx} className="flex items-start gap-3 relative">
                                    <div className={`w-[17px] h-[17px] rounded-full flex items-center justify-center shrink-0 mt-0.5 relative z-10 ${
                                        step.done ? 'bg-emerald-500' : 'bg-white'
                                    }`} style={{ border: step.done ? 'none' : '1.5px solid #e5e7eb' }}>
                                        {step.done && <PiCheckCircle className="text-white text-[11px]" />}
                                    </div>
                                    <div>
                                        <p className={`text-[12px] font-[500] leading-tight ${step.done ? 'text-gray-800' : 'text-gray-400'}`}>
                                            {step.label}
                                        </p>
                                        <p className="text-[11px] text-gray-400 mt-0.5">{step.sub}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function NewRequisitionPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center text-gray-400 text-sm">Loading…</div>
        }>
            <NewRequisitionForm />
        </Suspense>
    );
}
