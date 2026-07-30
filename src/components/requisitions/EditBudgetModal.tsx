"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
    PiX,
    PiPlus,
    PiTrash,
    PiCheckCircle,
    PiCaretDown,
    PiWarning,
    PiCalendarBlank,
    PiBuildings,
    PiBriefcase,
    PiChartLineUp
} from "react-icons/pi";
import { motion, AnimatePresence } from "framer-motion";
import { EXPENSE_CATEGORIES } from "@/lib/constants";
import { useToast } from "@/components/ui/ToastProvider";
import { updateMonthlyBudget } from "@/app/dashboard/requisitions/budget-actions";

interface EditBudgetModalProps {
    isOpen: boolean;
    onClose: () => void;
    budget: any;
}

export function EditBudgetModal({ isOpen, onClose, budget }: EditBudgetModalProps) {
    const { showToast } = useToast();
    const router = useRouter();

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [month, setMonth] = useState(1);
    const [year, setYear] = useState(1);
    const [branch, setBranch] = useState("");
    const [department, setDepartment] = useState("");
    const [items, setItems] = useState([{ description: "", category: "Operations", amount: 0 }]);

    const [isMonthOpen, setIsMonthOpen] = useState(false);
    const [isYearOpen, setIsYearOpen] = useState(false);
    const [openDropdownIndex, setOpenDropdownIndex] = useState<number | null>(null);
    const [categorySearch, setCategorySearch] = useState("");

    useEffect(() => {
        if (budget && isOpen) {
            setMonth(budget.month || new Date().getMonth() + 1);
            setYear(budget.year || new Date().getFullYear());
            setBranch(budget.branch || "");
            setDepartment(budget.department || "");

            if (budget.items && budget.items.length > 0) {
                setItems(budget.items.map((item: any) => ({
                    description: item.description || "",
                    category: item.category || "Operations",
                    amount: item.amount || 0
                })));
            } else {
                setItems([{ description: "", category: "Operations", amount: 0 }]);
            }
        }
    }, [budget, isOpen]);

    if (!isOpen || !budget) return null;

    const filteredCategories = EXPENSE_CATEGORIES.filter(c =>
        c.toLowerCase().includes(categorySearch.toLowerCase())
    );

    const addItem = () => {
        setItems([...items, { description: "", category: "Operations", amount: 0 }]);
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

    const handleSubmit = async (e: React.FormEvent) => {
        if (!branch || !department) {
            showToast("Branch and Department are required", "error", "Missing Information");
            return;
        }

        if (items.some(item => !item.description || item.amount <= 0)) {
            showToast("Please fill in all item details with valid amounts greater than 0", "error", "Invalid Items");
            return;
        }

        setIsSubmitting(true);
        try {
            const result = await updateMonthlyBudget(budget.id, {
                month,
                year,
                branch,
                department,
                items: items.map(item => ({
                    ...item,
                    amount: parseFloat(item.amount as any)
                }))
            });

            if (result?.error) {
                showToast(result.error, "error", "Update Failed");
            } else if (result?.success) {
                showToast("Budget plan updated successfully", "success");
                router.refresh();
                onClose();
            }
        } catch (e: any) {
            showToast(e.message || "Failed to update budget requisition", "error", "System Error");
        } finally {
            setIsSubmitting(false);
        }
    };

    const months = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    ];

    return createPortal(
        <AnimatePresence>
            <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6 bg-[#0B0F19]/40 backdrop-blur-sm">
                <motion.div
                    initial={{ opacity: 0, scale: 0.98, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.98, y: 20 }}
                    transition={{ duration: 0.15, ease: "easeOut" }}
                    className="relative w-full max-w-5xl bg-white rounded-2xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.1),0_0_1px_rgba(0,0,0,0.2)] border border-gray-100 flex flex-col max-h-[90vh] overflow-hidden"
                >
                    {/* Header */}
                    <div className="h-[76px] px-6 sm:px-8 bg-white border-b border-gray-200 flex items-center justify-between shrink-0">
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-xl bg-white shadow-[0_2px_8px_rgba(41,37,141,0.12)] border border-[#6366F1]/10 flex items-center justify-center shrink-0">
                                <PiChartLineUp className="text-xl text-[#6366F1]" />
                            </div>
                            <div>
                                <h2 className="text-lg font-semibold text-[#111827] tracking-tight leading-tight">Edit Master Budget</h2>
                                <p className="text-xs text-gray-500 font-mono mt-0.5">ID: {budget.id.slice(0, 8).toUpperCase()}</p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 -mr-2 bg-transparent hover:bg-gray-200/50 rounded-lg transition-colors text-gray-400 hover:text-gray-900 focus:outline-none"
                        >
                            <PiX className="text-xl" />
                        </button>
                    </div>

                    {/* Body */}
                    <div className="flex-1 overflow-y-auto p-6 sm:px-8 bg-white custom-scrollbar">

                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                            {/* Left Column: Context & Details */}
                            <div className="lg:col-span-4 space-y-6">
                                <div>
                                    <h3 className="text-[11px] font-semibold text-gray-500 uppercase tracking-widest border-b border-gray-100 pb-2 mb-4">Configuration</h3>
                                    
                                    <div className="space-y-4">
                                        {/* Period */}
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1.5 flex items-center gap-1.5">
                                                <PiCalendarBlank className="text-gray-400" /> Fiscal Period
                                            </label>
                                            <div className="grid grid-cols-2 gap-2">
                                                {/* Custom Month Dropdown */}
                                                <div className="relative">
                                                    <button
                                                        onClick={() => { setIsMonthOpen(!isMonthOpen); setIsYearOpen(false); }}
                                                        className="w-full bg-white border border-gray-200 hover:border-gray-300 rounded-[8px] px-3 py-2 text-[14px] font-medium text-gray-900 flex items-center justify-between transition-colors shadow-sm focus:outline-none focus:ring-[3px] focus:ring-[#6366F1]/15 focus:border-[#6366F1]"
                                                    >
                                                        {months[month - 1]}
                                                        <PiCaretDown className={`text-xs text-gray-400 transition-transform ${isMonthOpen ? 'rotate-180' : ''}`} />
                                                    </button>

                                                    <AnimatePresence>
                                                        {isMonthOpen && (
                                                            <>
                                                                <div className="fixed inset-0 z-30" onClick={() => setIsMonthOpen(false)} />
                                                                <motion.div
                                                                    initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} transition={{ duration: 0.15 }}
                                                                    className="absolute top-full left-0 w-full mt-1 bg-white border border-gray-200 rounded-[10px] shadow-[0_10px_30px_rgba(0,0,0,0.1)] z-40 max-h-60 overflow-y-auto custom-scrollbar p-1"
                                                                >
                                                                    {months.map((m, i) => (
                                                                        <button
                                                                            key={m}
                                                                            onClick={() => { setMonth(i + 1); setIsMonthOpen(false); }}
                                                                            className={`w-full text-left px-3 py-2 text-[13px] rounded-[6px] transition-colors ${month === i + 1 ? 'font-semibold bg-[#6366F1]/5 text-[#6366F1]' : 'text-gray-700 hover:bg-gray-50'}`}
                                                                        >
                                                                            {m}
                                                                        </button>
                                                                    ))}
                                                                </motion.div>
                                                            </>
                                                        )}
                                                    </AnimatePresence>
                                                </div>

                                                {/* Custom Year Dropdown */}
                                                <div className="relative">
                                                    <button
                                                        onClick={() => { setIsYearOpen(!isYearOpen); setIsMonthOpen(false); }}
                                                        className="w-full bg-white border border-gray-200 hover:border-gray-300 rounded-[8px] px-3 py-2 text-[14px] font-medium text-gray-900 flex items-center justify-between transition-colors shadow-sm focus:outline-none focus:ring-[3px] focus:ring-[#6366F1]/15 focus:border-[#6366F1]"
                                                    >
                                                        {year}
                                                        <PiCaretDown className={`text-xs text-gray-400 transition-transform ${isYearOpen ? 'rotate-180' : ''}`} />
                                                    </button>

                                                    <AnimatePresence>
                                                        {isYearOpen && (
                                                            <>
                                                                <div className="fixed inset-0 z-30" onClick={() => setIsYearOpen(false)} />
                                                                <motion.div
                                                                    initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} transition={{ duration: 0.15 }}
                                                                    className="absolute top-full left-0 w-full mt-1 bg-white border border-gray-200 rounded-[10px] shadow-[0_10px_30px_rgba(0,0,0,0.1)] z-40 max-h-60 overflow-y-auto custom-scrollbar p-1"
                                                                >
                                                                    {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 1 + i).map(y => (
                                                                        <button
                                                                            key={y}
                                                                            onClick={() => { setYear(y); setIsYearOpen(false); }}
                                                                            className={`w-full text-left px-3 py-2 text-[13px] rounded-[6px] transition-colors ${year === y ? 'font-semibold bg-[#6366F1]/5 text-[#6366F1]' : 'text-gray-700 hover:bg-gray-50'}`}
                                                                        >
                                                                            {y}
                                                                        </button>
                                                                    ))}
                                                                </motion.div>
                                                            </>
                                                        )}
                                                    </AnimatePresence>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Branch */}
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1.5 flex items-center gap-1.5">
                                                <PiBuildings className="text-gray-400" /> Target Branch
                                            </label>
                                            <input
                                                className="w-full bg-white border border-gray-200 rounded-[8px] px-3 py-2 text-[14px] text-gray-900 focus:outline-none focus:ring-[3px] focus:ring-[#6366F1]/15 focus:border-[#6366F1] transition-all shadow-sm placeholder:text-gray-400 font-medium"
                                                placeholder="E.g. CBD Headquarters"
                                                value={branch}
                                                onChange={e => setBranch(e.target.value)}
                                            />
                                        </div>

                                        {/* Department */}
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1.5 flex items-center gap-1.5">
                                                <PiBriefcase className="text-gray-400" /> Department
                                            </label>
                                            <input
                                                className="w-full bg-white border border-gray-200 rounded-[8px] px-3 py-2 text-[14px] text-gray-900 focus:outline-none focus:ring-[3px] focus:ring-[#6366F1]/15 focus:border-[#6366F1] transition-all shadow-sm placeholder:text-gray-400 font-medium"
                                                placeholder="E.g. Engineering"
                                                value={department}
                                                onChange={e => setDepartment(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Right Column: Line Items */}
                            <div className="lg:col-span-8">
                                <div className="flex justify-between items-center border-b border-gray-100 pb-2 mb-4">
                                    <h3 className="text-[11px] font-semibold text-gray-500 uppercase tracking-widest">
                                        Budget Items ({items.length})
                                    </h3>
                                    <button
                                        type="button"
                                        onClick={addItem}
                                        className="flex items-center gap-1.5 text-[#6366F1] text-xs font-semibold hover:text-[#6366F1]/80 transition-colors bg-[#6366F1]/5 px-3 py-1.5 rounded-md"
                                    >
                                        <PiPlus /> Add Line Item
                                    </button>
                                </div>

                                <div className="bg-[#FAFAFC] rounded-xl border border-gray-200 overflow-hidden">
                                    {/* Desktop Table Header */}
                                    <div className="hidden md:grid grid-cols-[1fr_200px_140px_40px] gap-4 px-4 py-3 bg-white border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                        <div>Description</div>
                                        <div>Category</div>
                                        <div className="text-right pr-2">Amount</div>
                                        <div></div>
                                    </div>

                                    <div className="divide-y divide-gray-100">
                                        {items.map((item, index) => (
                                            <div key={index} className="grid grid-cols-1 md:grid-cols-[1fr_200px_140px_40px] gap-3 md:gap-4 p-4 md:px-4 md:py-3 bg-white relative group items-center transition-colors hover:bg-gray-50/50">
                                                {/* Description */}
                                                <div>
                                                    <label className="md:hidden text-xs font-medium text-gray-500 mb-1 block">Description</label>
                                                    <input
                                                        className="w-full bg-white border border-gray-200 md:border-transparent md:group-hover:border-gray-200 rounded-[8px] px-3 py-2 text-[14px] font-medium focus:outline-none focus:ring-[2px] focus:ring-[#6366F1]/15 focus:border-[#6366F1] text-gray-900 placeholder:text-gray-400 transition-all shadow-sm md:shadow-none"
                                                        placeholder="Item description..."
                                                        value={item.description}
                                                        onChange={e => updateItem(index, 'description', e.target.value)}
                                                    />
                                                </div>
                                                
                                                {/* Category */}
                                                <div className="relative">
                                                    <label className="md:hidden text-xs font-medium text-gray-500 mb-1 block">Category</label>
                                                    <div
                                                        className="w-full flex items-center justify-between cursor-pointer border border-gray-200 rounded-[8px] px-3 py-2 bg-white hover:border-gray-300 transition-colors shadow-sm focus-within:ring-[2px] focus-within:ring-[#6366F1]/15 focus-within:border-[#6366F1]"
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
                                                        <span className={`text-[13px] whitespace-nowrap truncate mr-2 ${item.category ? 'text-gray-900 font-medium' : 'text-gray-400'}`}>
                                                            {item.category || "Select..."}
                                                        </span>
                                                        <PiCaretDown className="text-gray-400 text-[10px] shrink-0" />
                                                    </div>

                                                    <AnimatePresence>
                                                        {openDropdownIndex === index && (
                                                            <>
                                                                <div className="fixed inset-0 z-40" onClick={() => setOpenDropdownIndex(null)} />
                                                                <motion.div
                                                                    initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} transition={{ duration: 0.15 }}
                                                                    className="absolute top-full left-0 md:right-0 md:left-auto w-full md:w-56 mt-1 bg-white border border-gray-200 rounded-[10px] shadow-[0_10px_30px_rgba(0,0,0,0.1)] z-50 p-1.5"
                                                                    onClick={e => e.stopPropagation()}
                                                                >
                                                                    <div className="px-1 mb-1.5">
                                                                        <input
                                                                            autoFocus
                                                                            className="w-full bg-gray-50 border border-gray-100 rounded-md px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#6366F1] placeholder:text-gray-400"
                                                                            placeholder="Search..."
                                                                            value={categorySearch}
                                                                            onChange={e => setCategorySearch(e.target.value)}
                                                                        />
                                                                    </div>
                                                                    <div className="max-h-48 overflow-y-auto custom-scrollbar px-1 space-y-0.5">
                                                                        {filteredCategories.length > 0 ? (
                                                                            filteredCategories.map(cat => (
                                                                                <button
                                                                                    key={cat}
                                                                                    onClick={() => {
                                                                                        updateItem(index, 'category', cat);
                                                                                        setOpenDropdownIndex(null);
                                                                                    }}
                                                                                    className={`w-full text-left px-2.5 py-1.5 text-[13px] rounded-md transition-colors ${item.category === cat ? 'bg-[#6366F1]/5 text-[#6366F1] font-semibold' : 'text-gray-700 hover:bg-gray-50'}`}
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
                                                                                className="w-full text-left px-2.5 py-1.5 text-xs text-[#6366F1] hover:bg-[#6366F1]/5 rounded-md flex items-center gap-1.5 font-semibold"
                                                                            >
                                                                                <PiPlus /> Assign "{categorySearch}"
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                </motion.div>
                                                            </>
                                                        )}
                                                    </AnimatePresence>
                                                </div>

                                                {/* Amount */}
                                                <div>
                                                    <label className="md:hidden text-xs font-medium text-gray-500 mb-1 block">Amount</label>
                                                    <div className="flex items-center">
                                                        <input
                                                            type="number"
                                                            step="1"
                                                            className="w-full bg-white border border-gray-200 rounded-[8px] pl-3 pr-3 py-2 text-[14px] font-mono font-medium text-right focus:outline-none focus:ring-[2px] focus:ring-[#6366F1]/15 focus:border-[#6366F1] text-gray-900 placeholder:text-gray-300 transition-all shadow-sm"
                                                            placeholder="0.00"
                                                            value={item.amount || ""}
                                                            onChange={e => updateItem(index, 'amount', e.target.value)}
                                                            onFocus={(e) => e.target.select()}
                                                        />
                                                    </div>
                                                </div>

                                                {/* Remove */}
                                                <div className="flex justify-end md:justify-center">
                                                    <button
                                                        type="button"
                                                        onClick={() => removeItem(index)}
                                                        className="w-8 h-8 rounded-[6px] flex items-center justify-center text-gray-400 hover:text-rose-500 hover:bg-rose-50 transition-colors focus:outline-none focus:ring-2 focus:ring-rose-500/20"
                                                        title="Remove item"
                                                    >
                                                        <PiTrash className="text-lg" />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="px-6 py-4 sm:px-8 border-t border-gray-100 bg-[#FAFAFC] flex flex-col sm:flex-row items-center justify-between gap-4 shrink-0">
                        <div className="flex flex-col w-full sm:w-auto">
                            <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">Total Planned Allocation</span>
                            <span className="text-xl font-mono font-semibold text-[#111827] tracking-tight">
                                ${totalAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                            </span>
                        </div>

                        <div className="flex items-center gap-3 w-full sm:w-auto">
                            <button
                                type="button"
                                onClick={onClose}
                                className="flex-1 sm:flex-none px-4 py-2.5 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 text-sm font-semibold rounded-[8px] transition-colors focus:ring-2 focus:ring-[#6366F1]/20 outline-none shadow-sm"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleSubmit}
                                disabled={isSubmitting}
                                className="flex-1 sm:flex-none px-6 py-2.5 bg-[#111827] hover:bg-[#1f2937] text-white text-sm font-semibold rounded-[8px] transition-colors focus:ring-2 focus:ring-[#111827]/40 outline-none shadow-[0_2px_4px_rgba(0,0,0,0.1)] flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isSubmitting ? (
                                    <>Processing...</>
                                ) : (
                                    <>
                                        <PiCheckCircle className="text-base" />
                                        Save Changes
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>,
        document.body
    );
}
