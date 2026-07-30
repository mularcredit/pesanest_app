"use client";

import { useState, useEffect } from "react";
import {
 PiCheck,
 PiUploadSimple,
 PiPaperPlaneRight,
 PiWarningCircle,
 PiCheckCircle,
 PiInfo,
 PiPaperclip,
 PiArrowRight,
 PiCaretDown,
 PiMagnifyingGlass,
 PiPlus,
 PiX,
 PiArrowsClockwise,
 PiWallet,
 PiReceipt,
 PiBank,
 PiCurrencyDollar,
 PiCalendarBlank,
 PiCreditCard,
 PiNewspaperClipping,
 PiCaretUpDown
} from "react-icons/pi";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/components/ui/ToastProvider";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { createExpense, updateExpense } from "@/app/dashboard/expenses/new/actions";
import { checkBudget } from "@/app/dashboard/expenses/new/budget-actions";
import { getVendors } from "@/app/dashboard/vendors/actions";
import { getExpenseAccountsAction, createExpenseAccountAction } from "@/app/dashboard/requisitions/new/multi-item-actions";
import { EXPENSE_CATEGORIES } from "@/lib/constants";
import { DatePicker } from "@/components/ui/DatePicker";
import { format, parseISO } from "date-fns";
import { DocumentDropzone } from "@/components/ui/DocumentDropzone";
import { EtrReceiptInput } from "@/components/accounting/EtrReceiptInput";
import Image from "next/image";

interface ExpenseFormProps {
 mode: "quick" | "full";
 expense?: any;
 onSuccess: () => void;
 onCancel?: () => void;
}

