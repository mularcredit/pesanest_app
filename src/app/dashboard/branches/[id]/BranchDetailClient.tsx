"use client";

import Link from "next/link";
import { useState } from "react";
import {
    PiCaretLeft, PiBuildings, PiMapPin, PiEnvelopeSimple,
    PiPhone, PiBriefcase, PiArrowUpRight, PiArrowDownLeft,
    PiReceipt, PiStorefront, PiCheckCircle, PiXCircle,
    PiWallet, PiPencilSimple,
} from "react-icons/pi";

type Tx = {
    id: string;
    type: string;
    amount: number;
    currency: string;
    description: string;
    reference: string | null;
    createdAt: string;
};

type BranchData = {
    id: string;
    name: string;
    code: string;
    address: string | null;
    isActive: boolean;
    region: { id: string; name: string; code: string } | null;
    teamLeader: {
        id: string;
        name: string;
        email: string;
        phoneNumber: string | null;
        position: string | null;
        department: string | null;
        role: string;
        isActive: boolean;
    } | null;
    wallet: {
        id: string;
        balance: number;
        currency: string;
        transactions: Tx[];
    } | null;
    _count: { requisitions: number; vendors: number };
};

const HAIRLINE = '1px solid rgba(0,0,0,0.07)';

function InfoSection({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div>
            <p className="text-[9.5px] font-[500] uppercase tracking-[0.09em] text-gray-400 mb-2">{title}</p>
            <div className="space-y-1.5">{children}</div>
        </div>
    );
}

