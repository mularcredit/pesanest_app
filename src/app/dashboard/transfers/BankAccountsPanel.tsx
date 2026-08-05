"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { PiBank, PiPlus, PiX, PiCheckCircle, PiProhibit, PiArrowClockwise } from "react-icons/pi";
import { createBankAccount, setBankAccountActive } from "./bank-actions";
import { useToast } from "@/components/ui/ToastProvider";

const CARD_STYLE: React.CSSProperties = { border: '1px solid rgba(0,0,0,0.09)' };
const ROW_BORDER: React.CSSProperties = { borderBottom: '1px solid rgba(0,0,0,0.06)' };
const INPUT_CLASS = "w-full rounded-[6px] px-3 py-[10px] text-[13px] text-gray-900 placeholder:text-gray-300 outline-none focus:ring-1 focus:ring-[#6366F1] transition-colors bg-white";
const INPUT_STYLE: React.CSSProperties = { border: '1px solid rgba(0,0,0,0.09)' };
const LABEL_CLASS = "block text-[11.5px] font-[500] text-gray-400 mb-1.5";

const CURRENCIES = ["KES", "USD", "EUR", "GBP", "UGX", "TZS"];

export type BankAccountRow = {
    id: string; name: string; bankName: string; accountNumber: string | null;
    currency: string; isActive: boolean;
    glCode: string | null; glName: string | null; transfersOut: number;
};