export function ExpenseForm({ mode, expense, onSuccess, onCancel }: ExpenseFormProps) {
 const { showToast } = useToast();
 const [isSubmitting, setIsSubmitting] = useState(false);
 const [isValidating, setIsValidating] = useState(false);
 const [budgetStatus, setBudgetStatus] = useState<any>(null);

 // Form State
 const [title, setTitle] = useState("");
 const [costCenter, setCostCenter] = useState("OFFICE");
 const [amount, setAmount] = useState("");
 const [currency, setCurrency] = useState("KES");
 const [isCurrencyOpen, setIsCurrencyOpen] = useState(false);
 const [currencySearch, setCurrencySearch] = useState("");

 const CURRENCIES = [
 { code: 'KES', name: 'Kenyan Shilling', symbol: 'KSh', flag: '🇰🇪' },
 { code: 'UGX', name: 'Ugandan Shilling', symbol: 'USh', flag: '🇺🇬' },
 { code: 'TZS', name: 'Tanzanian Shilling', symbol: 'TSh', flag: '🇹🇿' },
 { code: 'USD', name: 'US Dollar', symbol: '$', flag: '🇺🇸' },
 { code: 'EUR', name: 'Euro', symbol: '€', flag: '🇪🇺' },
 { code: 'GBP', name: 'British Pound', symbol: '£', flag: '🇬🇧' },
 ];

 const selectedCurrency = CURRENCIES.find(c => c.code === currency) ?? CURRENCIES[3]; // USD fallback
 const filteredCurrencies = CURRENCIES.filter(c =>
 c.code.toLowerCase().includes(currencySearch.toLowerCase()) ||
 c.name.toLowerCase().includes(currencySearch.toLowerCase())
 );

 const [category, setCategory] = useState("");
 const [merchant, setMerchant] = useState("");
 const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
 const [description, setDescription] = useState("");
 const [receiptFile, setReceiptFile] = useState<File | null>(null);
 const [etrNumber, setEtrNumber] = useState(expense?.etrNumber || "");
 const [etrVerified, setEtrVerified] = useState(expense?.etrVerified || false);

 // Category Dropdown State
 const [isCategoryOpen, setIsCategoryOpen] = useState(false);
 const [categorySearch, setCategorySearch] = useState("");
 const [vendors, setVendors] = useState<{ id: string, name: string }[]>([]);
 const [isVendorOpen, setIsVendorOpen] = useState(false);
 const [vendorSearch, setVendorSearch] = useState("");

 // Custom Ledger
 const [customAccountId, setCustomAccountId] = useState("");
 const [expenseAccounts, setExpenseAccounts] = useState<any[]>([]);
 
 // Inline account creation
 const [isCreatingAccount, setIsCreatingAccount] = useState(false);
 const [newAccountName, setNewAccountName] = useState("");
 const [newAccountCode, setNewAccountCode] = useState("");
 const [accountCreateError, setAccountCreateError] = useState("");
 const [isSavingAccount, setIsSavingAccount] = useState(false);

 const [isAccountOpen, setIsAccountOpen] = useState(false);
 const [accountSearch, setAccountSearch] = useState("");

 const filteredCategories = EXPENSE_CATEGORIES.filter(c =>
 c.toLowerCase().includes(categorySearch.toLowerCase())
 );

 const filteredVendors = vendors.filter(v =>
 v.name.toLowerCase().includes(vendorSearch.toLowerCase())
 );

 // Fetch Vendors & Accounts
 useEffect(() => {
 const fetchData = async () => {
 const result = await getVendors();
 if (result.success && result.vendors) {
 setVendors(result.vendors);
 }
 const localAccounts = await getExpenseAccountsAction();
 setExpenseAccounts(localAccounts);
 };
 fetchData();
 }, []);

 // Populate form if editing
 useEffect(() => {
 if (expense) {
 setTitle(expense.title || "");
 setAmount(expense.amount?.toString() || "");
 setCurrency(expense.currency || "USD");
 setCategory(expense.category || "");
 setMerchant(expense.merchant || "");
 if (expense.expenseDate) {
 const d = typeof expense.expenseDate === 'string' ? expense.expenseDate : expense.expenseDate.toISOString();
 setDate(d.split('T')[0]);
 }
 setDescription(expense.description || "");
 setCostCenter(expense.costCenter || "OFFICE");
 setCustomAccountId(expense.accountId || "");
 }
 }, [expense]);

 // Budget Validation Effect
 useEffect(() => {
 const validateBudget = async () => {
 if (category && amount && parseFloat(amount) > 0) {
 setIsValidating(true);
 try {
 const result = await checkBudget(category, parseFloat(amount));
 setBudgetStatus(result);
 } catch (error) {
 console.error("Budget check failed", error);
 } finally {
 setIsValidating(false);
 }
 } else {
 setBudgetStatus(null);
 }
 };

 const timer = setTimeout(validateBudget, 500);
 return () => clearTimeout(timer);
 }, [amount, category]);



 const handleCreateAccount = async () => {
 setAccountCreateError("");
 if (!newAccountName.trim() || !newAccountCode.trim()) {
 setAccountCreateError("Name and Code are required.");
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

 const handleSubmit = async (e: React.FormEvent) => {
 e.preventDefault();

 if (!amount || !category || (!title && mode === "full")) {
 showToast("Required fields are missing", "error");
 return;
 }

 if (budgetStatus && !budgetStatus.allowed) {
 showToast("Budget Exceeded", "error");
 return;
 }

 setIsSubmitting(true);
 try {
 const formData = new FormData();
 const finalTitle = title || (mode === "quick" ? `Expense: ${merchant || category}` : "");

 formData.append("title", finalTitle);
 formData.append("amount", amount);
 formData.append("currency", currency);
 formData.append("category", category);
 formData.append("expenseDate", date);
 formData.append("merchant", merchant);
 formData.append("description", description || (mode === "quick" ? "Direct entry via dashboard" : ""));
 formData.append("costCenter", costCenter);
 if (customAccountId) formData.append("accountId", customAccountId);
 if (receiptFile) formData.append("receipt", receiptFile);
 if (etrNumber.trim()) formData.append("etrNumber", etrNumber.trim());

 if (expense?.id) {
 const result = await updateExpense(expense.id, formData);
 if (result?.errors) throw new Error(Object.values(result.errors)[0][0]);
 if (result?.message && result.message.includes("Error")) throw new Error(result.message);
 showToast("Expense updated successfully!", "success");
 } else {
 const result = await createExpense(formData);
 if (result?.errors) throw new Error(Object.values(result.errors)[0][0]);
 if (result?.message && result.message.includes("Error")) throw new Error(result.message);
 showToast("Expense created successfully!", "success");
 }
 onSuccess();
 } catch (error: any) {
 if (error.message !== "NEXT_REDIRECT") {
 showToast(error.message || "Something went wrong", "error");
 }
 } finally {
 setIsSubmitting(false);
 }
 };

    return (
        <div className="w-full font-sans antialiased text-gray-900 border border-gray-200 shadow-sm sm:rounded-[10px] overflow-hidden flex flex-col h-full bg-white">
            <form onSubmit={handleSubmit} className="flex flex-col h-full relative z-10">

                <div className="px-7 py-5 flex items-center gap-4 bg-white border-b border-gray-200">
                    <div className="w-10 h-10 rounded-[10px] bg-gray-50 border border-gray-200 flex items-center justify-center shrink-0">
                        <PiReceipt className="text-[22px] text-[#6366F1]" />
                    </div>
                    <div>
                        <h1 className="text-[17px] font-semibold tracking-tight text-gray-900">
                            {expense?.id ? "Edit Expense" : "Record Expense"}
                        </h1>
                        <p className="text-[12px] text-gray-500 mt-0.5 leading-none">
                            Log a direct expense against your budget
                        </p>
                    </div>
                </div>

                {/* 2. BODY — scrollable area */}
                <div className="flex-1 overflow-y-auto px-6 py-6 sm:px-7 sm:py-7 space-y-7 bg-white custom-scrollbar">

 {/* Section 1: Accounting */}
 <div className="space-y-4">
 <div className="flex items-center justify-between">
 <h3 className="text-xs font-semibold text-[#6366F1] uppercase tracking-widest">General Ledger</h3>
 <button
 type="button"
 onClick={() => setIsCreatingAccount(true)}
 className="text-xs font-medium text-[#6366F1] hover:text-[#6366F1]/80 transition-colors flex items-center gap-1.5"
 >
 <PiPlus className="text-[10px]" /> Add Account
 </button>
 </div>
  
 <div className="relative">
 <div
 onClick={() => setIsAccountOpen(!isAccountOpen)}
 className="w-full bg-white border border-gray-200 rounded-[10px] min-h-[48px] px-4 py-2.5 cursor-pointer flex items-center justify-between transition-all hover:border-[#6366F1]/60 focus-within:border-[#6366F1] focus-within:ring-2 focus-within:ring-[#6366F1]/10"
 >
 <div className="flex flex-col justify-center">
 {customAccountId ? (
 <>
 <div className="flex items-center gap-2">
 <PiBank className="text-gray-400" />
 <span className="text-sm font-medium text-gray-900 leading-none mt-0.5">
 {expenseAccounts.find(a => a.id === customAccountId)?.name}
 </span>
 </div>
 <span className="text-[11px] text-gray-500 font-mono mt-1 ml-6">
 GL-{expenseAccounts.find(a => a.id === customAccountId)?.code}
 </span>
 </>
 ) : (
 <div className="flex items-center gap-2 text-gray-500">
 <PiBank className="text-gray-400" />
 <span className="text-sm font-medium">Default Category Mapping</span>
 </div>
 )}
 </div>
 <PiCaretUpDown className="text-gray-400 shrink-0" />
 </div>

 {/* Account Dropdown */}
 <AnimatePresence>
 {isAccountOpen && (
 <>
 <div className="fixed inset-0 z-40" onClick={() => setIsAccountOpen(false)} />
 <motion.div
 initial={{ opacity: 0, y: -5, scale: 0.98 }}
 animate={{ opacity: 1, y: 0, scale: 1 }}
 exit={{ opacity: 0, y: -5, scale: 0.98 }}
 transition={{ duration: 0.15 }}
 className="absolute top-full left-0 right-0 mt-2 bg-white border border-[#6366F1]/30 rounded-[12px] shadow-[0_12px_40px_rgba(0,0,0,0.12)] z-50 overflow-hidden"
 >
 <div className="p-2 border-b border-[#6366F1]/25 bg-gray-50/50">
 <div>
 <input
 type="text"
 autoFocus
 placeholder="Search GL codes or names..."
 value={accountSearch}
 onChange={(e) => setAccountSearch(e.target.value)}
 className="w-full bg-white border border-[#6366F1]/30 rounded-[10px] pl-3 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1]/20 focus:border-[#6366F1] transition-all"
 />
 </div>
 </div>
 <div className="max-h-56 overflow-y-auto custom-scrollbar p-1.5 space-y-1">
 <button
 type="button"
 onClick={() => { setCustomAccountId(""); setIsAccountOpen(false); }}
 className={`w-full text-left px-3 py-2.5 rounded-[10px] transition-all flex items-center justify-between ${!customAccountId ? 'bg-[#6366F1]/5 text-[#6366F1]' : 'hover:bg-gray-50 text-gray-700'}`}
 >
 <div className="flex flex-col gap-0.5">
 <span className="text-[13px] font-medium">Auto-Routing</span>
 <span className="text-[11px] opacity-80">Use rules bound to the selected expense category</span>
 </div>
 </button>
  
 {expenseAccounts.filter(acc => 
 acc.name.toLowerCase().includes(accountSearch.toLowerCase()) || 
 acc.code.toLowerCase().includes(accountSearch.toLowerCase())
 ).map(acc => (
 <button
 key={acc.id}
 type="button"
 onClick={() => { setCustomAccountId(acc.id); setIsAccountOpen(false); }}
 className={`w-full text-left px-3 py-2.5 rounded-[10px] transition-all flex items-center justify-between ${customAccountId === acc.id ? 'bg-[#6366F1]/5 text-[#6366F1]' : 'hover:bg-gray-50 text-gray-700'}`}
 >
 <div className="flex flex-col gap-0.5">
 <span className="text-[13px] font-medium truncate leading-none">{acc.name}</span>
 <span className="text-[11px] font-mono opacity-80 mt-1">GL-{acc.code}</span>
 </div>
 {customAccountId === acc.id && <PiCheckCircle className="text-base text-[#6366F1]" />}
 </button>
 ))}
 </div>
 </motion.div>
 </>
 )}
 </AnimatePresence>
 </div>
 </div>

 {/* Section 2: Core Details */}
 <div className="space-y-5">
 <h3 className="text-xs font-semibold text-[#6366F1] uppercase tracking-widest border-b border-gray-200/50 pb-2">Context & Amounts</h3>
  
 <div className="space-y-4">
 {/* Title Field */}
 <div>
 <label className="block text-[13px] font-medium text-gray-800 mb-2 flex justify-between items-center">
 <span>{mode === "quick" ? "Brief Description" : "Title"} <span className="text-rose-500">*</span></span>
 </label>
 <input
 type="text"
 required={mode === "full"}
 value={mode === "quick" ? merchant : title}
 onChange={(e) => mode === "quick" ? setMerchant(e.target.value) : setTitle(e.target.value)}
 className="w-full bg-white border border-gray-200 rounded-[10px] px-5 py-3 text-[15px] font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#6366F1]/10 focus:border-[#6366F1] transition-all placeholder:text-gray-300 hover:border-gray-300"
 placeholder={mode === "quick" ? "E.g. Uber ride to airport" : "Software license renewal"}
 />
 </div>

 {/* Amount & Currency Row */}
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
  {/* Amount */}
  <div>
  <label className="block text-[13px] font-medium text-gray-800 mb-2">Amount <span className="text-rose-500">*</span></label>
  <div>
  <input
  type="number"
  required
  step="0.01"
  value={amount}
  onChange={(e) => setAmount(e.target.value)}
  className="w-full bg-white border border-gray-200 rounded-[10px] pl-3 pr-4 py-3 text-[15px] text-gray-900 font-mono font-medium focus:outline-none focus:ring-2 focus:ring-[#6366F1]/10 focus:border-[#6366F1] transition-all placeholder:text-gray-300 hover:border-gray-300"
  placeholder="0.00"
  />
  </div>
  </div>

  {/* Currency */}
  <div>
  <label className="block text-[13px] font-medium text-gray-800 mb-2">Currency</label>
  <div className="relative">
  <div
  onClick={() => setIsCurrencyOpen(!isCurrencyOpen)}
  className="w-full bg-white border border-gray-200 rounded-[10px] min-h-[50px] px-4 py-3 cursor-pointer flex items-center justify-between hover:border-[#6366F1]/60 transition-all focus:border-[#6366F1] focus:ring-2 focus:ring-[#6366F1]/10"
  >
  <span className="flex items-center gap-2 text-sm font-medium text-gray-900">
  <span className="text-lg leading-none">{selectedCurrency.flag}</span>
  <span>{selectedCurrency.code}</span>
  <span className="text-gray-400 font-normal text-xs">{selectedCurrency.symbol}</span>
  </span>
  <PiCaretDown className={`text-gray-400 transition-transform text-sm ${isCurrencyOpen ? 'rotate-180' : ''}`} />
  </div>
  {isCurrencyOpen && (
  <>
  <div className="fixed inset-0 z-40" onClick={() => setIsCurrencyOpen(false)} />
  <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-[#6366F1]/30 rounded-[12px] shadow-xl z-50 p-3 animate-in fade-in zoom-in-95 duration-100">
  <div className="mb-3">
  <input
  type="text"
  autoFocus
  placeholder="Search currency..."
  value={currencySearch}
  onChange={(e) => setCurrencySearch(e.target.value)}
  onClick={(e) => e.stopPropagation()}
  className="w-full pl-3 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-[10px] text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-[#6366F1] transition-all"
  />
  </div>
  <div className="max-h-52 overflow-y-auto custom-scrollbar">
  {filteredCurrencies.map(cur => (
  <button 
  key={cur.code} 
  type="button" 
  onClick={() => { setCurrency(cur.code); setIsCurrencyOpen(false); setCurrencySearch(""); }} 
  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-[10px] transition-all text-left ${currency === cur.code ? 'bg-[#6366F1]/8 border border-[#6366F1]/30' : 'hover:bg-gray-50 border border-transparent'}`}
  >
  <span className="text-xl leading-none w-7 text-center">{cur.flag}</span>
  <div className="flex-1 min-w-0">
  <p className={`text-sm font-medium ${currency === cur.code ? 'text-[#6366F1]' : 'text-gray-900'}`}>{cur.code}</p>
  <p className="text-[10px] text-gray-400 truncate">{cur.name}</p>
  </div>
  <span className="text-xs font-mono text-gray-400 shrink-0">{cur.symbol}</span>
  {currency === cur.code && <div className="w-2 h-2 rounded-full bg-[#6366F1] shrink-0" />}
  </button>
  ))}
  </div>
  </div>
  </>
  )}
  </div>
  </div>
 </div>

 {/* Category Picker */}
 <div>
 <label className="block text-[13px] font-medium text-gray-800 mb-2">Category <span className="text-rose-500">*</span></label>
 <div className="relative">
 <div
 onClick={() => setIsCategoryOpen(!isCategoryOpen)}
 className="w-full bg-white border border-gray-200 rounded-[10px] min-h-[48px] px-5 py-2.5 cursor-pointer flex items-center justify-between transition-all hover:border-[#6366F1]/60 focus-within:border-[#6366F1] focus-within:ring-2 focus-within:ring-[#6366F1]/10"
 >
 {category ? (
 <span className="text-[14px] font-medium text-gray-900 truncate pr-2 tracking-tight">
 {category}
 </span>
 ) : (
 <span className="text-[14px] text-gray-400">Classify expense...</span>
 )}
 <PiCaretUpDown className="text-gray-400 shrink-0" />
 </div>

 <AnimatePresence>
 {isCategoryOpen && (
 <>
 <div className="fixed inset-0 z-40" onClick={() => setIsCategoryOpen(false)} />
 <motion.div
 initial={{ opacity: 0, y: -5, scale: 0.98 }}
 animate={{ opacity: 1, y: 0, scale: 1 }}
 exit={{ opacity: 0, y: -5, scale: 0.98 }}
 transition={{ duration: 0.15 }}
 className="absolute top-full left-0 right-0 mt-2 bg-white border border-[#6366F1]/30 rounded-[12px] shadow-[0_12px_40px_rgba(0,0,0,0.12)] z-50 overflow-hidden"
 >
 <div className="p-2 border-b border-[#6366F1]/25 bg-gray-50/50">
 <div>
 <input
 type="text"
 autoFocus
 placeholder="Search standard categories..."
 value={categorySearch}
 onChange={(e) => setCategorySearch(e.target.value)}
 className="w-full bg-white border border-[#6366F1]/30 rounded-[10px] pl-3 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1]/20 focus:border-[#6366F1] transition-all"
 />
 </div>
 </div>
 <div className="max-h-52 overflow-y-auto custom-scrollbar p-1.5 space-y-0.5">
 {filteredCategories.length > 0 ? (
 filteredCategories.map(cat => (
 <button
 key={cat}
 type="button"
 onClick={() => {
 setCategory(cat);
 setIsCategoryOpen(false);
 setCategorySearch("");
 }}
 className={`w-full text-left px-3 py-2 rounded-[10px] transition-all text-[13px] font-medium tracking-tight ${category === cat ? 'bg-[#6366F1]/5 text-[#6366F1]' : 'hover:bg-gray-50 text-gray-700'}`}
 >
 {cat}
 </button>
 ))
 ) : (
 <div className="p-1">
 {categorySearch.trim().length > 0 ? (
 <button
 type="button"
 onClick={() => {
 setCategory(categorySearch.trim());
 setIsCategoryOpen(false);
 setCategorySearch("");
 }}
 className="w-full py-2 px-3 text-sm font-medium text-[#6366F1] bg-[#6366F1]/5 rounded-[10px] flex items-center gap-2 hover:bg-[#6366F1]/10 transition-colors"
 >
 <PiPlus /> Assign as "{categorySearch}"
 </button>
 ) : (
 <span className="text-gray-500 text-sm block p-2">No categories found</span>
 )}
 </div>
 )}
 </div>
 </motion.div>
 </>
 )}
 </AnimatePresence>
 </div>
 </div>
 </div>

 {/* Budget Notification */}
 {budgetStatus && (
 <div className="mt-2 text-sm pl-0.5">
 {budgetStatus.allowed ? (
 <div className={`flex items-center gap-2 font-medium ${budgetStatus.warning ? 'text-amber-600' : 'text-emerald-600'}`}>
 {budgetStatus.warning ? <PiWarningCircle className="text-base shrink-0" /> : <PiCheckCircle className="text-base shrink-0" />}
 <span>Budget Check Pass: {selectedCurrency.symbol}{budgetStatus.remainingAfter.toLocaleString()} reserve</span>
 </div>
 ) : (
 <div className="flex items-center gap-2 font-medium text-rose-600">
 <PiWarningCircle className="text-base shrink-0" />
 <span>Exceeds Monthly Allotment</span>
 </div>
 )}
 </div>
 )}
 </div>

 {/* Section 3: Extended Info (Full Mode Only) */}
 {mode === "full" && (
 <div className="space-y-6 pt-4">
 <h3 className="text-xs font-semibold text-[#6366F1] uppercase tracking-widest border-b border-gray-200/50 pb-2">Logistics & Proof</h3>

 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
  {/* Vendor Selection */}
  <div>
  <label className="block text-[13px] font-medium text-gray-800 mb-2 flex items-center justify-between">
  Vendor <span className="text-[10px] text-gray-400 font-normal">(Optional)</span>
  </label>
  <div className="relative">
  <div
  onClick={() => setIsVendorOpen(!isVendorOpen)}
  className="w-full bg-white border border-gray-200 rounded-[10px] min-h-[48px] px-5 py-2.5 cursor-pointer flex items-center justify-between transition-all hover:border-[#6366F1]/60 focus-within:border-[#6366F1] focus-within:ring-2 focus-within:ring-[#6366F1]/10"
  >
  {merchant ? (
  <span className="text-[14px] font-medium text-gray-900 truncate tracking-tight">{merchant}</span>
  ) : (
  <span className="text-[14px] text-gray-400 tracking-tight">Select known vendor...</span>
  )}
  <PiCaretUpDown className="text-gray-400 shrink-0" />
  </div>

  <AnimatePresence>
  {isVendorOpen && (
  <>
  <div className="fixed inset-0 z-40" onClick={() => setIsVendorOpen(false)} />
  <motion.div
  initial={{ opacity: 0, y: -5, scale: 0.98 }}
  animate={{ opacity: 1, y: 0, scale: 1 }}
  exit={{ opacity: 0, y: -5, scale: 0.98 }}
  transition={{ duration: 0.15 }}
  className="absolute top-full left-0 right-0 mt-2 bg-white border border-[#6366F1]/30 rounded-[12px] shadow-[0_12px_40px_rgba(0,0,0,0.12)] z-50 overflow-hidden"
  >
  <div className="p-2 border-b border-[#6366F1]/25 bg-gray-50/50">
  <div>
  <input
  type="text"
  autoFocus
  placeholder="Find merchant..."
  value={vendorSearch}
  onChange={(e) => setVendorSearch(e.target.value)}
  className="w-full bg-white border border-[#6366F1]/30 rounded-[10px] pl-3 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1]/20 focus:border-[#6366F1] transition-all"
  />
  </div>
  </div>
  <div className="max-h-52 overflow-y-auto custom-scrollbar p-1.5 space-y-0.5">
  {filteredVendors.length > 0 ? (
  filteredVendors.map(v => (
  <button
  key={v.id}
  type="button"
  onClick={() => {
  setMerchant(v.name);
  setIsVendorOpen(false);
  setVendorSearch("");
  }}
  className={`w-full text-left px-3 py-2 rounded-[10px] transition-all text-[13px] font-medium tracking-tight ${merchant === v.name ? 'bg-[#6366F1]/5 text-[#6366F1]' : 'hover:bg-gray-50 text-gray-700'}`}
  >
  {v.name}
  </button>
  ))
  ) : (
  <div className="p-1">
  {vendorSearch.trim().length > 0 ? (
  <button
  type="button"
  onClick={() => {
  setMerchant(vendorSearch.trim());
  setIsVendorOpen(false);
  setVendorSearch("");
  }}
  className="w-full py-2 px-3 text-sm font-medium text-[#6366F1] bg-[#6366F1]/5 rounded-[10px] flex items-center gap-2 hover:bg-[#6366F1]/10 transition-colors"
  >
  <PiPlus /> Link "{vendorSearch}"
  </button>
  ) : (
  <span className="text-gray-500 text-sm block p-2">No vendor records found</span>
  )}
  </div>
  )}
  </div>
  </motion.div>
  </>
  )}
  </AnimatePresence>
  </div>
  </div>

  {/* Date Field */}
  <div>
  <label className="block text-[13px] font-medium text-gray-800 mb-2">Posting Date</label>
                                 <DatePicker
                                     value={date ? parseISO(date) : undefined}
                                     onChange={(d) => setDate(format(d, 'yyyy-MM-dd'))}
                                     placeholder="Select Date"
                                     className="w-full text-sm"
                                 />
  </div>
 </div>

 {/* Notes Textarea */}
 <div>
 <label className="block text-[13px] font-medium text-gray-800 mb-2 flex justify-between items-center">
 Document Narrative <span className="text-[10px] text-gray-400 font-normal">(Optional)</span>
 </label>
                         <textarea
                             rows={3}
                             value={description}
                             onChange={(e) => setDescription(e.target.value)}
                             className="w-full bg-white border border-gray-200 rounded-[10px] px-4 py-3 text-[14px] text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#6366F1]/10 focus:border-[#6366F1] transition-all placeholder:text-gray-300 resize-y min-h-[80px] hover:border-gray-300"
                             placeholder="Add any relevant context or justification for audit purposes..."
                         />
 </div>

 {/* Receipts Dropzone */}
 <div>
 <label className="block text-[13px] font-medium text-gray-800 mb-2 flex justify-between items-center">
 Support document <span className="text-[10px] text-gray-400 font-normal">(Receipt / Invoice)</span>
 </label>
 <DocumentDropzone
 file={receiptFile}
 onFileChange={setReceiptFile}
 label="Receipt"
 description="Upload an image or PDF of your receipt"
 />
 </div>

 {/* ETR / eTIMS verification */}
 <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
     <EtrReceiptInput
         value={etrNumber}
         onChange={(v) => setEtrNumber(v)}
         onVerified={(verified, _result) => setEtrVerified(verified)}
     />
 </div>
 </div>
 )}
 </div>

 {/* 3. FOOTER — Fixed bottom actions */}
 <div className="px-6 py-4 sm:px-7 sm:py-4 border-t border-gray-100 bg-white flex justify-between items-center shrink-0">
  <div>
  {onCancel && (
  <button
  type="button"
  onClick={onCancel}
  className="px-5 py-3 bg-white border border-[#6366F1]/30 hover:bg-gray-50 text-gray-700 text-sm font-medium rounded-[8px] transition-colors focus:ring-2 focus:ring-[#6366F1]/20 outline-none shadow-sm"
  >
  Cancel Process
  </button>
  )}
  </div>
  <button
  type="submit"
  disabled={isSubmitting || !category || !amount}
                        className="px-7 py-2.5 bg-[#6366F1] hover:bg-[#1e1b6e] active:scale-[0.98] text-white text-sm font-semibold rounded-[10px] transition-all shadow-[0_4px_12px_rgba(41,37,141,0.25)] flex items-center gap-2 disabled:bg-gray-400 disabled:shadow-none disabled:cursor-not-allowed"
  >
  {isSubmitting ? (
  <><PiArrowsClockwise className="animate-spin text-base" /> Committing...</>
  ) : expense?.id ? (
  "Update Audit Record"
  ) : (
  <><PiPaperPlaneRight className="text-base" /> Create Entry</>
  )}
  </button>
 </div>
 </form>

 {/* Inline Account Creation Drawer — Absolute positioned OVER the form */}
 <AnimatePresence>
 {isCreatingAccount && (
 <>
 <motion.div
 initial={{ opacity: 0 }}
 animate={{ opacity: 1 }}
 exit={{ opacity: 0 }}
 onClick={() => setIsCreatingAccount(false)}
 className="absolute inset-0 bg-white/60 backdrop-blur-[2px] z-50 sm:rounded-[10px]"
 />
 <motion.div
 initial={{ y: "100%" }}
 animate={{ y: 0 }}
 exit={{ y: "100%" }}
 transition={{ type: "spring", bounce: 0, duration: 0.4 }}
 className="absolute inset-x-0 bottom-0 bg-white shadow-[0_-8px_30px_rgba(0,0,0,0.12)] z-[60] border-t border-[#6366F1]/20 pb-safe sm:rounded-b-[10px]"
 >
 <div className="p-6 sm:p-8">
 <div className="flex items-center justify-between mb-6">
 <div className="flex items-center gap-3">
 <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
 <PiBank className="text-gray-600" />
 </div>
 <h3 className="text-[17px] font-medium tracking-tight text-gray-900">Define Ledger Ruleset</h3>
 </div>
 <button onClick={() => setIsCreatingAccount(false)} className="text-gray-400 hover:text-gray-900 transition-colors p-2 -mr-2 rounded-full hover:bg-gray-100 focus:outline-none">
 <PiX className="text-xl" />
 </button>
 </div>
  
 {accountCreateError && (
 <div className="mb-5 p-3.5 bg-rose-50 text-rose-600 text-[13px] font-medium rounded-full flex items-center gap-2.5">
 <PiWarningCircle className="text-lg shrink-0" />
 {accountCreateError}
 </div>
 )}

 <div className="grid grid-cols-3 gap-5 mb-8">
 <div className="col-span-2">
 <label className="block text-[13px] font-medium text-gray-800 mb-2 line-clamp-1">Account Display Name</label>
 <input
 type="text"
 placeholder="e.g. Amazon Web Services"
 value={newAccountName}
 onChange={(e) => setNewAccountName(e.target.value)}
 className="w-full text-[15px] font-medium bg-white border border-gray-200 rounded-[10px] px-5 py-3 focus:outline-none focus:ring-2 focus:ring-[#6366F1]/10 focus:border-[#6366F1] transition-all hover:border-gray-300"
 />
 </div>
 <div className="col-span-1">
 <label className="block text-[13px] font-medium text-gray-800 mb-2 flex justify-between">
 GL Code <span className="hidden sm:inline font-normal text-gray-400 font-mono">(Num)</span>
 </label>
 <input
 type="text"
 placeholder="6005"
 value={newAccountCode}
 onChange={(e) => setNewAccountCode(e.target.value)}
 className="w-full text-[15px] font-mono bg-white border border-gray-200 rounded-[10px] px-5 py-3 focus:outline-none focus:ring-2 focus:ring-[#6366F1]/10 focus:border-[#6366F1] transition-all hover:border-gray-300"
 />
 </div>
 </div>
  
 <Button 
 type="button" 
 onClick={handleCreateAccount} 
 disabled={isSavingAccount || !newAccountName.trim() || !newAccountCode.trim()}
 className="w-full h-12 bg-[#6366F1] text-white hover:bg-[#6366F1]/90 text-[15px] font-medium tracking-wide rounded-full disabled:opacity-50"
 >
 {isSavingAccount ? <PiArrowsClockwise className="animate-spin text-lg mr-2" /> : null}
 {isSavingAccount ? "Saving Entry..." : "Register Ledger"}
 </Button>
 </div>
 </motion.div>
 </>
 )}
 </AnimatePresence>
 </div>
 );
}
