'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/ToastProvider';
import { AccountRow } from './AccountRow';
import { PiSpinner, PiCheckSquare, PiSquare, PiX, PiPencilSimple, PiFiles, PiTrendUp, PiTrendDown, PiWallet, PiCreditCard, PiBank } from 'react-icons/pi';
import { motion, AnimatePresence } from 'framer-motion';

const HAIRLINE = '1px solid rgba(0,0,0,0.07)';

const TYPE_META: Record<string, { label: string; description: string; accent: string; bg: string; icon: any }> = {
    ASSET:     { label: 'Assets',      description: 'Resources owned or controlled',    accent: '#059669', bg: 'rgba(5,150,105,0.06)',   icon: PiWallet     },
    LIABILITY: { label: 'Liabilities', description: 'Obligations owed to others',        accent: '#e11d48', bg: 'rgba(225,29,72,0.06)',   icon: PiCreditCard },
    EQUITY:    { label: 'Equity',      description: "Owner's interest in the business",  accent: '#6366F1', bg: 'rgba(99,102,241,0.06)',  icon: PiBank       },
    REVENUE:   { label: 'Revenue',     description: 'Income from business operations',   accent: '#0284c7', bg: 'rgba(2,132,199,0.06)',   icon: PiTrendUp    },
    EXPENSE:   { label: 'Expenses',    description: 'Costs incurred in operations',      accent: '#d97706', bg: 'rgba(217,119,6,0.06)',   icon: PiTrendDown  },
    DEFAULT:   { label: 'Other',       description: 'Miscellaneous accounts',            accent: '#6b7280', bg: 'rgba(107,114,128,0.06)', icon: PiFiles      },
};

export const SUBTYPE_SUGGESTIONS: Record<string, string[]> = {
    ASSET: [
        'Current Asset', 'Fixed Asset', 'Non-Current Asset',
        'Cash & Cash Equivalents', 'Bank Account',
        'Accounts Receivable', 'Inventory', 'Prepaid Expense',
        'Other Asset',
    ],
    LIABILITY: [
        'Current Liability', 'Long-term Liability',
        'Accounts Payable', 'Credit Card', 'Accrued Liability',
        'Deferred Revenue', 'Other Liability',
    ],
    EQUITY: [
        'Common Stock', 'Retained Earnings', "Owner's Equity",
        'Paid-in Capital', 'Other Equity',
    ],
    REVENUE: [
        'Sales Income', 'Service Revenue', 'Interest Income',
        'Other Income',
    ],
    EXPENSE: [
        'Operating Expense', 'Cost of Goods Sold', 'Payroll Expense',
        'Administrative Expense', 'Depreciation', 'Interest Expense',
        'Other Expense',
    ],
};

interface Account {
    id: string;
    code: string;
    name: string;
    type: string;
    subtype: string | null;
    isActive: boolean;
    isArchived: boolean;
}

interface Props {
    grouped: Record<string, Account[]>;
    typeOrder: string[];
}