export function BankAccountsPanel({
    accounts, isAdmin, openOnMount = false,
}: {
    accounts: BankAccountRow[];
    isAdmin: boolean;
    openOnMount?: boolean;
}) {
    const router = useRouter();
    const { showToast } = useToast();
    const [isOpen, setIsOpen] = useState(openOnMount);
    const [mounted, setMounted] = useState(false);
    const [isAdding, setIsAdding] = useState(false);
    const [busyId, setBusyId] = useState<string | null>(null);

    const [name, setName] = useState("");
    const [bankName, setBankName] = useState("");
    const [accountNumber, setAccountNumber] = useState("");
    const [currency, setCurrency] = useState("KES");

    useEffect(() => setMounted(true), []);

    const activeCount = accounts.filter(a => a.isActive).length;

    const reset = () => { setName(""); setBankName(""); setAccountNumber(""); setCurrency("KES"); };
    const close = () => { if (!isAdding && !busyId) { setIsOpen(false); reset(); } };

    const add = async () => {
        setIsAdding(true);
        try {
            const fd = new FormData();
            fd.set("name", name);
            fd.set("bankName", bankName);
            fd.set("accountNumber", accountNumber);
            fd.set("currency", currency);
            const result = await createBankAccount(fd);
            if (result?.success) {
                showToast(
                    `${name} added${result.glCode ? ` — GL account ${result.glCode} created` : ""}`,
                    "success"
                );
                reset();
                router.refresh();
            } else {
                showToast(result?.error || "Could not add the account", "error");
            }
        } finally {
            setIsAdding(false);
        }
    };

    const toggle = async (row: BankAccountRow) => {
        setBusyId(row.id);
        try {
            const result = await setBankAccountActive(row.id, !row.isActive);
            if (result?.success) {
                showToast(row.isActive ? `${row.name} deactivated` : `${row.name} reactivated`, "success");
                router.refresh();
            } else {
                showToast(result?.error || "Could not update", "error");
            }
        } finally {
            setBusyId(null);
        }
    };

    const canAdd = name.trim().length > 0 && bankName.trim().length > 0;

    const modal = mounted && isOpen ? createPortal(
        <div className="fixed inset-0 z-[9998] flex items-center justify-center p-4"
            style={{ background: 'rgba(15,23,42,0.35)', backdropFilter: 'blur(2px)' }}
            onClick={close}>
            <div className="w-full max-w-[620px] max-h-[90vh] overflow-y-auto bg-white rounded-[10px]"
                style={{ boxShadow: '0 20px 50px rgba(0,0,0,0.18)' }}
                onClick={e => e.stopPropagation()}>

                <div className="px-5 py-4 flex items-start justify-between sticky top-0 bg-white z-10" style={ROW_BORDER}>
                    <div>
                        <h2 className="text-[14px] font-[600] text-gray-900 leading-none">Bank accounts</h2>
                        <p className="text-[12px] text-gray-400 mt-1">
                            Each account gets its own GL sub-account so transfers can post to the ledger.
                        </p>
                    </div>
                    <button onClick={close} className="p-1 text-gray-300 hover:text-gray-500 rounded-[5px] transition-colors shrink-0">
                        <PiX className="text-[15px]" />
                    </button>
                </div>

                {accounts.length > 0 && (
                    <div className="px-5 pt-4">
                        <div className="rounded-[8px] overflow-hidden" style={CARD_STYLE}>
                            <table className="w-full">
                                <thead>
                                    <tr className="bg-gray-50/70" style={ROW_BORDER}>
                                        <th className="px-3.5 py-2.5 text-left text-[11px] font-[500] text-gray-400 uppercase tracking-wide">Account</th>
                                        <th className="px-3.5 py-2.5 text-left text-[11px] font-[500] text-gray-400 uppercase tracking-wide">GL</th>
                                        <th className="px-3.5 py-2.5 text-left text-[11px] font-[500] text-gray-400 uppercase tracking-wide">Status</th>
                                        {isAdmin && <th className="px-3.5 py-2.5 text-right text-[11px] font-[500] text-gray-400 uppercase tracking-wide">Action</th>}
                                    </tr>
                                </thead>
                                <tbody>
                                    {accounts.map(a => (
                                        <tr key={a.id} className={cn("transition-colors", a.isActive ? "hover:bg-gray-50/50" : "opacity-55")} style={ROW_BORDER}>
                                            <td className="px-3.5 py-3">
                                                <p className="text-[12.5px] font-[500] text-gray-900">{a.name}</p>
                                                <p className="text-[11.5px] text-gray-400 mt-0.5">
                                                    {a.bankName}
                                                    {a.accountNumber ? ` · ${a.accountNumber}` : ''}
                                                    {` · ${a.currency}`}
                                                </p>
                                            </td>
                                            <td className="px-3.5 py-3">
                                                <span className="text-[12px] font-mono text-gray-600">{a.glCode || '—'}</span>
                                            </td>
                                            <td className="px-3.5 py-3">
                                                {a.isActive ? (
                                                    <span className="inline-flex items-center gap-1 text-[11.5px] text-emerald-600 font-[500]">
                                                        <PiCheckCircle className="text-[11px]" /> Active
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 text-[11.5px] text-gray-400 font-[500]">
                                                        <PiProhibit className="text-[11px]" /> Inactive
                                                    </span>
                                                )}
                                            </td>
                                            {isAdmin && (
                                                <td className="px-3.5 py-3 text-right">
                                                    <button onClick={() => toggle(a)} disabled={busyId === a.id}
                                                        className={cn(
                                                            "px-2.5 py-1.5 rounded-[5px] text-[11.5px] font-[500] transition-colors disabled:opacity-40",
                                                            a.isActive
                                                                ? "text-gray-500 hover:bg-gray-100"
                                                                : "text-[#6366F1] hover:bg-indigo-50"
                                                        )}>
                                                        {a.isActive ? 'Deactivate' : 'Reactivate'}
                                                    </button>
                                                </td>
                                            )}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        {accounts.some(a => !a.isActive) && (
                            <p className="text-[11px] text-gray-400 mt-2">
                                Inactive accounts stay on past transfers but can't be picked for new ones.
                            </p>
                        )}
                    </div>
                )}

                {isAdmin ? (
                    <div className="px-5 py-5 space-y-4">
                        <div className="flex items-center gap-2">
                            <PiPlus className="text-gray-300 text-[12px]" />
                            <h3 className="text-[12.5px] font-[600] text-gray-900">
                                {accounts.length === 0 ? 'Add your first bank account' : 'Add another account'}
                            </h3>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className={LABEL_CLASS}>Account name</label>
                                <input type="text" value={name} onChange={e => setName(e.target.value)}
                                    placeholder="e.g. Main Operating" className={INPUT_CLASS} style={INPUT_STYLE} />
                            </div>
                            <div>
                                <label className={LABEL_CLASS}>Bank</label>
                                <input type="text" value={bankName} onChange={e => setBankName(e.target.value)}
                                    placeholder="e.g. Equity Bank" className={INPUT_CLASS} style={INPUT_STYLE} />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className={LABEL_CLASS}>Account number <span className="text-gray-300 font-[400]">(optional)</span></label>
                                <input type="text" value={accountNumber} onChange={e => setAccountNumber(e.target.value)}
                                    placeholder="e.g. 0170123456789" className={INPUT_CLASS} style={INPUT_STYLE} />
                            </div>
                            <div>
                                <label className={LABEL_CLASS}>Currency</label>
                                <select value={currency} onChange={e => setCurrency(e.target.value)}
                                    className={INPUT_CLASS} style={INPUT_STYLE}>
                                    {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-1">
                            <button onClick={add} disabled={!canAdd || isAdding}
                                className="inline-flex items-center gap-1.5 px-3.5 py-[7px] rounded-[6px] text-[12.5px] font-[500] text-white bg-[#6366F1] hover:bg-[#5457E5] transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                                {isAdding ? <PiArrowClockwise className="text-[12px] animate-spin" /> : <PiPlus className="text-[12px]" />}
                                {isAdding ? 'Adding…' : 'Add account'}
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="px-5 py-6">
                        <p className="text-[12.5px] text-gray-400">
                            Only System Admins can add bank accounts. Ask an admin to set these up.
                        </p>
                    </div>
                )}
            </div>
        </div>,
        document.body
    ) : null;

    return (
        <>
            <button onClick={() => setIsOpen(true)}
                className="flex items-center gap-1.5 px-3 py-[7px] rounded-[6px] text-[12.5px] font-[500] text-gray-600 bg-white hover:bg-gray-50 transition-colors"
                style={CARD_STYLE}>
                <PiBank className="text-[12px]" />
                Bank accounts
                <span className={cn("ml-0.5 px-1.5 py-[1px] rounded-[4px] text-[10.5px] font-[600]",
                    activeCount === 0 ? "bg-amber-50 text-amber-600" : "bg-gray-100 text-gray-500")}>
                    {activeCount}
                </span>
            </button>
            {modal}
        </>
    );
}
