"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import {
    PiX, PiSpinner, PiCheckCircle, PiWarningCircle,
    PiBuildings, PiCurrencyDollar, PiTrash,
} from "react-icons/pi";

interface Branch {
    id: string;
    name: string;
}

interface AllocationRow {
    branchId: string;
    amount: string;
    description: string;
}

interface Props {
    open: boolean;
    onClose: () => void;
    onSuccess: () => void;
    corporateBalance: number;
    currency: string;
    branches: Branch[];
}

const HAIRLINE = '1px solid rgba(0,0,0,0.07)';

function fmtAmt(n: number) {
    return new Intl.NumberFormat("en-US", { minimumFractionDigits: 2 }).format(n);
}

export function BulkAllocateModal({
    open, onClose, onSuccess, corporateBalance, currency, branches,
}: Props) {
    const [search, setSearch] = useState("");
    const [rows, setRows] = useState<AllocationRow[]>([]);
    const [isPending, startTransition] = useTransition();
    const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
    const overlayRef = useRef<HTMLDivElement>(null);

    // Reset on open
    useEffect(() => {
        if (open) {
            setRows([]);
            setSearch("");
            setResult(null);
        }
    }, [open]);

    if (!open) return null;

    const filteredBranches = branches.filter(b =>
        b.name.toLowerCase().includes(search.toLowerCase())
    );

    const selectedIds = new Set(rows.map(r => r.branchId));

    function toggleBranch(b: Branch) {
        if (selectedIds.has(b.id)) {
            setRows(prev => prev.filter(r => r.branchId !== b.id));
        } else {
            setRows(prev => [...prev, {
                branchId: b.id,
                amount: "",
                description: "",
            }]);
        }
    }

    function updateRow(branchId: string, field: keyof AllocationRow, value: string) {
        setRows(prev => prev.map(r => r.branchId === branchId ? { ...r, [field]: value } : r));
    }

    function removeRow(branchId: string) {
        setRows(prev => prev.filter(r => r.branchId !== branchId));
    }

    const totalAllocating = rows.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
    const remaining = corporateBalance - totalAllocating;
    const isOverBudget = totalAllocating > corporateBalance;
    const hasValidRows = rows.length > 0 && rows.every(r => parseFloat(r.amount) > 0);

    function handleSubmit() {
        if (!hasValidRows || isOverBudget) return;
        setResult(null);

        const allocations = rows.map(r => ({
            branchId: r.branchId,
            amount: parseFloat(r.amount),
            description: r.description || undefined,
        }));

        startTransition(async () => {
            try {
                const res = await fetch("/api/wallet/allocate/bulk", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ allocations }),
                });
                const data = await res.json();
                if (data.success) {
                    setResult({ success: true, message: data.message });
                    setTimeout(() => {
                        onSuccess();
                        onClose();
                    }, 1400);
                } else {
                    setResult({ success: false, message: data.error || "Allocation failed" });
                }
            } catch {
                setResult({ success: false, message: "Network error. Please try again." });
            }
        });
    }

    return (
        <div
            ref={overlayRef}
            className="fixed inset-0 z-50 flex items-center justify-center"
            style={{ background: "rgba(0,0,0,0.45)" }}
            onClick={e => { if (e.target === overlayRef.current) onClose(); }}
        >
            <div
                className="bg-white rounded-[10px] flex flex-col overflow-hidden w-full"
                style={{
                    maxWidth: 780,
                    maxHeight: "90vh",
                    boxShadow: "0 20px 60px rgba(0,0,0,0.18)",
                    margin: "0 16px",
                }}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 shrink-0" style={{ borderBottom: HAIRLINE }}>
                    <div>
                        <h2 className="text-[15px] font-[600] text-gray-900">Bulk Fund Allocation</h2>
                        <p className="text-[12px] text-gray-400 mt-0.5">
                            Allocate funds to multiple branches in a single atomic transaction
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 rounded-[6px] flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors"
                    >
                        <PiX className="text-[16px]" />
                    </button>
                </div>

                {/* Body */}
                <div className="flex flex-1 min-h-0 overflow-hidden">
                    {/* Left: branch picker */}
                    <div className="w-[220px] shrink-0 flex flex-col" style={{ borderRight: HAIRLINE }}>
                        <div className="px-3 py-3 shrink-0" style={{ borderBottom: HAIRLINE }}>
                            <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-[6px] bg-gray-50" style={{ border: HAIRLINE }}>
                                <input
                                    type="text"
                                    placeholder="Search branches…"
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                    className="flex-1 text-[12px] bg-transparent outline-none text-gray-700 placeholder:text-gray-400 min-w-0"
                                />
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto py-1">
                            {filteredBranches.length === 0 && (
                                <p className="text-[11.5px] text-gray-400 text-center py-8">No branches found</p>
                            )}
                            {filteredBranches.map(b => {
                                const selected = selectedIds.has(b.id);
                                return (
                                    <button
                                        key={b.id}
                                        onClick={() => toggleBranch(b)}
                                        className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors
                                            ${selected ? "bg-indigo-50" : "hover:bg-gray-50"}`}
                                    >
                                        <div className={`w-[14px] h-[14px] rounded-[3px] shrink-0 flex items-center justify-center transition-colors
                                            ${selected ? "bg-[#6366F1]" : "bg-white"}`}
                                            style={{ border: selected ? "1px solid #6366F1" : "1px solid rgba(0,0,0,0.18)" }}
                                        >
                                            {selected && (
                                                <svg width="8" height="6" viewBox="0 0 8 6" fill="none">
                                                    <path d="M1 3L3 5L7 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                                </svg>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-1.5 min-w-0">
                                            <PiBuildings className={`text-[12px] shrink-0 ${selected ? "text-[#6366F1]" : "text-gray-400"}`} />
                                            <span className={`text-[12px] truncate leading-tight ${selected ? "text-[#6366F1] font-[500]" : "text-gray-700"}`}>
                                                {b.name}
                                            </span>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                        <div className="px-3 py-2.5 shrink-0" style={{ borderTop: HAIRLINE }}>
                            <p className="text-[10.5px] text-gray-400 text-center">
                                {selectedIds.size} of {branches.length} selected
                            </p>
                        </div>
                    </div>

                    {/* Right: allocation rows */}
                    <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
                        {/* Column headers */}
                        {rows.length > 0 && (
                            <div className="shrink-0 grid gap-2 px-4 py-2.5"
                                style={{ gridTemplateColumns: '1fr 130px 32px', borderBottom: HAIRLINE, background: 'rgba(0,0,0,0.015)' }}>
                                <p className="text-[10px] font-[600] uppercase tracking-[0.08em] text-gray-400">Branch</p>
                                <p className="text-[10px] font-[600] uppercase tracking-[0.08em] text-gray-400">Amount ({currency})</p>
                                <span />
                            </div>
                        )}

                        {/* Rows */}
                        <div className="flex-1 overflow-y-auto">
                            {rows.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-full gap-3 py-12">
                                    <div className="w-10 h-10 rounded-[8px] bg-indigo-50 flex items-center justify-center">
                                        <PiBuildings className="text-[#6366F1] text-[18px]" />
                                    </div>
                                    <p className="text-[12.5px] font-[500] text-gray-900">No branches selected</p>
                                    <p className="text-[11.5px] text-gray-400 text-center max-w-[200px]">
                                        Select branches from the list on the left to add them here
                                    </p>
                                </div>
                            ) : (
                                rows.map((row, i) => {
                                    const branch = branches.find(b => b.id === row.branchId);
                                    const amtNum = parseFloat(row.amount) || 0;
                                    const overBudgetRow = amtNum > 0 && rows.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0) > corporateBalance;
                                    return (
                                        <div
                                            key={row.branchId}
                                            className="grid items-center gap-2 px-4 py-3 hover:bg-gray-50/40 transition-colors"
                                            style={{
                                                gridTemplateColumns: '1fr 130px 32px',
                                                borderBottom: i < rows.length - 1 ? HAIRLINE : 'none',
                                            }}
                                        >
                                            {/* Branch name */}
                                            <div className="min-w-0">
                                                <p className="text-[12.5px] font-[500] text-gray-900 truncate">{branch?.name}</p>
                                            </div>

                                            {/* Amount */}
                                            <div>
                                                <div className="flex items-center overflow-hidden rounded-[5px]"
                                                    style={{ border: overBudgetRow && amtNum > 0 ? '1px solid rgba(239,68,68,0.4)' : HAIRLINE }}>
                                                    <span className="px-2 py-1.5 text-[11px] text-gray-400 bg-gray-50 border-r border-gray-100 font-mono shrink-0"
                                                        style={{ borderRight: HAIRLINE }}>
                                                        {currency}
                                                    </span>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        step="0.01"
                                                        value={row.amount}
                                                        onChange={e => updateRow(row.branchId, "amount", e.target.value)}
                                                        placeholder="0.00"
                                                        className="flex-1 px-2 py-1.5 text-[12.5px] font-[500] tabular-nums text-gray-900 outline-none bg-white w-0 min-w-0"
                                                    />
                                                </div>
                                            </div>

                                            {/* Remove */}
                                            <button
                                                onClick={() => removeRow(row.branchId)}
                                                className="w-7 h-7 flex items-center justify-center rounded-[5px] text-gray-300 hover:text-rose-500 hover:bg-rose-50 transition-colors"
                                            >
                                                <PiTrash className="text-[13px]" />
                                            </button>
                                        </div>
                                    );
                                })
                            )}
                        </div>

                        {/* Balance summary bar */}
                        <div className="shrink-0 px-4 py-3 flex items-center gap-4 flex-wrap"
                            style={{ borderTop: HAIRLINE, background: isOverBudget ? 'rgba(239,68,68,0.03)' : 'rgba(0,0,0,0.015)' }}>
                            <div className="flex items-center gap-1.5">
                                <PiCurrencyDollar className="text-gray-400 text-[13px]" />
                                <span className="text-[11px] text-gray-500">Corporate balance:</span>
                                <span className="text-[12px] font-[600] text-gray-900 tabular-nums font-mono">
                                    {currency} {fmtAmt(corporateBalance)}
                                </span>
                            </div>
                            <div className="h-3 w-px bg-gray-200 shrink-0" />
                            <div className="flex items-center gap-1.5">
                                <span className="text-[11px] text-gray-500">Allocating:</span>
                                <span className={`text-[12px] font-[600] tabular-nums font-mono ${isOverBudget ? "text-rose-600" : "text-[#6366F1]"}`}>
                                    {currency} {fmtAmt(totalAllocating)}
                                </span>
                            </div>
                            <div className="h-3 w-px bg-gray-200 shrink-0" />
                            <div className="flex items-center gap-1.5">
                                <span className="text-[11px] text-gray-500">Remaining:</span>
                                <span className={`text-[12px] font-[600] tabular-nums font-mono ${remaining < 0 ? "text-rose-600" : "text-emerald-600"}`}>
                                    {currency} {fmtAmt(remaining)}
                                </span>
                            </div>
                            {isOverBudget && (
                                <div className="flex items-center gap-1 text-rose-600">
                                    <PiWarningCircle className="text-[13px]" />
                                    <span className="text-[11px] font-[500]">Exceeds balance</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="shrink-0 px-6 py-4 flex items-center justify-between gap-4"
                    style={{ borderTop: HAIRLINE, background: 'rgba(0,0,0,0.015)' }}>
                    {result ? (
                        <div className={`flex items-center gap-2 text-[12.5px] font-[500] ${result.success ? "text-emerald-600" : "text-rose-600"}`}>
                            {result.success
                                ? <PiCheckCircle className="text-[15px]" />
                                : <PiWarningCircle className="text-[15px]" />
                            }
                            {result.message}
                        </div>
                    ) : (
                        <p className="text-[11.5px] text-gray-400">
                            {rows.length === 0
                                ? "Select branches and set amounts to proceed"
                                : `${rows.length} branch${rows.length > 1 ? "es" : ""} · ${currency} ${fmtAmt(totalAllocating)} total`
                            }
                        </p>
                    )}

                    <div className="flex items-center gap-2 shrink-0">
                        <button
                            onClick={onClose}
                            disabled={isPending}
                            className="px-4 py-2 rounded-[6px] text-[12.5px] font-[500] text-gray-600 bg-white hover:bg-gray-50 transition-colors disabled:opacity-50"
                            style={{ border: HAIRLINE }}
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSubmit}
                            disabled={isPending || !hasValidRows || isOverBudget || !!result?.success}
                            className="px-5 py-2 rounded-[6px] text-[12.5px] font-[600] text-white bg-[#6366F1] hover:bg-[#5254cc] transition-colors disabled:opacity-40 flex items-center gap-1.5"
                        >
                            {isPending
                                ? <><PiSpinner className="animate-spin text-[13px]" /> Processing…</>
                                : <>Allocate to {rows.length || "…"} {rows.length === 1 ? "Branch" : "Branches"}</>
                            }
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