export function AccountsTableClient({ grouped, typeOrder }: Props) {
    const router = useRouter();
    const { showToast } = useToast();
    const [selected, setSelected]     = useState<Set<string>>(new Set());
    const [bulkSubtype, setBulkSubtype] = useState('');
    const [saving, setSaving]          = useState(false);

    const toggle = useCallback((id: string) => {
        setSelected(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    }, []);

    const toggleGroup = (accounts: Account[]) => {
        const ids = accounts.map(a => a.id);
        const allSelected = ids.every(id => selected.has(id));
        setSelected(prev => {
            const next = new Set(prev);
            ids.forEach(id => allSelected ? next.delete(id) : next.add(id));
            return next;
        });
    };

    const clearSelection = () => setSelected(new Set());

    const applyBulk = async () => {
        if (!bulkSubtype.trim()) {
            showToast('Enter a subtype to apply', 'error');
            return;
        }
        setSaving(true);
        try {
            const res = await fetch('/api/accounting/accounts/bulk', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids: Array.from(selected), subtype: bulkSubtype.trim() }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            showToast(`Updated ${data.updated} account${data.updated !== 1 ? 's' : ''}`, 'success');
            clearSelection();
            setBulkSubtype('');
            router.refresh();
        } catch (err: any) {
            showToast(err.message || 'Failed to update', 'error');
        } finally {
            setSaving(false);
        }
    };

    // Collect all subtype suggestions from selected accounts' types
    const selectedTypes = new Set(
        typeOrder.flatMap(t => (grouped[t] || []).filter(a => selected.has(a.id)).map(a => a.type))
    );
    const bulkSuggestions = Array.from(
        new Set(Array.from(selectedTypes).flatMap(t => SUBTYPE_SUGGESTIONS[t] ?? []))
    );

    return (
        <>
            <div className="space-y-4">
                {typeOrder.map(type => {
                    const typeAccounts = grouped[type] || [];
                    if (typeAccounts.length === 0) return null;
                    const meta = TYPE_META[type] ?? TYPE_META.DEFAULT;
                    const Icon = meta.icon;
                    const allGroupSelected = typeAccounts.every(a => selected.has(a.id));
                    const someGroupSelected = typeAccounts.some(a => selected.has(a.id));

                    return (
                        <div key={type} className="bg-white rounded-[8px] overflow-hidden" style={{ border: HAIRLINE }}>
                            {/* Section header */}
                            <div className="flex items-center gap-3 px-5 py-3"
                                style={{ background: meta.bg, borderBottom: HAIRLINE }}>
                                <button
                                    onClick={() => toggleGroup(typeAccounts)}
                                    className="text-[16px] shrink-0 transition-colors"
                                    style={{ color: allGroupSelected ? meta.accent : someGroupSelected ? meta.accent : 'rgba(0,0,0,0.2)' }}
                                    title="Select all in group">
                                    {allGroupSelected
                                        ? <PiCheckSquare />
                                        : <PiSquare />}
                                </button>
                                <div className="w-[26px] h-[26px] rounded-[6px] flex items-center justify-center shrink-0"
                                    style={{ background: meta.accent }}>
                                    <Icon className="text-white text-[13px]" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-[12.5px] font-[600]" style={{ color: meta.accent }}>{meta.label}</p>
                                    <p className="text-[10.5px] text-gray-400">{meta.description}</p>
                                </div>
                                <span className="text-[10px] font-[700] tabular-nums px-2.5 py-0.5 rounded-full"
                                    style={{ background: meta.accent, color: 'white' }}>
                                    {typeAccounts.length}
                                </span>
                            </div>

                            {/* Column headers */}
                            <div className="grid px-5 py-2.5"
                                style={{ gridTemplateColumns: '32px 80px 1fr 180px 90px 72px', borderBottom: HAIRLINE, background: 'rgba(0,0,0,0.01)' }}>
                                <p />
                                <p className="text-[10px] font-[600] uppercase tracking-[0.08em] text-gray-400">Code</p>
                                <p className="text-[10px] font-[600] uppercase tracking-[0.08em] text-gray-400">Account Name</p>
                                <p className="text-[10px] font-[600] uppercase tracking-[0.08em] text-gray-400">Subtype</p>
                                <p className="text-[10px] font-[600] uppercase tracking-[0.08em] text-gray-400 text-center">Status</p>
                                <p />
                            </div>

                            {/* Rows */}
                            {typeAccounts.map((account, idx) => (
                                <AccountRow
                                    key={account.id}
                                    account={account}
                                    isLast={idx === typeAccounts.length - 1}
                                    isSelected={selected.has(account.id)}
                                    onToggle={() => toggle(account.id)}
                                />
                            ))}
                        </div>
                    );
                })}
            </div>

            {/* Bulk edit bar */}
            <AnimatePresence>
                {selected.size > 0 && (
                    <motion.div
                        initial={{ y: 80, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: 80, opacity: 0 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                        className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-5 py-3 bg-gray-900 text-white rounded-[12px] shadow-2xl"
                        style={{ minWidth: 480 }}>

                        {/* Count */}
                        <span className="text-[12px] font-[600] shrink-0 tabular-nums">
                            {selected.size} selected
                        </span>

                        <div className="w-px h-5 bg-white/20 shrink-0" />

                        {/* Subtype combo */}
                        <div className="relative flex-1">
                            <PiPencilSimple className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 text-[13px] pointer-events-none" />
                            <input
                                list="bulk-subtype-list"
                                value={bulkSubtype}
                                onChange={e => setBulkSubtype(e.target.value)}
                                placeholder="Type or pick subtype…"
                                className="w-full pl-8 pr-3 py-2 bg-white/10 text-white placeholder-white/30 text-[12.5px] rounded-[7px] outline-none focus:bg-white/15 transition-colors"
                            />
                            <datalist id="bulk-subtype-list">
                                {bulkSuggestions.map(s => <option key={s} value={s} />)}
                            </datalist>
                        </div>

                        {/* Apply */}
                        <button
                            onClick={applyBulk}
                            disabled={saving || !bulkSubtype.trim()}
                            className="flex items-center gap-1.5 px-4 py-2 bg-[#6366F1] hover:bg-indigo-500 disabled:opacity-40 text-white text-[12px] font-[600] rounded-[7px] transition-colors shrink-0">
                            {saving ? <PiSpinner className="animate-spin" /> : null}
                            Apply to all
                        </button>

                        {/* Clear */}
                        <button onClick={clearSelection}
                            className="p-1.5 rounded-[6px] text-white/50 hover:text-white hover:bg-white/10 transition-colors shrink-0">
                            <PiX className="text-[14px]" />
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}