function InfoRow({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
    return (
        <div className="flex items-start gap-2">
            <span className="text-gray-400 flex-shrink-0 mt-[2px] text-[13px]">{icon}</span>
            <span className="text-[12px] text-gray-600 leading-snug">{children}</span>
        </div>
    );
}

function getInitials(name: string) {
    return name.split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

function formatDate(d: string) {
    return new Date(d).toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
}

function formatCurrency(amount: number, currency: string) {
    return `${currency} ${Math.abs(amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
}

type Tab = "overview" | "transactions" | "requisitions" | "vendors";

export function BranchDetailClient({ branch }: { branch: BranchData }) {
    const [activeTab, setActiveTab] = useState<Tab>("overview");

    const holder = branch.teamLeader;
    const wallet = branch.wallet;
    const txns = wallet?.transactions ?? [];

    const tabs: { id: Tab; label: string }[] = [
        { id: "overview", label: "Overview" },
        { id: "transactions", label: `Ledger${txns.length ? ` (${txns.length})` : ""}` },
        { id: "requisitions", label: `Expenses (${branch._count.requisitions})` },
        { id: "vendors", label: `Vendors (${branch._count.vendors})` },
    ];

    return (
        /* -mt-[22px] -mx-[26px] -mb-[52px] escapes the DashboardLayout main padding */
        <div className="-mt-[22px] -mx-[26px] -mb-[52px] flex flex-col" style={{ minHeight: 'calc(100vh - 64px)' }}>
            {/* Sub-header — sticky within the overflow-y-auto scroll container */}
            <div className="bg-white flex items-center px-8 h-[52px] shrink-0 gap-3 sticky top-0 z-10" style={{ borderBottom: HAIRLINE }}>
                <Link
                    href="/dashboard/branches"
                    className="flex items-center gap-1 text-[12.5px] text-gray-400 hover:text-gray-700 transition-colors"
                >
                    <PiCaretLeft className="text-[11px]" />
                    Branches
                </Link>
                <span className="text-gray-200">/</span>
                <span className="text-[13px] font-[500] text-gray-800 truncate max-w-[200px]">{branch.name}</span>

                <div className="ml-auto flex items-center gap-2">
                    <button
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] text-[12px] text-gray-600 bg-white hover:bg-gray-50 transition-colors"
                        style={{ border: HAIRLINE }}
                    >
                        <PiPencilSimple className="text-[13px]" />
                        Edit
                    </button>
                </div>
            </div>

            {/* Body */}
            <div className="flex flex-1">
                {/* LEFT PANEL — matches CRM: w-[300px] px-5 py-5 space-y-5 */}
                <aside className="w-[300px] shrink-0 bg-white overflow-y-auto px-5 py-5 space-y-5" style={{ borderRight: HAIRLINE }}>

                    {/* Avatar + name — centered, CRM style */}
                    <div className="flex flex-col items-center text-center gap-1.5">
                        <div className="w-[60px] h-[60px] rounded-full bg-[#6366F1] flex items-center justify-center text-white text-[20px] font-[600] flex-shrink-0">
                            {getInitials(branch.name)}
                        </div>
                        <div>
                            <h2 className="text-[15px] font-[600] text-gray-900 leading-tight">{branch.name}</h2>
                            <p className="text-[12px] text-gray-400 mt-0.5">
                                {branch.code}
                                {branch.region ? ` · ${branch.region.name}` : ""}
                            </p>
                        </div>
                        {branch.isActive ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-[500] bg-emerald-50 text-emerald-700">
                                <span className="w-[5px] h-[5px] rounded-full bg-emerald-500" />
                                Active
                            </span>
                        ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-[500] bg-rose-50 text-rose-600">
                                <span className="w-[5px] h-[5px] rounded-full bg-rose-400" />
                                Inactive
                            </span>
                        )}
                    </div>

                    <div className="border-t border-[rgba(0,0,0,0.07)]" />

                    {/* Wallet balance */}
                    {wallet && (
                        <>
                            <InfoSection title="Branch Wallet">
                                <div className="flex items-center gap-2 mt-1">
                                    <PiWallet className="text-[#6366F1] text-[15px] shrink-0" />
                                    <span className={`text-[17px] font-[700] leading-none ${wallet.balance >= 0 ? "text-gray-900" : "text-rose-600"}`}>
                                        {formatCurrency(wallet.balance, wallet.currency)}
                                    </span>
                                </div>
                                <p className="text-[11px] text-gray-400 mt-1">{txns.length} transaction{txns.length !== 1 ? "s" : ""}</p>
                            </InfoSection>
                            <div className="border-t border-[rgba(0,0,0,0.07)]" />
                        </>
                    )}

                    {/* Location */}
                    {(branch.region || branch.address) && (
                        <>
                            <InfoSection title="Location">
                                {branch.region && (
                                    <InfoRow icon={<PiBuildings />}>
                                        {branch.region.name} ({branch.region.code})
                                    </InfoRow>
                                )}
                                {branch.address && (
                                    <InfoRow icon={<PiMapPin />}>
                                        {branch.address}
                                    </InfoRow>
                                )}
                            </InfoSection>
                            <div className="border-t border-[rgba(0,0,0,0.07)]" />
                        </>
                    )}

                    {/* Team leader */}
                    {holder ? (
                        <>
                            <InfoSection title="Team Leader">
                                <div className="flex items-center gap-2 mb-2.5">
                                    <div className="w-[30px] h-[30px] rounded-full bg-indigo-50 flex items-center justify-center text-[10.5px] font-[700] text-[#6366F1] flex-shrink-0"
                                        style={{ border: '1px solid rgba(99,102,241,0.2)' }}>
                                        {getInitials(holder.name)}
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-[13px] font-[500] text-gray-900 truncate">{holder.name}</p>
                                        <span className="text-[9.5px] font-[500] text-[#6366F1]">
                                            {holder.role.replace(/_/g, " ")}
                                        </span>
                                    </div>
                                </div>
                                <InfoRow icon={<PiEnvelopeSimple />}>
                                    <a href={`mailto:${holder.email}`} className="hover:text-[#6366F1] hover:underline transition-colors">
                                        {holder.email}
                                    </a>
                                </InfoRow>
                                {holder.phoneNumber && (
                                    <InfoRow icon={<PiPhone />}>
                                        <a href={`tel:${holder.phoneNumber}`} className="hover:text-[#6366F1] hover:underline transition-colors">
                                            {holder.phoneNumber}
                                        </a>
                                    </InfoRow>
                                )}
                                {(holder.position || holder.department) && (
                                    <InfoRow icon={<PiBriefcase />}>
                                        {[holder.position, holder.department].filter(Boolean).join(" · ")}
                                    </InfoRow>
                                )}
                            </InfoSection>
                            <div className="border-t border-[rgba(0,0,0,0.07)]" />
                        </>
                    ) : (
                        <>
                            <InfoSection title="Team Leader">
                                <p className="text-[12px] text-gray-400 italic">No team leader assigned</p>
                            </InfoSection>
                            <div className="border-t border-[rgba(0,0,0,0.07)]" />
                        </>
                    )}

                    {/* Action buttons */}
                    <div className="space-y-2">
                        {holder?.email && (
                            <a href={`mailto:${holder.email}`}
                                className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-[6px] bg-sky-50 text-sky-700 border border-sky-100 text-[12.5px] font-[500] hover:bg-sky-100 transition-colors">
                                <PiEnvelopeSimple className="text-[13px]" />
                                Email Leader
                            </a>
                        )}
                        {holder?.phoneNumber && (
                            <a href={`tel:${holder.phoneNumber}`}
                                className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-[6px] bg-emerald-50 text-emerald-700 border border-emerald-100 text-[12.5px] font-[500] hover:bg-emerald-100 transition-colors">
                                <PiPhone className="text-[13px]" />
                                Call Leader
                            </a>
                        )}
                    </div>
                </aside>

                {/* Right panel */}
                <div className="flex-1 flex flex-col bg-[#FAFAFA]">
                    {/* Tab bar */}
                    <div className="bg-white px-6 flex gap-1 h-[44px] items-center" style={{ borderBottom: HAIRLINE }}>
                        {tabs.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`px-3 h-full text-[13px] font-[500] transition-colors border-b-2 flex items-center
                                    ${activeTab === tab.id
                                        ? "text-[#6366F1] border-[#6366F1]"
                                        : "text-gray-400 border-transparent hover:text-gray-700"
                                    }`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    {/* Tab content */}
                    <div className="flex-1 px-6 py-5">
                        {activeTab === "overview" && (
                            <OverviewTab wallet={wallet} txns={txns} branch={branch} />
                        )}
                        {activeTab === "transactions" && (
                            <TransactionsTab txns={txns} currency={wallet?.currency ?? "KES"} currentBalance={wallet?.balance ?? 0} />
                        )}
                        {activeTab === "requisitions" && (
                            <RequisitionsTab count={branch._count.requisitions} />
                        )}
                        {activeTab === "vendors" && (
                            <VendorsTab count={branch._count.vendors} />
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

/* ---------- Tab panels ---------- */

function OverviewTab({ wallet, txns, branch }: {
    wallet: BranchData["wallet"];
    txns: Tx[];
    branch: BranchData;
}) {
    const credits = txns.filter(t => t.amount > 0);
    const debits = txns.filter(t => t.amount < 0);
    const totalIn = credits.reduce((s, t) => s + t.amount, 0);
    const totalOut = debits.reduce((s, t) => s + Math.abs(t.amount), 0);
    const currency = wallet?.currency ?? "KES";
    const recent = txns.slice(0, 6);

    return (
        <div className="space-y-5">
            {/* KPI row */}
            <div className="flex overflow-hidden rounded-[8px] bg-white" style={{ border: HAIRLINE }}>
                {[
                    { label: "Balance", value: formatCurrency(wallet?.balance ?? 0, currency) },
                    { label: "Total In", value: formatCurrency(totalIn, currency), green: true },
                    { label: "Total Out", value: formatCurrency(totalOut, currency), red: true },
                    { label: "Transactions", value: txns.length.toString() },
                    { label: "Expenses", value: branch._count.requisitions.toString() },
                ].map((kpi, i, arr) => (
                    <div key={kpi.label}
                        className="flex-1 min-w-0 px-4 py-4 bg-white"
                        style={i < arr.length - 1 ? { borderRight: HAIRLINE } : {}}>
                        <p className="text-[11px] text-gray-400 mb-1">{kpi.label}</p>
                        <p className={`text-[14px] font-[500] text-gray-900 leading-snug truncate tabular-nums ${kpi.green ? "text-emerald-600" : kpi.red ? "text-rose-600" : ""}`}>
                            {kpi.value}
                        </p>
                    </div>
                ))}
            </div>

            {/* Recent transactions */}
            {recent.length > 0 ? (
                <div className="bg-white rounded-[8px] overflow-hidden" style={{ border: HAIRLINE }}>
                    <div className="px-5 py-3.5 flex items-center justify-between" style={{ borderBottom: HAIRLINE }}>
                        <h3 className="text-[12.5px] font-[600] text-gray-900">Recent Activity</h3>
                    </div>
                    {recent.map((tx, idx) => (
                        <TxRow key={tx.id} tx={tx} currency={currency} last={idx === recent.length - 1} />
                    ))}
                </div>
            ) : (
                <EmptyState icon={PiWallet} title="No transactions yet" sub="Wallet activity will appear here." />
            )}
        </div>
    );
}

function TransactionsTab({ txns, currency, currentBalance }: { txns: Tx[]; currency: string; currentBalance: number }) {
    if (txns.length === 0) {
        return <EmptyState icon={PiWallet} title="No transactions" sub="No wallet transactions recorded for this branch." />;
    }

    // txns are desc (newest first). Compute running balance per row.
    let bal = currentBalance;
    const ledger = txns.map(tx => {
        const balAfter = bal;
        bal -= tx.amount;
        return { ...tx, runningBalance: balAfter };
    });

    const totalDebit = txns.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
    const totalCredit = txns.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);

    return (
        <div className="space-y-4">
            {/* Summary strip */}
            <div className="flex overflow-hidden rounded-[8px] bg-white" style={{ border: HAIRLINE }}>
                {[
                    { label: "Total Credit", value: `${currency} ${totalCredit.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, green: true },
                    { label: "Total Debit", value: `${currency} ${totalDebit.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, red: true },
                    { label: "Net", value: `${currency} ${currentBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}` },
                    { label: "Entries", value: txns.length.toString() },
                ].map((k, i, arr) => (
                    <div key={k.label} className="flex-1 px-4 py-3.5"
                        style={i < arr.length - 1 ? { borderRight: HAIRLINE } : {}}>
                        <p className="text-[10px] font-[500] uppercase tracking-[0.08em] text-gray-400 mb-0.5">{k.label}</p>
                        <p className={`text-[13.5px] font-[700] tabular-nums ${k.green ? "text-emerald-600" : k.red ? "text-rose-600" : "text-gray-900"}`}>
                            {k.value}
                        </p>
                    </div>
                ))}
            </div>

            {/* Ledger table */}
            <div className="bg-white rounded-[8px] overflow-hidden" style={{ border: HAIRLINE }}>
                <div className="px-5 py-3.5" style={{ borderBottom: HAIRLINE }}>
                    <p className="text-[12.5px] font-[600] text-gray-900">Branch Wallet Ledger</p>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[580px]">
                        <thead>
                            <tr style={{ borderBottom: HAIRLINE, background: 'rgba(0,0,0,0.015)' }}>
                                <th className="px-4 py-2.5 text-left text-[10px] font-[600] uppercase tracking-[0.08em] text-gray-400 whitespace-nowrap">Date</th>
                                <th className="px-4 py-2.5 text-left text-[10px] font-[600] uppercase tracking-[0.08em] text-gray-400">Particulars</th>
                                <th className="px-4 py-2.5 text-left text-[10px] font-[600] uppercase tracking-[0.08em] text-gray-400">Ref</th>
                                <th className="px-4 py-2.5 text-right text-[10px] font-[600] uppercase tracking-[0.08em] text-rose-400 whitespace-nowrap">Debit</th>
                                <th className="px-4 py-2.5 text-right text-[10px] font-[600] uppercase tracking-[0.08em] text-emerald-600 whitespace-nowrap">Credit</th>
                                <th className="px-4 py-2.5 text-right text-[10px] font-[600] uppercase tracking-[0.08em] text-gray-400 whitespace-nowrap">Balance</th>
                            </tr>
                        </thead>
                        <tbody>
                            {ledger.map((tx, idx) => {
                                const isCredit = tx.amount > 0;
                                return (
                                    <tr key={tx.id}
                                        className="hover:bg-gray-50/60 transition-colors"
                                        style={idx < ledger.length - 1 ? { borderBottom: '1px solid rgba(0,0,0,0.05)' } : {}}>
                                        <td className="px-4 py-3 text-[11.5px] text-gray-400 font-mono whitespace-nowrap">
                                            {new Date(tx.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                                        </td>
                                        <td className="px-4 py-3 max-w-[180px]">
                                            <p className="text-[12.5px] font-[500] text-gray-900 truncate">{tx.description}</p>
                                            <p className="text-[10px] font-[500] text-gray-400 uppercase tracking-[0.05em] mt-0.5">{tx.type.replace(/_/g, ' ')}</p>
                                        </td>
                                        <td className="px-4 py-3 text-[11.5px] text-gray-400 font-mono max-w-[90px] truncate">
                                            {tx.reference || '—'}
                                        </td>
                                        <td className="px-4 py-3 text-right tabular-nums">
                                            {!isCredit ? (
                                                <span className="text-[12.5px] font-[500] text-rose-600 font-mono">
                                                    {currency} {Math.abs(tx.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                </span>
                                            ) : <span className="text-[12px] text-gray-200">—</span>}
                                        </td>
                                        <td className="px-4 py-3 text-right tabular-nums">
                                            {isCredit ? (
                                                <span className="text-[12.5px] font-[500] text-emerald-600 font-mono">
                                                    {currency} {tx.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                </span>
                                            ) : <span className="text-[12px] text-gray-200">—</span>}
                                        </td>
                                        <td className="px-4 py-3 text-right tabular-nums">
                                            <span className={`text-[12.5px] font-[600] font-mono ${tx.runningBalance >= 0 ? "text-gray-900" : "text-rose-600"}`}>
                                                {currency} {tx.runningBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                            </span>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                        <tfoot>
                            <tr style={{ borderTop: '2px solid rgba(0,0,0,0.08)', background: 'rgba(0,0,0,0.015)' }}>
                                <td colSpan={3} className="px-4 py-3 text-[11px] font-[600] uppercase tracking-[0.07em] text-gray-400">Totals</td>
                                <td className="px-4 py-3 text-right tabular-nums">
                                    <span className="text-[12.5px] font-[700] text-rose-600 font-mono">
                                        {currency} {totalDebit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                    </span>
                                </td>
                                <td className="px-4 py-3 text-right tabular-nums">
                                    <span className="text-[12.5px] font-[700] text-emerald-600 font-mono">
                                        {currency} {totalCredit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                    </span>
                                </td>
                                <td className="px-4 py-3 text-right tabular-nums">
                                    <span className={`text-[12.5px] font-[700] font-mono ${currentBalance >= 0 ? "text-gray-900" : "text-rose-600"}`}>
                                        {currency} {currentBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                    </span>
                                </td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>
        </div>
    );
}

function RequisitionsTab({ count }: { count: number }) {
    return (
        <div className="bg-white rounded-[8px] overflow-hidden" style={{ border: HAIRLINE }}>
            <div className="px-5 py-3.5" style={{ borderBottom: HAIRLINE }}>
                <p className="text-[12.5px] font-[600] text-gray-900">Expenses</p>
            </div>
            <div className="px-5 py-8 flex flex-col items-center text-center gap-3">
                <div className="w-10 h-10 rounded-[8px] bg-indigo-50 flex items-center justify-center"
                    style={{ border: '1px solid rgba(99,102,241,0.15)' }}>
                    <PiReceipt className="text-[#6366F1] text-[18px]" />
                </div>
                <div>
                    <p className="text-[13px] font-[600] text-gray-900">{count} Requisition{count !== 1 ? "s" : ""}</p>
                    <p className="text-[12px] text-gray-400 mt-0.5">Linked to this branch</p>
                </div>
                <Link
                    href="/dashboard/requisitions"
                    className="mt-1 px-4 py-2 rounded-[6px] text-[12px] font-[500] text-[#6366F1] bg-indigo-50 hover:bg-indigo-100 transition-colors"
                    style={{ border: '1px solid rgba(99,102,241,0.15)' }}
                >
                    View Expenses
                </Link>
            </div>
        </div>
    );
}

function VendorsTab({ count }: { count: number }) {
    return (
        <div className="bg-white rounded-[8px] overflow-hidden" style={{ border: HAIRLINE }}>
            <div className="px-5 py-3.5" style={{ borderBottom: HAIRLINE }}>
                <p className="text-[12.5px] font-[600] text-gray-900">Vendors</p>
            </div>
            <div className="px-5 py-8 flex flex-col items-center text-center gap-3">
                <div className="w-10 h-10 rounded-[8px] bg-indigo-50 flex items-center justify-center"
                    style={{ border: '1px solid rgba(99,102,241,0.15)' }}>
                    <PiStorefront className="text-[#6366F1] text-[18px]" />
                </div>
                <div>
                    <p className="text-[13px] font-[600] text-gray-900">{count} Vendor{count !== 1 ? "s" : ""}</p>
                    <p className="text-[12px] text-gray-400 mt-0.5">Associated with this branch</p>
                </div>
                <Link
                    href="/dashboard/vendors"
                    className="mt-1 px-4 py-2 rounded-[6px] text-[12px] font-[500] text-[#6366F1] bg-indigo-50 hover:bg-indigo-100 transition-colors"
                    style={{ border: '1px solid rgba(99,102,241,0.15)' }}
                >
                    View Vendors
                </Link>
            </div>
        </div>
    );
}

/* ---------- Shared primitives ---------- */

function TxRow({ tx, currency, last }: { tx: Tx; currency: string; last: boolean }) {
    const isCredit = tx.amount > 0;
    return (
        <div
            className="flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50 transition-colors"
            style={!last ? { borderBottom: HAIRLINE } : {}}
        >
            <div className={`w-[30px] h-[30px] rounded-full flex items-center justify-center flex-shrink-0 ${isCredit ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-500"}`}>
                {isCredit ? <PiArrowDownLeft className="text-[13px]" /> : <PiArrowUpRight className="text-[13px]" />}
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-[12.5px] font-[500] text-gray-900 truncate">{tx.description}</p>
                <p className="text-[11px] text-gray-400 mt-0.5">
                    {tx.type} · {formatDate(tx.createdAt)}
                    {tx.reference ? ` · ${tx.reference}` : ""}
                </p>
            </div>
            <p className={`text-[13px] font-[500] flex-shrink-0 tabular-nums ${isCredit ? "text-emerald-600" : "text-rose-500"}`}>
                {isCredit ? "+" : "−"}{formatCurrency(tx.amount, currency)}
            </p>
        </div>
    );
}

function EmptyState({ icon: Icon, title, sub }: { icon: React.ElementType; title: string; sub: string }) {
    return (
        <div className="bg-white rounded-[8px] flex flex-col items-center justify-center py-16 gap-3" style={{ border: HAIRLINE }}>
            <div className="w-10 h-10 rounded-[8px] bg-gray-50 flex items-center justify-center" style={{ border: HAIRLINE }}>
                <Icon className="text-gray-300 text-[18px]" />
            </div>
            <div className="text-center">
                <p className="text-[13px] font-[500] text-gray-500">{title}</p>
                <p className="text-[12px] text-gray-400 mt-0.5">{sub}</p>
            </div>
        </div>
    );
}
