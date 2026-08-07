"use client";

import { useRouter } from "next/navigation";

interface Props {
    accounts: { id: string; name: string; bankName: string }[];
    value: string;
}

export function BankAccountPicker({ accounts, value }: Props) {
    const router = useRouter();

    return (
        <select
            value={value}
            onChange={e => router.push(`/dashboard/accounting/reconciliation?bankAccountId=${e.target.value}`)}
            className="rounded-[6px] px-3 py-[9px] text-[12.5px] text-gray-900 outline-none focus:ring-1 focus:ring-[#6366F1] bg-white transition-colors"
            style={{ border: '1px solid rgba(0,0,0,0.09)' }}
        >
            {accounts.map(a => (
                <option key={a.id} value={a.id}>{a.name} — {a.bankName}</option>
            ))}
        </select>
    );
}
