"use client";

import { useEffect, useState } from "react";

export interface SettlementAccount {
    id: string;
    kind: "BANK" | "PAYBILL" | "PAYSTACK";
    label: string;
    glAccountId: string | null;
}

interface SettlementAccountPickerProps {
    value: string; // the selected account's own id (BankAccount.id or PaybillAccount.id), or "" for none
    onChange: (account: SettlementAccount | null) => void;
    label?: string;
    required?: boolean;
    className?: string;
}

/**
 * "Which bank/paybill account did this actually settle through" — used
 * anywhere a payment/receipt/disposal needs to post its cash-side GL entry
 * to a real, reconcilable account instead of falling back to a generic,
 * unlinked one (see the Bank Reconciliation fix this pairs with).
 */
export function SettlementAccountPicker({ value, onChange, label = "Settlement Account", required, className }: SettlementAccountPickerProps) {
    const [accounts, setAccounts] = useState<SettlementAccount[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        fetch("/api/accounting/settlement-accounts")
            .then(res => res.json())
            .then(data => { if (!cancelled) setAccounts(data.accounts || []); })
            .catch(() => {})
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, []);

    return (
        <div className={className}>
            {label && <label className="block text-[11.5px] font-[500] text-gray-400 mb-1.5">{label}</label>}
            <select
                required={required}
                value={value}
                onChange={e => {
                    const acc = accounts.find(a => a.id === e.target.value) || null;
                    onChange(acc);
                }}
                disabled={loading}
                className="w-full rounded-[6px] px-3 py-[10px] text-[13px] text-gray-900 outline-none focus:ring-1 focus:ring-[#6366F1] transition-colors bg-white disabled:opacity-60"
                style={{ border: "1px solid rgba(0,0,0,0.09)" }}
            >
                <option value="">{loading ? "Loading accounts…" : "Select an account…"}</option>
                {accounts.map(a => (
                    <option key={a.id} value={a.id}>{a.label}</option>
                ))}
            </select>
        </div>
    );
}
