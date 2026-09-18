"use client";

import { useState } from "react";
import { Select } from "@/components/ui/Select";

interface Account {
    id: string;
    code: string;
    name: string;
    bankLabel?: string | null;
}

interface LedgerAccountSelectProps {
    accounts: Account[];
    defaultValue: string;
}

export function LedgerAccountSelect({ accounts, defaultValue }: LedgerAccountSelectProps) {
    const [selectedCode, setSelectedCode] = useState(defaultValue);

    return (
        <>
            <input type="hidden" name="code" value={selectedCode} />
            <Select
                value={selectedCode}
                onChange={val => setSelectedCode(val)}
                options={accounts.map(acc => ({
                    value: acc.code,
                    label: `${acc.code} · ${acc.name}${acc.bankLabel ? ` (${acc.bankLabel})` : ''}`,
                }))}
                placeholder="All Accounts"
                searchable
                className="px-4 py-2.5 text-[12.5px] text-gray-600 bg-transparent outline-none border-0 rounded-none hover:!border-0"
            />
        </>
    );
}
