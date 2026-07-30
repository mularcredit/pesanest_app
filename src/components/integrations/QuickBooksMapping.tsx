
"use client";

import { useState, useEffect } from "react";
import { PiArrowsClockwise, PiCheck, PiTranslate, PiMagnifyingGlass, PiWarning } from "react-icons/pi";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/ToastProvider";
import { CustomSelect } from "@/components/ui/CustomSelect";

interface Account {
    id: string;
    code: string;
    name: string;
    type: string;
    qboId?: string | null;
}

interface QboAccount {
    Id: string;
    Name: string;
    AccountType: string;
    AcctNum?: string;
}

export default function QuickBooksMapping() {
    const { showToast } = useToast();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [qboAccounts, setQboAccounts] = useState<QboAccount[]>([]);
    const [mapping, setMapping] = useState<Record<string, string>>({});
    const [search, setSearch] = useState("");

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const res = await fetch('/api/integrations/qbo/accounts');
            const data = await res.json();
            if (data.error) throw new Error(data.error);

            setAccounts(data.internalAccounts);
            setQboAccounts(data.qboAccounts);
            
            // Initialize mapping
            const initialMapping: Record<string, string> = {};
            data.internalAccounts.forEach((acc: Account) => {
                if (acc.qboId) initialMapping[acc.id] = acc.qboId;
            });
            setMapping(initialMapping);
        } catch (error: any) {
            showToast(error.message, "error");
        } finally {
            setLoading(false);
        }
    };

    const handleMappingChange = (internalId: string, qboId: string) => {
        setMapping(prev => ({ ...prev, [internalId]: qboId }));
    };

    const autoLink = () => {
        const newMapping = { ...mapping };
        let count = 0;

        accounts.forEach(acc => {
            if (!newMapping[acc.id]) {
                // Try to find a QBO account with a similar name or matching code/number
                const match = qboAccounts.find(q => 
                    q.Name.toLowerCase() === acc.name.toLowerCase() ||
                    q.AcctNum === acc.code
                );

                if (match) {
                    newMapping[acc.id] = match.Id;
                    count++;
                }
            }
        });

        setMapping(newMapping);
        showToast(`Automatically matched ${count} accounts`, "success");
    };

    const saveMapping = async () => {
        setSaving(true);
        try {
            const res = await fetch('/api/integrations/qbo/accounts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ mapping })
            });
            if (res.ok) {
                showToast("Mapping saved successfully", "success");
            } else {
                throw new Error("Failed to save mapping");
            }
        } catch (error: any) {
            showToast(error.message, "error");
        } finally {
            setSaving(false);
        }
    };

    const filteredAccounts = accounts.filter(acc => 
        acc.name.toLowerCase().includes(search.toLowerCase()) || 
        acc.code.includes(search)
    );

    if (loading) return (
        <div className="flex flex-col items-center justify-center py-20 space-y-4">
            <PiArrowsClockwise className="animate-spin text-4xl text-[#5e48b8]" />
            <p className="text-sm text-gray-500 font-medium">Fetching Chart of Accounts...</p>
        </div>
    );

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex items-center justify-between">
                <div className="flex-1 max-w-sm">
                    <input
                        type="text"
                        placeholder="Search accounts..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="w-full pl-3 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:border-[#5e48b8] transition-all"
                    />
                </div>
                <div className="flex gap-3">
                    <Button 
                        variant="outline" 
                        onClick={autoLink}
                        className="border-indigo-200 text-[#5e48b8] hover:bg-indigo-50 rounded-xl"
                    >
                        <PiTranslate className="mr-2" />
                        Auto-Link Matches
                    </Button>
                    <Button 
                        onClick={saveMapping}
                        disabled={saving}
                        className="bg-[#5e48b8] hover:bg-[#4c3a9e] text-white rounded-xl shadow-lg shadow-[#5e48b8]/20"
                    >
                        {saving ? <PiArrowsClockwise className="animate-spin mr-2" /> : <PiCheck className="mr-2" />}
                        Save Mapping
                    </Button>
                </div>
            </div>

            <div className="gds-glass p-0 overflow-hidden border border-gray-100 shadow-xl shadow-slate-200/50">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-gray-50/50 border-b border-gray-100">
                            <th className="px-6 py-4 text-[11px] font-bold text-gray-400 uppercase tracking-widest">Internal Account (Pesanest)</th>
                            <th className="px-6 py-4 text-[11px] font-bold text-gray-400 uppercase tracking-widest text-center">Status</th>
                            <th className="px-6 py-4 text-[11px] font-bold text-gray-400 uppercase tracking-widest">QuickBooks Account</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {filteredAccounts.map(acc => (
                            <tr key={acc.id} className="hover:bg-gray-50/30 transition-colors group">
                                <td className="px-6 py-4">
                                    <div className="font-bold text-gray-900">{acc.name}</div>
                                    <div className="text-[10px] font-bold text-[#5e48b8] uppercase tracking-wider mt-0.5">{acc.code} &bull; {acc.type}</div>
                                </td>
                                <td className="px-6 py-4 text-center">
                                    {mapping[acc.id] ? (
                                        <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 text-[10px] font-bold uppercase border border-emerald-100">
                                            <PiCheck /> Linked
                                        </div>
                                    ) : (
                                        <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 text-[10px] font-bold uppercase border border-amber-100">
                                            <PiWarning /> Pending
                                        </div>
                                    )}
                                </td>
                                <td className="px-6 py-4">
                                    <CustomSelect
                                        value={mapping[acc.id] || ""}
                                        onChange={val => handleMappingChange(acc.id, val)}
                                        options={qboAccounts.map(q => ({ value: q.Id, label: `${q.Name} (${q.AccountType})` }))}
                                        placeholder="-- Select QBO Account --"
                                        className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2 text-sm font-semibold text-gray-900 outline-none focus:border-[#5e48b8] transition-all"
                                    />
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
