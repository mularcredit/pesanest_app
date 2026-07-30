"use client";

import { useState } from "react";
import { CustomSelect } from "@/components/ui/CustomSelect";

interface Account {
    id: string;
    code: string;
    name: string;
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
            <CustomSelect
                value={selectedCode}
                onChange={val => setSelectedCode(val)}
                options={accounts.map(acc => ({
                    value: acc.code,
                    label: `${acc.code} · ${acc.name}`,
                }))}
                placeholder="All Accounts"
                className="px-4 py-2.5 text-[12.5px] text-gray-600 bg-transparent outline-none"
            />
        </>
    );
}
