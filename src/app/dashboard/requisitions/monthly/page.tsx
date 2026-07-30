"use client";

import { useState, useEffect } from"react";
import Image from"next/image";
import { createMonthlyBudget } from"../budget-actions";
import { useToast } from"@/components/ui/ToastProvider";
import { useRouter } from"next/navigation";
import Link from"next/link";
import {
 PiCaretLeft,
 PiPlus,
 PiTrash,
 PiCalendar,
 PiBuildings,
 PiUsers,
 PiCurrencyDollar,
 PiTextAa,
 PiTag,
 PiCheckCircle,
 PiCaretDown,
 PiMagnifyingGlass,
 PiX,
 PiWarningCircle,
 PiArrowsClockwise
} from"react-icons/pi";
import { EXPENSE_CATEGORIES } from"@/lib/constants";
import { getExpenseAccountsAction, createExpenseAccountAction } from"@/app/dashboard/requisitions/new/multi-item-actions";
import { Button } from"@/components/ui/Button";
import { Input } from"@/components/ui/Input";
import { CustomSelect } from"@/components/ui/CustomSelect";

export default function MonthlyBudgetPage() {
 const { showToast } = useToast();
 const router = useRouter();
 const [isSubmitting, setIsSubmitting] = useState(false);

 // Header Info
 const [periodType, setPeriodType] = useState<"MONTHLY"|"WEEKLY">("MONTHLY");
 const [month, setMonth] = useState(new Date().getMonth() + 1);
 const [week, setWeek] = useState(1);
 const [year, setYear] = useState(new Date().getFullYear());
 const [branch, setBranch] = useState("");
 const [department, setDepartment] = useState("");

 // Custom Ledger
 const [customAccountId, setCustomAccountId] = useState("");
 const [expenseAccounts, setExpenseAccounts] = useState<any[]>([]);
 
 // Inline account creation
 const [isCreatingAccount, setIsCreatingAccount] = useState(false);
 const [newAccountName, setNewAccountName] = useState("");
 const [newAccountCode, setNewAccountCode] = useState("");
 const [accountCreateError, setAccountCreateError] = useState("");
 const [isSavingAccount, setIsSavingAccount] = useState(false);

 useEffect(() => {
 getExpenseAccountsAction().then((accs: any[]) => setExpenseAccounts(accs));
 }, []);

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

 const [isMonthOpen, setIsMonthOpen] = useState(false);
 const [isYearOpen, setIsYearOpen] = useState(false);

 const [openDropdownIndex, setOpenDropdownIndex] = useState<number | null>(null);
 const [categorySearch, setCategorySearch] = useState("");

 const filteredCategories = EXPENSE_CATEGORIES.filter(c =>
 c.toLowerCase().includes(categorySearch.toLowerCase())
 );

 // Items
 const [items, setItems] = useState([
 { description:"", category:"Operations", amount: 0 }
 ]);

 const addItem = () => {
 setItems([...items, { description:"", category:"Operations", amount: 0 }]);
 };

 const removeItem = (index: number) => {
 if (items.length === 1) return;
 setItems(items.filter((_, i) => i !== index));
 };

 const updateItem = (index: number, field: string, value: any) => {
 const newItems = [...items];
 (newItems[index] as any)[field] = value;
 setItems(newItems);
 };

 const totalAmount = items.reduce((sum, item) => sum + (parseFloat(item.amount as any) || 0), 0);

 const handleSubmit = async () => {
 if (!branch || !department) {
 showToast("Branch and Department are required","error");
 return;
 }

 if (items.some(item => !item.description || item.amount <= 0)) {
 showToast("Please fill in all item details with valid amounts","error");
 return;
 }

 setIsSubmitting(true);
 try {
 const result = await createMonthlyBudget({
 month,
 year,
 branch,
 department,
 accountId: customAccountId || undefined,
 items: items.map(item => ({
 ...item,
 amount: parseFloat(item.amount as any)
 }))
 });

 if (result?.error) {
 showToast(result.error,"error");
 } else if (result?.success) {
 showToast("Budget plan submitted successfully","success");
 router.push("/dashboard/requisitions");
 router.refresh();
 }
 } catch (e) {
 showToast("Failed to submit budget requisition","error");
 } finally {
 setIsSubmitting(false);
 }
 };

 const months = [
"January","February","March","April","May","June",
"July","August","September","October","November","December"
 ];

 return (
 <div className="pb-24 font-sans">
 <div className="bg-white rounded-xl flex flex-col relative" style={{border:'1px solid rgba(0,0,0,0.09)',boxShadow:'0 1px 3px rgba(0,0,0,0.06)'}}>
 {/* Header */}
 <div className="h-[88px] px-6 flex items-center justify-between border-b border-gray-200 rounded-t-xl">
 <div className="flex items-center gap-4">
 <Link href="/dashboard/requisitions"className="p-2 rounded-lg hover:bg-white/50 text-gray-400 hover:text-gray-900 transition-all">
 <PiCaretLeft className="text-xl"/>
 </Link>
 <div className="flex items-center gap-3">
 <div className="flex items-center justify-center shrink-0">
 <Image src="/accounting.png"alt="Budget Icon"width={64} height={64} className="object-contain"/>
 </div>
 <div>
 <h1 className="text-base font-semibold text-gray-900">{periodType ==="MONTHLY"?"Monthly":"Weekly"} Budget Plan</h1>
 <p className="text-xs text-gray-500 mt-1">
 {periodType ==="MONTHLY"? months[month - 1] : `Week ${week}`} {year} • Internal Projection
 </p>
 </div>
 </div>
 </div>
 </div>

 {/* Body */}
 <div className="p-6 lg:p-10">
 <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
 {/* Left Column: Context & Details */}
 <div className="lg:col-span-1 space-y-6">
 <div className="p-6 space-y-6 border border-gray-200 rounded-xl shadow-none">
 <h3 className="text-xs font-semibold text-gray-900 uppercase tracking-widest border-b border-gray-100 pb-3">Configuration</h3>

 <div className="space-y-5">
 {/* Period Toggle */}
 <div className="bg-gray-100 p-1 rounded-lg flex">
 <button
 onClick={() => setPeriodType("MONTHLY")}
 className={`flex-1 py-1.5 text-[10px] font-semibold uppercase tracking-wider rounded-md transition-all ${periodType ==="MONTHLY"?"bg-white text-[#6366F1] shadow-sm":"text-gray-500 hover:text-gray-700"}`}
 >
 Monthly
 </button>
 <button
 onClick={() => setPeriodType("WEEKLY")}
 className={`flex-1 py-1.5 text-[10px] font-semibold uppercase tracking-wider rounded-md transition-all ${periodType ==="WEEKLY"?"bg-white text-[#6366F1] shadow-sm":"text-gray-500 hover:text-gray-700"}`}
 >
 Weekly
 </button>
 </div>

 <div className="space-y-2">
 <label className="block text-xs font-medium text-gray-700 mb-1.5">
 Planning Period
 </label>
 <div className="grid grid-cols-2 gap-2">
 {/* Custom Month/Week Dropdown */}
 <div className="relative">
 <button
 onClick={() => { setIsMonthOpen(!isMonthOpen); setIsYearOpen(false); }}
 className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm font-medium text-gray-900 flex items-center justify-between hover:border-[#6366F1] transition-colors focus:outline-none focus:ring-1 focus:ring-[#6366F1]"
 >
 {periodType ==="MONTHLY"? months[month - 1] : `Week ${week}`}
 <PiCaretDown className={`text-xs text-gray-400 transition-transform ${isMonthOpen ? 'rotate-180' : ''}`} />
 </button>

 {isMonthOpen && (
 <>
 <div className="fixed inset-0 z-30"onClick={() => setIsMonthOpen(false)} />
 <div className="absolute top-full left-0 w-full mt-1 bg-white border border-gray-100 rounded-lg shadow-xl z-40 max-h-60 overflow-y-auto custom-scrollbar">
 {periodType ==="MONTHLY"? (
 months.map((m, i) => (
 <button
 key={m}
 onClick={() => { setMonth(i + 1); setIsMonthOpen(false); }}
 className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 transition-colors ${month === i + 1 ? 'text-[#6366F1] font-semibold bg-[#6366F1]/5' : 'text-gray-600'}`}
 >
 {m}
 </button>
 ))
 ) : (
 Array.from({ length: 52 }, (_, i) => i + 1).map(w => (
 <button
 key={w}
 onClick={() => { setWeek(w); setIsMonthOpen(false); }}
 className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 transition-colors ${week === w ? 'text-[#6366F1] font-semibold bg-[#6366F1]/5' : 'text-gray-600'}`}
 >
 Week {w}
 </button>
 ))
 )}
 </div>
 </>
 )}
 </div>

 {/* Custom Year Dropdown */}
 <div className="relative">
 <button
 onClick={() => { setIsYearOpen(!isYearOpen); setIsMonthOpen(false); }}
 className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm font-medium text-gray-900 flex items-center justify-between hover:border-[#6366F1] transition-colors focus:outline-none focus:ring-1 focus:ring-[#6366F1]"
 >
 {year}
 <PiCaretDown className={`text-xs text-gray-400 transition-transform ${isYearOpen ? 'rotate-180' : ''}`} />
 </button>

 {isYearOpen && (
 <>
 <div className="fixed inset-0 z-30"onClick={() => setIsYearOpen(false)} />
 <div className="absolute top-full left-0 w-full mt-1 bg-white border border-gray-100 rounded-lg shadow-xl z-40 max-h-60 overflow-y-auto custom-scrollbar">
 {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 1 + i).map(y => (
 <button
 key={y}
 onClick={() => { setYear(y); setIsYearOpen(false); }}
 className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 transition-colors ${year === y ? 'text-[#6366F1] font-semibold bg-[#6366F1]/5' : 'text-gray-600'}`}
 >
 {y}
 </button>
 ))}
 </div>
 </>
 )}
 </div>
 </div>
 </div>

 <div className="space-y-2">
 <label className="block text-xs font-medium text-gray-700 mb-1.5">
 Target Branch
 </label>
 <input
 className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-[#6366F1] focus:border-[#6366F1] transition-all shadow-none"
 placeholder="Branch Name"
 value={branch}
 onChange={e => setBranch(e.target.value)}
 />
 </div>

 <div className="space-y-2">
 <label className="block text-xs font-medium text-gray-700 mb-1.5">
 Department
 </label>
 <input
 className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-[#6366F1] focus:border-[#6366F1] transition-all shadow-none"
 placeholder="Department"
 value={department}
 onChange={e => setDepartment(e.target.value)}
 />
 </div>

 <div className="space-y-2">
 <label className="block text-xs font-medium text-gray-700 mb-1.5 flex items-center justify-between">
 Custom Ledger <span className="text-gray-400 font-normal">(Optional)</span>
 </label>
 <div className="flex gap-2">
 <CustomSelect
 value={customAccountId}
 onChange={val => setCustomAccountId(val)}
 options={expenseAccounts.map((acc: any) => ({ value: acc.id, label: `${acc.code} - ${acc.name}` }))}
 placeholder="Default"
 className="flex-1 bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-[#6366F1] focus:border-[#6366F1] transition-all shadow-none"
 />
 <button
 type="button"
 onClick={() => setIsCreatingAccount(true)}
 className="p-2 border border-gray-200 rounded-lg text-[#6366F1] hover:bg-gray-50 transition-colors"
 title="Create New Ledger Account"
 >
 <PiPlus />
 </button>
 </div>
 </div>
 </div>
 </div>
 </div>

 {/* Right Column: Line Items */}
 <div className="lg:col-span-2 space-y-6">
 <div className="p-6 border border-gray-200 rounded-xl shadow-none">
 <div className="flex justify-between items-center mb-6">
 <h3 className="text-xs font-semibold text-gray-900 uppercase tracking-widest">
 Line Items ({items.length})
 </h3>
 <button
 onClick={addItem}
 className="flex items-center gap-2 text-[#6366F1] text-xs font-semibold hover:underline"
 >
 <PiPlus /> Add Item
 </button>
 </div>

 <div className="divide-y divide-gray-100 border border-gray-100 rounded-lg">
 {items.map((item, index) => (
 <div key={index} className="flex flex-col md:flex-row gap-4 p-4 bg-white hover:bg-gray-50/50 transition-colors border-b border-gray-50 last:border-0 relative">
 <div className="flex-1">
 <input
 className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm font-medium focus:outline-none focus:ring-1 focus:ring-[#6366F1] focus:border-[#6366F1] text-gray-900 placeholder:text-gray-400 transition-all"
 placeholder="Description"
 value={item.description}
 onChange={e => updateItem(index, 'description', e.target.value)}
 />
 </div>
 <div className="w-full md:w-48 relative">
 <div
 className="flex items-center justify-between cursor-pointer bg-white border border-gray-200 rounded-xl px-4 py-3 transition-all hover:border-[#6366F1]/30 focus-within:ring-1 focus-within:ring-[#6366F1] focus-within:border-[#6366F1]"
 onClick={(e) => {
 e.stopPropagation();
 if (openDropdownIndex === index) {
 setOpenDropdownIndex(null);
 } else {
 setOpenDropdownIndex(index);
 setCategorySearch("");
 }
 }}
 >
 <span className={`text-sm ${item.category ? 'text-[#6366F1] font-medium' : 'text-gray-400'}`}>
 {item.category ||"Select Category"}
 </span>
 <PiCaretDown className="text-gray-400 text-xs"/>
 </div>

 {/* Dropdown Menu */}
 {openDropdownIndex === index && (
 <div
 className="absolute top-full left-0 w-64 bg-white border border-gray-100 rounded-xl shadow-xl z-50 p-2 mt-1"
 onClick={e => e.stopPropagation()}
 >
 <div className="mb-2">
 <input
 autoFocus
 className="w-full pl-3 pr-2 py-1.5 bg-gray-50 border border-gray-100 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-[#6366F1]"
 placeholder="Search..."
 value={categorySearch}
 onChange={e => setCategorySearch(e.target.value)}
 />
 </div>
 <div className="max-h-48 overflow-y-auto custom-scrollbar space-y-0.5">
 {filteredCategories.length > 0 ? (
 filteredCategories.map(cat => (
 <button
 key={cat}
 onClick={() => {
 updateItem(index, 'category', cat);
 setOpenDropdownIndex(null);
 }}
 className={`w-full text-left px-2 py-1.5 text-xs rounded-md transition-colors ${item.category === cat
 ? 'bg-[#6366F1]/5 text-[#6366F1] font-medium'
 : 'text-gray-600 hover:bg-gray-50'
 }`}
 >
 {cat}
 </button>
 ))
 ) : (
 <button
 onClick={() => {
 updateItem(index, 'category', categorySearch);
 setOpenDropdownIndex(null);
 }}
 className="w-full text-left px-2 py-2 text-xs text-[#6366F1] hover:bg-[#6366F1]/5 rounded-md flex items-center gap-2 font-medium"
 >
 <PiPlus /> Create"{categorySearch}"
 </button>
 )}
 </div>
 </div>
 )}

 {/* Backdrop */}
 {openDropdownIndex === index && (
 <div
 className="fixed inset-0 z-40"
 onClick={() => setOpenDropdownIndex(null)}
 />
 )}
 </div>
 <div className="w-full md:w-40 flex items-center gap-2 border border-gray-200 rounded-xl px-4 py-3 transition-all focus-within:ring-1 focus-within:ring-[#6366F1] focus-within:border-[#6366F1]">
 <span className="text-gray-400 text-sm font-semibold">$</span>
 <input
 type="number"
 className="w-full bg-transparent text-base font-mono font-semibold text-right focus:outline-none text-gray-900 placeholder:text-gray-300"
 placeholder="0.00"
 value={item.amount ||""}
 onChange={e => updateItem(index, 'amount', e.target.value)}
 onFocus={(e) => e.target.select()}
 />
 </div>
 <button
 onClick={() => removeItem(index)}
 className="text-gray-300 hover:text-rose-500 transition-colors"
 >
 <PiTrash />
 </button>
 </div>
 ))}
 </div>
 </div>

 <div className="p-6 border border-gray-200 rounded-xl shadow-none">
 <label className="block text-xs font-medium text-gray-700 mb-2.5 uppercase tracking-widest">
 Business Justification
 </label>
 <textarea
 className="w-full bg-white border border-gray-200 rounded-lg px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-[#6366F1] focus:border-[#6366F1] transition-all min-h-[100px] shadow-none"
 placeholder="Reason for this budget request..."
 ></textarea>
 </div>
 </div>
 </div>
 </div>

 {/* Footer */}
 <div className="h-[88px] px-6 border-t border-gray-100 flex items-center justify-between shrink-0 rounded-b-xl">
 <div className="flex flex-col">
 <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Estimated Total</span>
 <span className="text-xl font-mono font-semibold text-gray-900">
 ${totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
 </span>
 </div>

 <div className="flex items-center gap-3">
 <Link
 href="/dashboard/requisitions"
 className="px-4 py-2.5 rounded-md text-xs font-medium text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 transition-colors shadow-none"
 >
 Cancel
 </Link>
 <button
 onClick={handleSubmit}
 disabled={isSubmitting}
 className="px-6 py-2.5 bg-[#6366F1] text-white rounded-md font-medium text-xs hover:bg-[#6366F1]/90 transition-all disabled:opacity-50 flex items-center gap-2 shadow-none"
 >
 {isSubmitting ?"Submitting...": (
 <>
 <PiCheckCircle className="text-sm"/>
 Submit Budget Plan
 </>
 )}
 </button>
 </div>
 </div>

 {/* Inline Account Creation Overlay */}
 {isCreatingAccount && (
 <div className="absolute inset-x-0 bottom-0 border-t border-gray-200 p-6 z-50 rounded-b-xl animate-in slide-in-from-bottom-4">
 <div className="flex items-center justify-between mb-4">
 <h3 className="text-sm font-semibold text-gray-900">Create New Ledger Account</h3>
 <button onClick={() => setIsCreatingAccount(false)} className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-md hover:bg-gray-100">
 <PiX className="text-lg"/>
 </button>
 </div>
 {accountCreateError && (
 <div className="mb-4 p-3 bg-red-50 text-red-600 text-xs rounded-lg flex items-center gap-2">
 <PiWarningCircle className="text-base shrink-0"/>
 {accountCreateError}
 </div>
 )}
 <div className="flex gap-3 mb-4">
 <div className="flex-1">
 <label className="block text-xs font-semibold text-gray-700 mb-1">Account Name</label>
 <Input
 type="text"
 placeholder="e.g. Server Hosting"
 value={newAccountName}
 onChange={(e) => setNewAccountName(e.target.value)}
 className="w-full text-sm font-medium"
 />
 </div>
 <div className="w-1/3">
 <label className="block text-xs font-semibold text-gray-700 mb-1">GL Code</label>
 <Input
 type="text"
 placeholder="e.g. 6005"
 value={newAccountCode}
 onChange={(e) => setNewAccountCode(e.target.value)}
 className="w-full text-sm font-mono"
 />
 </div>
 </div>
 <div className="flex justify-end gap-2">
 <Button type="button"variant="outline"size="sm"onClick={() => setIsCreatingAccount(false)} disabled={isSavingAccount}>
 Cancel
 </Button>
 <Button type="button"size="sm"onClick={handleCreateAccount} disabled={isSavingAccount}>
 {isSavingAccount ? <PiArrowsClockwise className="animate-spin text-base mr-1.5"/> : <PiCheckCircle className="text-base mr-1.5"/>}
 Save Account
 </Button>
 </div>
 </div>
 )}
 </div>
 </div>
 );
}
