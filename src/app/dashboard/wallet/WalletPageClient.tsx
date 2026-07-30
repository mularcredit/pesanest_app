"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { BiHistory } from "react-icons/bi";
import { PiArrowsLeftRight } from "react-icons/pi";
import { WalletCard } from "@/components/dashboard/WalletCard";
import { TopUpButton } from "@/components/dashboard/TopUpButton";
import { VirtualTopUpButton } from "@/components/dashboard/VirtualTopUpButton";
import { BulkAllocateModal } from "@/components/dashboard/BulkAllocateModal";

export type LedgerRow = {
    id: string;
    createdAt: string;
    description: string;
    type: string;
    reference: string | null;
    amount: number;
    runningBalance: number;
};

type Props = {
    liveBalance: number;
    paystackBalance: number | null;
    dbBalance: number;
    currency: string;
    branches: { id: string; name: string }[];
    holderName: string;
    isAdmin: boolean;
    txLedger: LedgerRow[];
};

type Tab = "overview" | "transactions";

const HAIRLINE = '1px solid rgba(0,0,0,0.07)';
const CARD_STYLE: React.CSSProperties = { border: '1px solid rgba(0,0,0,0.09)' };

function fmtDate(d: string) {
    return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}
function fmtAmt(n: number) {
    return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2 }).format(Math.abs(n));
}

