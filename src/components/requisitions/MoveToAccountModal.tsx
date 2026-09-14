"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { BiX } from "react-icons/bi";
import { PiWarning, PiCheck } from "react-icons/pi";
import { cn } from "@/lib/utils";
import { Select } from "@/components/ui/Select";
import { useToast } from "@/components/ui/ToastProvider";
import { useRouter } from "next/navigation";
import { reclassifyRequisitionAccount, getCostOfSalesAccounts } from "@/app/dashboard/requisitions/actions";

type Account = { id: string; code: string; name: string; type: string; subtype: string | null };

interface MoveToAccountModalProps {
    requisition: { id: string; title: string; accountId?: string | null; category?: string | null } | null;
    onClose: () => void;
}

export function MoveToAccountModal({ requisition, onClose }: MoveToAccountModalProps) {
    const { showToast } = useToast();
    const router = useRouter();
    const [mounted, setMounted] = useState(false);
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedAccountId, setSelectedAccountId] = useState("");
    const [saving, setSaving] = useState(false);
    const [costOfSalesAccounts, setCostOfSalesAccounts] = useState<Account[]>([]);
    const [loadingCostOfSales, setLoadingCostOfSales] = useState(false);

    useEffect(() => setMounted(true), []);

    useEffect(() => {
        if (!requisition) return;
        setSelectedAccountId("");
        setLoading(true);
        fetch("/api/accounting/accounts")
            .then(res => res.json())
            .then(data => setAccounts(Array.isArray(data) ? data : []))
            .catch(() => showToast("Failed to load accounts", "error"))
            .finally(() => setLoading(false));

        setLoadingCostOfSales(true);
        getCostOfSalesAccounts()
            .then(({ parent, children }) => setCostOfSalesAccounts([parent as Account, ...children as Account[]]))
            .catch(() => showToast("Failed to load Cost of Sales accounts", "error"))
            .finally(() => setLoadingCostOfSales(false));
    }, [requisition]);

    const groups = useMemo(() => {
        const byType = new Map<string, Account[]>();
        for (const acc of accounts) {
            const arr = byType.get(acc.type) || [];
            arr.push(acc);
            byType.set(acc.type, arr);
        }
        return [...byType.entries()].map(([type, accs]) => ({
            label: type.charAt(0) + type.slice(1).toLowerCase(),
            options: accs
                .sort((a, b) => a.code.localeCompare(b.code))
                .map(a => ({ value: a.id, label: `${a.code} — ${a.name}` })),
        }));
    }, [accounts]);

    const handleSave = async () => {
        if (!requisition || !selectedAccountId) return;
        setSaving(true);
        try {
            const result = await reclassifyRequisitionAccount(requisition.id, selectedAccountId);
            if (result.success) {
                showToast(result.message, "success");
                onClose();
                router.refresh();
            } else {
                showToast(result.message, "error");
            }
        } catch (err: any) {
            showToast(err.message || "Failed to move expense", "error");
        } finally {
            setSaving(false);
        }
    };

    if (!requisition || !mounted) return null;

    return createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-md animate-fade-in gpu-accel">
            <div className="bg-white max-w-md w-full rounded-xl shadow-2xl overflow-hidden animate-scale-in flex flex-col border border-gray-200">
                <div className="px-6 py-5 flex items-start justify-between border-b border-gray-100">
                    <div>
                        <h2 className="text-base font-semibold text-gray-900">Move to Account</h2>
                        <p className="text-xs text-gray-400 mt-1 line-clamp-1">{requisition.title}</p>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-900 transition-colors">
                        <BiX className="text-2xl" />
                    </button>
                </div>

                <div className="px-6 py-5 space-y-4">
                    <div className="flex items-start gap-2.5 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                        <PiWarning className="text-amber-600 text-base shrink-0 mt-0.5" />
                        <p className="text-xs text-amber-700 leading-relaxed">
                            If this expense has already been paid, moving it posts a correcting journal entry
                            (debiting the new account, crediting the old one) rather than editing the original entry.
                        </p>
                    </div>

                    <div>
                        <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-widest mb-1.5">Cost of Sales</label>
                        <div className="flex flex-wrap gap-1.5">
                            {loadingCostOfSales && costOfSalesAccounts.length === 0 && (
                                <span className="text-xs text-gray-400">Loading...</span>
                            )}
                            {costOfSalesAccounts.map(acc => {
                                const isSelected = selectedAccountId === acc.id;
                                return (
                                    <button
                                        key={acc.id}
                                        onClick={() => setSelectedAccountId(acc.id)}
                                        className={cn(
                                            "flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors",
                                            isSelected
                                                ? "border-[#6366F1] bg-[#6366F1]/10 text-[#6366F1]"
                                                : "border-gray-200 bg-white text-gray-600 hover:border-[#6366F1]/40 hover:bg-[#6366F1]/5"
                                        )}
                                    >
                                        {isSelected && <PiCheck />}
                                        {acc.name}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div className="flex items-center gap-3 text-[10px] uppercase tracking-widest text-gray-300 font-semibold">
                        <div className="h-px bg-gray-100 flex-1" /> or choose any account <div className="h-px bg-gray-100 flex-1" />
                    </div>

                    <div>
                        <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-widest mb-1.5">Target Account</label>
                        <Select
                            value={selectedAccountId}
                            onChange={setSelectedAccountId}
                            groups={groups}
                            placeholder={loading ? "Loading accounts..." : "Search accounts..."}
                            searchable
                        />
                    </div>
                </div>

                <div className="px-6 py-4 bg-white border-t border-gray-100 flex items-center justify-end gap-3">
                    <button onClick={onClose} className="px-4 py-2.5 rounded-md text-xs font-medium text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 transition-colors">
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={!selectedAccountId || saving}
                        className="px-5 py-2.5 rounded-md text-xs font-medium text-white bg-[#6366F1] hover:bg-[#6366F1]/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {saving ? "Moving..." : "Move"}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}
