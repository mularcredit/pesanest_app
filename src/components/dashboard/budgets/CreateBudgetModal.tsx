"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
    PiX, PiCheckCircle, PiCaretUpDown,
    PiChartPieSlice, PiSpinner,
} from "react-icons/pi";
import { cn } from "@/lib/utils";
import { EXPENSE_CATEGORIES } from "@/lib/constants";
import { getExpenseAccountsAction } from "@/app/dashboard/requisitions/new/multi-item-actions";

interface CreateBudgetModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess?: () => void;
}

const INPUT_CLASS = "w-full rounded-[6px] px-3 py-[10px] text-[13px] text-gray-900 placeholder:text-gray-300 outline-none focus:ring-1 focus:ring-[#6366F1] transition-colors bg-white";
const INPUT_STYLE: React.CSSProperties = { border: '1px solid rgba(0,0,0,0.09)' };
const LABEL_CLASS = "block text-[11.5px] font-[500] text-gray-400 mb-1.5";

export function CreateBudgetModal({ isOpen, onClose, onSuccess }: CreateBudgetModalProps) {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [frequency, setFrequency] = useState<'MONTHLY' | 'WEEKLY'>('MONTHLY');
    const [amount, setAmount] = useState('');
    const [category, setCategory] = useState('');
    const [alertThreshold, setAlertThreshold] = useState('80');
    const [rollover, setRollover] = useState(false);
    const [customAccountId, setCustomAccountId] = useState('');
    const [expenseAccounts, setExpenseAccounts] = useState<any[]>([]);

    const [isCategoryOpen, setIsCategoryOpen] = useState(false);
    const [categorySearch, setCategorySearch] = useState('');
    const [isAccountOpen, setIsAccountOpen] = useState(false);
    const [accountSearch, setAccountSearch] = useState('');

    useEffect(() => {
        if (isOpen) getExpenseAccountsAction().then(a => setExpenseAccounts(a));
    }, [isOpen]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        // Simulate API call
        await new Promise(r => setTimeout(r, 900));
        setIsSubmitting(false);
        onSuccess?.();
    };

    const reset = () => {
        setFrequency('MONTHLY'); setAmount(''); setCategory(''); setAlertThreshold('80');
        setRollover(false); setCustomAccountId('');
    };

    const handleClose = () => { reset(); onClose(); };

    if (!isOpen) return null;

    const filteredCategories = EXPENSE_CATEGORIES.filter(c =>
        c.toLowerCase().includes(categorySearch.toLowerCase())
    );
    const filteredAccounts = expenseAccounts.filter(a =>
        a.name.toLowerCase().includes(accountSearch.toLowerCase()) ||
        a.code.toLowerCase().includes(accountSearch.toLowerCase())
    );

    return createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/30" onClick={handleClose} />
            <div className="relative bg-white rounded-[12px] w-full max-w-[460px] overflow-hidden flex flex-col max-h-[90vh] z-10"
                style={{ border: '1px solid rgba(0,0,0,0.09)', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>

                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 shrink-0"
                    style={{ borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-[7px] bg-indigo-50 flex items-center justify-center">
                            <PiChartPieSlice className="text-[#6366F1] text-[15px]" />
                        </div>
                        <div>
                            <h2 className="text-[14px] font-[600] text-gray-900">New Budget Rule</h2>
                            <p className="text-[11.5px] text-gray-400">Set a category spending limit</p>
                        </div>
                    </div>
                    <button onClick={handleClose}
                        className="p-1.5 rounded-[5px] hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors">
                        <PiX className="text-[15px]" />
                    </button>
                </div>

                {/* Body */}
                <form id="budget-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
                    <div className="px-6 py-5 space-y-5">

                        {/* Frequency toggle */}
                        <div>
                            <p className={LABEL_CLASS}>Cycle</p>
                            <div className="flex rounded-[6px] overflow-hidden" style={{ border: '1px solid rgba(0,0,0,0.09)' }}>
                                {(['MONTHLY', 'WEEKLY'] as const).map(f => (
                                    <button key={f} type="button" onClick={() => setFrequency(f)}
                                        className={cn("flex-1 py-2 text-[12.5px] font-[500] transition-colors",
                                            frequency === f ? "bg-indigo-50 text-[#6366F1]" : "bg-white text-gray-500 hover:bg-gray-50")}
                                        style={f === 'WEEKLY' ? { borderLeft: '1px solid rgba(0,0,0,0.09)' } : {}}>
                                        {f === 'MONTHLY' ? 'Monthly' : 'Weekly'}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Category */}
                        <div className="relative">
                            <label className={LABEL_CLASS}>Category <span className="text-rose-400">*</span></label>
                            <button type="button" onClick={() => { setIsCategoryOpen(o => !o); setIsAccountOpen(false); }}
                                className={cn(INPUT_CLASS, "flex items-center justify-between text-left")}
                                style={INPUT_STYLE}>
                                <span className={category ? 'text-gray-900' : 'text-gray-300'}>
                                    {category || 'Select expense category…'}
                                </span>
                                <PiCaretUpDown className="text-gray-400 text-[14px] shrink-0" />
                            </button>
                            {isCategoryOpen && (
                                <>
                                    <div className="fixed inset-0 z-40" onClick={() => setIsCategoryOpen(false)} />
                                    <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-[8px] z-50 overflow-hidden"
                                        style={{ border: '1px solid rgba(0,0,0,0.09)', boxShadow: '0 8px 30px rgba(0,0,0,0.1)' }}>
                                        <div className="p-2" style={{ borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
                                            <input autoFocus type="text" value={categorySearch}
                                                onChange={e => setCategorySearch(e.target.value)}
                                                placeholder="Search categories…"
                                                className="w-full rounded-[5px] px-3 py-1.5 text-[12.5px] text-gray-900 placeholder:text-gray-300 outline-none focus:ring-1 focus:ring-[#6366F1] bg-white"
                                                style={{ border: '1px solid rgba(0,0,0,0.09)' }} />
                                        </div>
                                        <div className="max-h-48 overflow-y-auto p-1.5 space-y-0.5">
                                            {filteredCategories.length === 0 ? (
                                                <p className="text-[12px] text-gray-400 px-3 py-2">No categories found</p>
                                            ) : filteredCategories.map(cat => (
                                                <button key={cat} type="button"
                                                    onClick={() => { setCategory(cat); setIsCategoryOpen(false); setCategorySearch(''); }}
                                                    className={cn("w-full text-left px-3 py-2 rounded-[5px] text-[12.5px] font-[500] transition-colors",
                                                        category === cat ? "bg-indigo-50 text-[#6366F1]" : "text-gray-700 hover:bg-gray-50")}>
                                                    {cat}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Amount */}
                        <div>
                            <label className={LABEL_CLASS}>Maximum Limit <span className="text-rose-400">*</span></label>
                            <div>
                                <input type="number" required min="0" step="1" value={amount}
                                    onChange={e => setAmount(e.target.value)}
                                    placeholder="0"
                                    className="w-full rounded-[6px] pl-3 pr-3 py-[10px] text-[13px] font-mono text-gray-900 placeholder:text-gray-300 outline-none focus:ring-1 focus:ring-[#6366F1] bg-white"
                                    style={INPUT_STYLE} />
                            </div>
                        </div>

                        {/* Ledger account */}
                        <div className="relative">
                            <label className={LABEL_CLASS}>General Ledger Account <span className="text-gray-300">(optional)</span></label>
                            <button type="button" onClick={() => { setIsAccountOpen(o => !o); setIsCategoryOpen(false); }}
                                className={cn(INPUT_CLASS, "flex items-center justify-between text-left")}
                                style={INPUT_STYLE}>
                                {customAccountId ? (
                                    <span className="text-gray-900">
                                        {expenseAccounts.find(a => a.id === customAccountId)?.name}{' '}
                                        <span className="text-gray-400 font-mono text-[11px]">
                                            GL-{expenseAccounts.find(a => a.id === customAccountId)?.code}
                                        </span>
                                    </span>
                                ) : (
                                    <span className="text-gray-300">Standard auto-routing…</span>
                                )}
                                <PiCaretUpDown className="text-gray-400 text-[14px] shrink-0" />
                            </button>
                            {isAccountOpen && (
                                <>
                                    <div className="fixed inset-0 z-40" onClick={() => setIsAccountOpen(false)} />
                                    <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-[8px] z-50 overflow-hidden"
                                        style={{ border: '1px solid rgba(0,0,0,0.09)', boxShadow: '0 8px 30px rgba(0,0,0,0.1)' }}>
                                        <div className="p-2" style={{ borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
                                            <div>
                                                <input autoFocus type="text" value={accountSearch}
                                                    onChange={e => setAccountSearch(e.target.value)}
                                                    placeholder="Search GL codes…"
                                                    className="w-full rounded-[5px] pl-3 pr-3 py-1.5 text-[12.5px] text-gray-900 placeholder:text-gray-300 outline-none focus:ring-1 focus:ring-[#6366F1] bg-white"
                                                    style={{ border: '1px solid rgba(0,0,0,0.09)' }} />
                                            </div>
                                        </div>
                                        <div className="max-h-48 overflow-y-auto p-1.5 space-y-0.5">
                                            <button type="button"
                                                onClick={() => { setCustomAccountId(''); setIsAccountOpen(false); }}
                                                className={cn("w-full text-left px-3 py-2 rounded-[5px] text-[12.5px] font-[500] transition-colors",
                                                    !customAccountId ? "bg-indigo-50 text-[#6366F1]" : "text-gray-700 hover:bg-gray-50")}>
                                                Standard auto-routing
                                            </button>
                                            {filteredAccounts.map(acc => (
                                                <button key={acc.id} type="button"
                                                    onClick={() => { setCustomAccountId(acc.id); setIsAccountOpen(false); setAccountSearch(''); }}
                                                    className={cn("w-full text-left px-3 py-2 rounded-[5px] transition-colors flex items-center justify-between",
                                                        customAccountId === acc.id ? "bg-indigo-50 text-[#6366F1]" : "text-gray-700 hover:bg-gray-50")}>
                                                    <div>
                                                        <p className="text-[12.5px] font-[500]">{acc.name}</p>
                                                        <p className="text-[11px] text-gray-400 font-mono mt-0.5">GL-{acc.code}</p>
                                                    </div>
                                                    {customAccountId === acc.id && <PiCheckCircle className="text-[#6366F1] text-[14px]" />}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Divider */}
                        <div style={{ borderTop: '1px solid rgba(0,0,0,0.07)' }} />

                        {/* Alert threshold */}
                        <div>
                            <div className="flex items-center justify-between mb-1.5">
                                <label className={LABEL_CLASS + ' mb-0'}>Warning Threshold</label>
                                <span className="text-[12.5px] font-[600] text-[#6366F1]">{alertThreshold}%</span>
                            </div>
                            <input type="range" min="50" max="100" step="5" value={alertThreshold}
                                onChange={e => setAlertThreshold(e.target.value)}
                                className="w-full h-[3px] rounded-full appearance-none cursor-pointer accent-[#6366F1] bg-gray-100" />
                            <p className="text-[11px] text-gray-400 mt-1.5">Alert fires when utilization crosses this threshold.</p>
                        </div>

                        {/* Rollover toggle */}
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-[13px] font-[500] text-gray-900">Rollover unused funds</p>
                                <p className="text-[11.5px] text-gray-400 mt-0.5">Carry unused allocation into the next period.</p>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer shrink-0">
                                <input type="checkbox" checked={rollover} onChange={e => setRollover(e.target.checked)} className="sr-only peer" />
                                <div className="w-9 h-5 bg-gray-200 rounded-full peer peer-checked:bg-[#6366F1] peer-focus:ring-2 peer-focus:ring-[#6366F1]/30 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-4" />
                            </label>
                        </div>
                    </div>
                </form>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 px-6 py-4 shrink-0"
                    style={{ borderTop: '1px solid rgba(0,0,0,0.07)' }}>
                    <button type="button" onClick={handleClose}
                        className="px-4 py-2 text-[12.5px] font-[500] text-gray-600 rounded-[6px] hover:bg-gray-50 transition-colors"
                        style={{ border: '1px solid rgba(0,0,0,0.09)' }}>
                        Cancel
                    </button>
                    <button type="submit" form="budget-form" disabled={isSubmitting || !category || !amount}
                        className="flex items-center gap-2 px-5 py-2 text-[12.5px] font-[600] text-white bg-[#6366F1] rounded-[6px] hover:bg-indigo-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                        {isSubmitting
                            ? <><PiSpinner className="animate-spin text-[14px]" /> Saving…</>
                            : <><PiCheckCircle className="text-[14px]" /> Create Rule</>
                        }
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}