export function WalletPageClient({
    liveBalance, paystackBalance, dbBalance, currency, branches,
    holderName, isAdmin, txLedger,
}: Props) {
    const [tab, setTab] = useState<Tab>("overview");
    const [bulkOpen, setBulkOpen] = useState(false);

    const tabs: { id: Tab; label: string }[] = [
        { id: "overview", label: "Overview" },
        { id: "transactions", label: `Transactions${txLedger.length ? ` (${txLedger.length})` : ""}` },
    ];

    return (
        <div className="space-y-0 pb-24">
            {/* Page header */}
            <div className="pb-5 flex items-start justify-between gap-4">
                <div>
                    <h1 className="text-[20px] font-[600] text-gray-900 tracking-tight">Corporate Wallet</h1>
                    <p className="text-[12.5px] text-gray-400 mt-0.5">
                        {`${txLedger.length} ${txLedger.length === 1 ? 'transaction' : 'transactions'} · balance auto-synced`}
                    </p>
                </div>
                {branches.length > 0 && (
                    <button
                        onClick={() => setBulkOpen(true)}
                        className="flex items-center gap-2 px-4 py-2 rounded-[7px] text-[12.5px] font-[600] text-white bg-[#6366F1] hover:bg-[#5254cc] transition-colors shrink-0"
                    >
                        <PiArrowsLeftRight className="text-[14px]" />
                        Allocate to Branches
                    </button>
                )}
            </div>

            {/* Tab bar */}
            <div className="bg-white rounded-t-[8px] flex gap-0 border-b" style={{ borderColor: 'rgba(0,0,0,0.09)', borderLeft: '1px solid rgba(0,0,0,0.09)', borderRight: '1px solid rgba(0,0,0,0.09)', borderTop: '1px solid rgba(0,0,0,0.09)' }}>
                {tabs.map(t => (
                    <button
                        key={t.id}
                        onClick={() => setTab(t.id)}
                        className={`px-5 h-[44px] text-[13px] font-[500] transition-colors border-b-2 flex items-center whitespace-nowrap
                            ${tab === t.id
                                ? "text-[#6366F1] border-[#6366F1]"
                                : "text-gray-400 border-transparent hover:text-gray-700"
                            }`}
                    >
                        {t.label}
                    </button>
                ))}
                <div className="ml-auto flex items-center gap-2 px-4">
                    {isAdmin && <VirtualTopUpButton />}
                    <TopUpButton />
                </div>
            </div>

            {/* Tab content */}
            <div className="bg-white rounded-b-[8px] overflow-hidden" style={{ border: '1px solid rgba(0,0,0,0.09)', borderTop: 'none' }}>
                {tab === "overview" && (
                    <div className="p-6">
                        <div className="flex flex-col lg:flex-row gap-5 items-start">
                            {/* Wallet card */}
                            <div className="w-full lg:w-[400px] shrink-0">
                                <WalletCard
                                    balance={liveBalance}
                                    currency={currency === 'USD' ? 'KES' : currency}
                                        branches={branches}
                                    holderName={holderName}
                                    isPaystack={true}
                                />
                            </div>

                            {/* Summary KPIs */}
                            <div className="flex-1 min-w-0 space-y-4">
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    {(() => {
                                        const totalIn = txLedger.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);
                                        return [
                                            {
                                                label: "Paystack Balance",
                                                value: paystackBalance !== null ? `KES ${fmtAmt(paystackBalance)}` : `KES ${fmtAmt(liveBalance)}`,
                                                sub: paystackBalance !== null ? "Live · from Paystack" : "Paystack unavailable",
                                                color: "text-emerald-600",
                                            },
                                            { label: "Total Deposited", value: `KES ${fmtAmt(totalIn)}`, sub: "All-time top-ups", color: "text-[#6366F1]" },
                                            { label: "In-app Ledger", value: `KES ${fmtAmt(dbBalance)}`, sub: "Allocation balance", color: "text-gray-700" },
                                        ].map(k => (
                                            <div key={k.label} className="bg-white rounded-[8px] px-4 py-4" style={CARD_STYLE}>
                                                <p className="text-[10.5px] font-[500] uppercase tracking-[0.08em] text-gray-400 mb-1">{k.label}</p>
                                                <p className={`text-[18px] font-[700] tabular-nums ${k.color}`}>{k.value}</p>
                                                <p className="text-[11px] text-gray-400 mt-0.5">{k.sub}</p>
                                            </div>
                                        ));
                                    })()}
                                </div>

                                {/* Quick stats */}
                                <div className="flex overflow-hidden rounded-[8px] bg-white" style={{ border: '1px solid rgba(0,0,0,0.09)' }}>
                                    {(() => {
                                        const totalIn = txLedger.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);
                                        const totalOut = txLedger.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
                                        return [
                                            { label: "Total Credit", value: `KES ${fmtAmt(totalIn)}`, color: "text-emerald-600" },
                                            { label: "Total Debit", value: `KES ${fmtAmt(totalOut)}`, color: "text-rose-600" },
                                            { label: "Entries", value: txLedger.length.toString(), color: "text-gray-900" },
                                        ].map((k, i, arr) => (
                                            <div key={k.label} className="flex-1 px-4 py-3.5"
                                                style={i < arr.length - 1 ? { borderRight: HAIRLINE } : {}}>
                                                <p className="text-[10px] text-gray-400 uppercase tracking-[0.07em] font-[500] mb-0.5">{k.label}</p>
                                                <p className={`text-[14px] font-[600] tabular-nums ${k.color}`}>{k.value}</p>
                                            </div>
                                        ));
                                    })()}
                                </div>

                                {/* Recent 5 */}
                                {txLedger.length > 0 && (
                                    <div className="bg-white rounded-[8px] overflow-hidden" style={CARD_STYLE}>
                                        <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: HAIRLINE }}>
                                            <p className="text-[12.5px] font-[600] text-gray-900">Recent Activity</p>
                                            <button onClick={() => setTab("transactions")}
                                                className="text-[11.5px] text-[#6366F1] font-[500] hover:underline">
                                                View all →
                                            </button>
                                        </div>
                                        {txLedger.slice(0, 5).map((tx, i, arr) => {
                                            const isCredit = tx.amount > 0;
                                            return (
                                                <div key={tx.id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50/50 transition-colors"
                                                    style={i < arr.length - 1 ? { borderBottom: HAIRLINE } : {}}>
                                                    <div className={`w-[7px] h-[7px] rounded-full shrink-0 ${isCredit ? "bg-emerald-500" : "bg-rose-400"}`} />
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-[12.5px] font-[500] text-gray-900 truncate">{tx.description}</p>
                                                        <p className="text-[11px] text-gray-400">{fmtDate(tx.createdAt)} · {tx.type.replace(/_/g, ' ')}</p>
                                                    </div>
                                                    <p className={`text-[12.5px] font-[600] tabular-nums shrink-0 ${isCredit ? "text-emerald-600" : "text-rose-600"}`}>
                                                        {isCredit ? "+" : "−"}KES {fmtAmt(tx.amount)}
                                                    </p>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {tab === "transactions" && (
                    <LedgerTable rows={txLedger} currency={currency} />
                )}
            </div>

            <BulkAllocateModal
                open={bulkOpen}
                onClose={() => setBulkOpen(false)}
                onSuccess={() => window.location.reload()}
                corporateBalance={liveBalance}
                currency={currency}
                branches={branches}
            />
        </div>
    );
}

function SourceBadge({ reference, type }: { reference: string | null; type: string }) {
    if (reference?.startsWith('VTOPUP-')) {
        return (
            <span className="shrink-0 inline-flex items-center px-1.5 py-0.5 rounded-[4px] text-[9px] font-[700] uppercase tracking-[0.08em]"
                style={{ background: '#f0f0ff', color: '#6366f1' }}>
                Virtual
            </span>
        );
    }
    if (reference?.startsWith('TOPUP-') || type === 'DEPOSIT') {
        return (
            <span className="shrink-0 inline-flex items-center px-1.5 py-0.5 rounded-[4px] text-[9px] font-[700] uppercase tracking-[0.08em]"
                style={{ background: '#f0fdf4', color: '#16a34a' }}>
                Live
            </span>
        );
    }
    return null;
}

function LedgerTable({ rows, currency }: { rows: LedgerRow[]; currency: string }) {
    if (rows.length === 0) {
        return (
            <div className="py-16 flex flex-col items-center gap-2">
                <BiHistory className="text-gray-200 text-2xl" />
                <p className="text-[12.5px] text-gray-400">No transactions recorded yet.</p>
            </div>
        );
    }

    const totalDebit = rows.filter(r => r.amount < 0).reduce((s, r) => s + Math.abs(r.amount), 0);
    const totalCredit = rows.filter(r => r.amount > 0).reduce((s, r) => s + r.amount, 0);

    return (
        <div className="overflow-x-auto">
            <table className="w-full min-w-[660px]">
                <thead>
                    <tr style={{ borderBottom: '1px solid rgba(0,0,0,0.07)', background: 'rgba(0,0,0,0.015)' }}>
                        <th className="px-5 py-2.5 text-left text-[10px] font-[600] uppercase tracking-[0.08em] text-gray-400 whitespace-nowrap">Date</th>
                        <th className="px-5 py-2.5 text-left text-[10px] font-[600] uppercase tracking-[0.08em] text-gray-400">Particulars</th>
                        <th className="px-5 py-2.5 text-left text-[10px] font-[600] uppercase tracking-[0.08em] text-gray-400">Ref</th>
                        <th className="px-5 py-2.5 text-right text-[10px] font-[600] uppercase tracking-[0.08em] text-rose-500 whitespace-nowrap">Debit</th>
                        <th className="px-5 py-2.5 text-right text-[10px] font-[600] uppercase tracking-[0.08em] text-emerald-600 whitespace-nowrap">Credit</th>
                        <th className="px-5 py-2.5 text-right text-[10px] font-[600] uppercase tracking-[0.08em] text-gray-400 whitespace-nowrap">Balance</th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map((tx, i) => {
                        const isCredit = tx.amount > 0;
                        return (
                            <tr key={tx.id}
                                className="hover:bg-gray-50/50 transition-colors"
                                style={i < rows.length - 1 ? { borderBottom: '1px solid rgba(0,0,0,0.05)' } : {}}>
                                <td className="px-5 py-3 text-[11.5px] text-gray-400 font-mono whitespace-nowrap">
                                    {fmtDate(tx.createdAt)}
                                </td>
                                <td className="px-5 py-3 max-w-[240px]">
                                    <div className="flex items-center gap-1.5 mb-0.5">
                                        <p className="text-[12.5px] font-[500] text-gray-900 truncate">{tx.description}</p>
                                        <SourceBadge reference={tx.reference} type={tx.type} />
                                    </div>
                                    <p className="text-[10px] font-[500] text-gray-400 uppercase tracking-[0.05em]">
                                        {tx.type.replace(/_/g, ' ')}
                                    </p>
                                </td>
                                <td className="px-5 py-3 text-[11.5px] text-gray-400 font-mono max-w-[110px] truncate">
                                    {tx.reference || '—'}
                                </td>
                                <td className="px-5 py-3 text-right tabular-nums">
                                    {!isCredit
                                        ? <span className="text-[12.5px] font-[500] text-rose-600 font-mono">{currency} {fmtAmt(tx.amount)}</span>
                                        : <span className="text-[12px] text-gray-300">—</span>}
                                </td>
                                <td className="px-5 py-3 text-right tabular-nums">
                                    {isCredit
                                        ? <span className="text-[12.5px] font-[500] text-emerald-600 font-mono">{currency} {fmtAmt(tx.amount)}</span>
                                        : <span className="text-[12px] text-gray-300">—</span>}
                                </td>
                                <td className="px-5 py-3 text-right tabular-nums">
                                    <span className={cn(
                                        "text-[12.5px] font-[600] font-mono",
                                        tx.runningBalance >= 0 ? "text-gray-900" : "text-rose-600"
                                    )}>
                                        {currency} {new Intl.NumberFormat('en-US', { minimumFractionDigits: 2 }).format(tx.runningBalance)}
                                    </span>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
                <tfoot>
                    <tr style={{ borderTop: '2px solid rgba(0,0,0,0.08)', background: 'rgba(0,0,0,0.015)' }}>
                        <td colSpan={3} className="px-5 py-3 text-[11px] font-[600] uppercase tracking-[0.07em] text-gray-400">Totals</td>
                        <td className="px-5 py-3 text-right tabular-nums">
                            <span className="text-[12.5px] font-[700] text-rose-600 font-mono">{currency} {fmtAmt(totalDebit)}</span>
                        </td>
                        <td className="px-5 py-3 text-right tabular-nums">
                            <span className="text-[12.5px] font-[700] text-emerald-600 font-mono">{currency} {fmtAmt(totalCredit)}</span>
                        </td>
                        <td className="px-5 py-3 text-right tabular-nums">
                            <span className={cn(
                                "text-[12.5px] font-[700] font-mono",
                                rows[0]?.runningBalance >= 0 ? "text-gray-900" : "text-rose-600"
                            )}>
                                {currency} {new Intl.NumberFormat('en-US', { minimumFractionDigits: 2 }).format(rows[0]?.runningBalance ?? 0)}
                            </span>
                        </td>
                    </tr>
                </tfoot>
            </table>
        </div>
    );
}
