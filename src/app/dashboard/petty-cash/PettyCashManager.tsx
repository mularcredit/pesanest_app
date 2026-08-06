"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import {
    PiPlus, PiX, PiArrowDown, PiArrowUp, PiScales,
    PiWallet, PiSlidersHorizontal, PiWarningCircle, PiReceipt, PiCheckCircle,
} from "react-icons/pi";
import {
    replenishPettyCash, recordPettyCashSpend, reconcilePettyCash, setFloatLimit,
} from "./actions";
import { useToast } from "@/components/ui/ToastProvider";

const CARD_STYLE: React.CSSProperties = { border: '1px solid rgba(0,0,0,0.09)' };
const ROW_BORDER: React.CSSProperties = { borderBottom: '1px solid rgba(0,0,0,0.06)' };
const INPUT_CLASS = "w-full rounded-[6px] px-3 py-[10px] text-[13px] text-gray-900 placeholder:text-gray-300 outline-none focus:ring-1 focus:ring-[#6366F1] transition-colors bg-white";
const INPUT_STYLE: React.CSSProperties = { border: '1px solid rgba(0,0,0,0.09)' };
const LABEL_CLASS = "block text-[11.5px] font-[500] text-gray-400 mb-1.5";

const TYPE_META: Record<string, { label: string; cls: string; border: string; sign: string }> = {
    REPLENISH:  { label: 'Replenish',  cls: 'text-emerald-600 bg-emerald-50', border: 'rgba(16,185,129,0.2)', sign: '+' },
    EXPENSE:    { label: 'Payout',     cls: 'text-rose-600 bg-rose-50',       border: 'rgba(239,68,68,0.2)',  sign: '−' },
    ADJUSTMENT: { label: 'Adjustment', cls: 'text-amber-600 bg-amber-50',     border: 'rgba(245,158,11,0.2)', sign: '±' },
    RETURN:     { label: 'Return',     cls: 'text-indigo-600 bg-indigo-50',   border: 'rgba(99,102,241,0.2)', sign: '+' },
};

type Mode = 'REPLENISH' | 'SPEND' | 'RECONCILE' | 'LIMIT' | null;

type LedgerRow = {
    id: string; type: string; amount: number; balanceAfter: number;
    description: string; voucherNumber: string | null; reference: string | null;
    occurredAt: string; createdAt: string; createdBy: string | null;
    isBackdated: boolean;
};

type PendingExpense = {
    id: string; title: string; amount: number; status: string;
    requester: string; voucherNumber: string | null; createdAt: string; isSettled: boolean;
};

type Stats = {
    balance: number; floatLimit: number; currency: string;
    spentThisMonth: number; replenishedThisMonth: number;
    utilisation: number; txCount: number; lowFloat: boolean;
};

const money = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function PettyCashManager({
    stats, ledger, pending, fundingSources, expenseAccounts, canManageLimit,
}: {
    stats: Stats;
    ledger: LedgerRow[];
    pending: PendingExpense[];
    fundingSources: { glAccountId: string; label: string }[];
    expenseAccounts: { id: string; label: string }[];
    canManageLimit: boolean;
}) {
    const router = useRouter();
    const { showToast } = useToast();
    const [mode, setMode] = useState<Mode>(null);
    const [tab, setTab] = useState<'LEDGER' | 'PENDING'>('LEDGER');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [mounted, setMounted] = useState(false);

    // form state
    const [amount, setAmount] = useState("");
    const [description, setDescription] = useState("");
    const [fundingGlAccountId, setFundingGlAccountId] = useState("");
    const [expenseGlAccountId, setExpenseGlAccountId] = useState("");
    const [requisitionId, setRequisitionId] = useState("");
    const [countedAmount, setCountedAmount] = useState("");
    const [floatLimitInput, setFloatLimitInput] = useState(String(stats.floatLimit || ""));

    // Local calendar day, not toISOString() — that shifts to UTC and can show
    // yesterday for anyone east of Greenwich.
    const isoDay = (d: Date) =>
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const todayIso = isoDay(new Date());
    const [occurredAt, setOccurredAt] = useState(todayIso);
    const isBackdatedEntry = !!occurredAt && occurredAt < todayIso;

    useEffect(() => setMounted(true), []);

    const openMode = (m: Mode, prefill?: Partial<PendingExpense>) => {
        setAmount(prefill?.amount ? String(prefill.amount) : "");
        setDescription(prefill?.title || "");
        setRequisitionId(prefill?.id || "");
        setFundingGlAccountId(fundingSources[0]?.glAccountId || "");
        setExpenseGlAccountId(expenseAccounts[0]?.id || "");
        setCountedAmount("");
        setFloatLimitInput(String(stats.floatLimit || ""));
        setOccurredAt(todayIso);
        setMode(m);
    };

    const close = () => { if (!isSubmitting) setMode(null); };

    const submit = async () => {
        setIsSubmitting(true);
        try {
            const fd = new FormData();
            let result: any;

            if (mode === 'REPLENISH') {
                fd.set("amount", amount);
                fd.set("description", description);
                fd.set("fundingGlAccountId", fundingGlAccountId);
                fd.set("occurredAt", occurredAt);
                result = await replenishPettyCash(fd);
            } else if (mode === 'SPEND') {
                fd.set("amount", amount);
                fd.set("description", description);
                fd.set("expenseGlAccountId", expenseGlAccountId);
                if (requisitionId) fd.set("requisitionId", requisitionId);
                result = await recordPettyCashSpend(fd);
            } else if (mode === 'RECONCILE') {
                fd.set("countedAmount", countedAmount);
                fd.set("description", description);
                result = await reconcilePettyCash(fd);
            } else if (mode === 'LIMIT') {
                fd.set("floatLimit", floatLimitInput);
                result = await setFloatLimit(fd);
            }

            if (result?.success) {
                showToast(
                    mode === 'LIMIT' ? "Float limit updated"
                        : `Recorded${result.voucher ? ` — voucher ${result.voucher}` : ""}`,
                    "success"
                );
                setMode(null);
                router.refresh();
            } else {
                showToast(result?.error || "Something went wrong", "error");
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    const canSubmit =
        mode === 'REPLENISH' ? Number(amount) > 0
        : mode === 'SPEND' ? Number(amount) > 0 && description.trim().length > 0
        : mode === 'RECONCILE' ? countedAmount !== "" && Number(countedAmount) >= 0
        : mode === 'LIMIT' ? Number(floatLimitInput) >= 0
        : false;

    const unsettled = pending.filter(p => !p.isSettled);

    const statCards = [
        { label: 'Float balance', value: `${stats.currency} ${money(stats.balance)}`, icon: PiWallet, tone: 'indigo' as const },
        { label: 'Float limit', value: stats.floatLimit > 0 ? `${stats.currency} ${money(stats.floatLimit)}` : 'Not set', icon: PiSlidersHorizontal, tone: 'gray' as const },
        { label: 'Paid out this month', value: `${stats.currency} ${money(stats.spentThisMonth)}`, icon: PiArrowUp, tone: 'rose' as const },
        { label: 'Replenished this month', value: `${stats.currency} ${money(stats.replenishedThisMonth)}`, icon: PiArrowDown, tone: 'emerald' as const },
    ];

    const toneCls: Record<string, string> = {
        indigo: 'text-[#6366F1] bg-indigo-50',
        rose: 'text-rose-500 bg-rose-50',
        emerald: 'text-emerald-600 bg-emerald-50',
        gray: 'text-gray-400 bg-gray-50',
    };

    const modalTitle =
        mode === 'REPLENISH' ? 'Replenish float'
        : mode === 'SPEND' ? 'Record a payout'
        : mode === 'RECONCILE' ? 'Reconcile float'
        : 'Set float limit';

    const modalSubtitle =
        mode === 'REPLENISH' ? 'Move cash from a bank or cash account into the tin'
        : mode === 'SPEND' ? 'Cash handed out against a receipt or voucher'
        : mode === 'RECONCILE' ? 'Enter what you physically counted — the difference posts to Cash Over & Short'
        : 'The imprest ceiling this float is topped back up to';

    const modal = mounted && mode ? createPortal(
        <div className="fixed inset-0 z-[9998] flex items-center justify-center p-4"
            style={{ background: 'rgba(15,23,42,0.35)', backdropFilter: 'blur(2px)' }}
            onClick={close}>
            <div className="w-full max-w-[460px] bg-white rounded-[10px] overflow-hidden"
                style={{ boxShadow: '0 20px 50px rgba(0,0,0,0.18)' }}
                onClick={e => e.stopPropagation()}>
                <div className="px-5 py-4 flex items-start justify-between" style={ROW_BORDER}>
                    <div>
                        <h2 className="text-[14px] font-[600] text-gray-900 leading-none">{modalTitle}</h2>
                        <p className="text-[12px] text-gray-400 mt-1">{modalSubtitle}</p>
                    </div>
                    <button onClick={close} className="p-1 text-gray-300 hover:text-gray-500 rounded-[5px] transition-colors">
                        <PiX className="text-[15px]" />
                    </button>
                </div>

                <div className="px-5 py-5 space-y-4">
                    {mode === 'RECONCILE' ? (
                        <>
                            <div className="rounded-[7px] px-3 py-2.5 bg-gray-50" style={CARD_STYLE}>
                                <p className="text-[11.5px] text-gray-400">Ledger says</p>
                                <p className="text-[15px] font-[600] text-gray-900 font-mono tabular-nums mt-0.5">
                                    {stats.currency} {money(stats.balance)}
                                </p>
                            </div>
                            <div>
                                <label className={LABEL_CLASS}>Amount counted</label>
                                <input type="number" step="0.01" min="0" value={countedAmount}
                                    onChange={e => setCountedAmount(e.target.value)}
                                    placeholder="0.00" className={INPUT_CLASS} style={INPUT_STYLE} />
                                {countedAmount !== "" && Number(countedAmount) !== stats.balance && (
                                    <p className={cn("text-[11.5px] mt-1.5 font-[500]",
                                        Number(countedAmount) < stats.balance ? "text-rose-500" : "text-emerald-600")}>
                                        {Number(countedAmount) < stats.balance ? "Shortage" : "Overage"} of {stats.currency}{" "}
                                        {money(Math.abs(Number(countedAmount) - stats.balance))}
                                    </p>
                                )}
                            </div>
                        </>
                    ) : mode === 'LIMIT' ? (
                        <div>
                            <label className={LABEL_CLASS}>Float limit ({stats.currency})</label>
                            <input type="number" step="0.01" min="0" value={floatLimitInput}
                                onChange={e => setFloatLimitInput(e.target.value)}
                                placeholder="e.g. 20000" className={INPUT_CLASS} style={INPUT_STYLE} />
                        </div>
                    ) : (
                        <>
                            <div>
                                <label className={LABEL_CLASS}>Amount ({stats.currency})</label>
                                <input type="number" step="0.01" min="0" value={amount}
                                    onChange={e => setAmount(e.target.value)}
                                    placeholder="0.00" className={INPUT_CLASS} style={INPUT_STYLE} />
                                {mode === 'SPEND' && Number(amount) > stats.balance && (
                                    <p className="text-[11.5px] text-rose-500 mt-1.5 font-[500]">
                                        Exceeds the {stats.currency} {money(stats.balance)} available
                                    </p>
                                )}
                            </div>

                            {mode === 'REPLENISH' && (
                                <>
                                    <div>
                                        <label className={LABEL_CLASS}>Funded from</label>
                                        <select value={fundingGlAccountId} onChange={e => setFundingGlAccountId(e.target.value)}
                                            className={INPUT_CLASS} style={INPUT_STYLE}>
                                            {fundingSources.length === 0 && <option value="">Cash on Hand (default)</option>}
                                            {fundingSources.map(f => (
                                                <option key={f.glAccountId} value={f.glAccountId}>{f.label}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div>
                                        <label className={LABEL_CLASS}>Date of replenishment</label>
                                        <input type="date" value={occurredAt} max={todayIso}
                                            onChange={e => setOccurredAt(e.target.value)}
                                            className={INPUT_CLASS} style={INPUT_STYLE} />
                                        {isBackdatedEntry && (
                                            <p className="text-[11.5px] text-amber-600 mt-1.5">
                                                Backdated — the ledger entry and journal post to{" "}
                                                {new Date(`${occurredAt}T12:00:00`).toLocaleDateString(undefined,
                                                    { day: 'numeric', month: 'long', year: 'numeric' })}.
                                            </p>
                                        )}
                                    </div>
                                </>
                            )}

                            {mode === 'SPEND' && (
                                <div>
                                    <label className={LABEL_CLASS}>Expense account</label>
                                    <select value={expenseGlAccountId} onChange={e => setExpenseGlAccountId(e.target.value)}
                                        className={INPUT_CLASS} style={INPUT_STYLE}>
                                        {expenseAccounts.map(a => (
                                            <option key={a.id} value={a.id}>{a.label}</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            <div>
                                <label className={LABEL_CLASS}>
                                    {mode === 'SPEND' ? 'What was it for?' : 'Note'}
                                    {mode === 'REPLENISH' && <span className="text-gray-300 font-[400]"> (optional)</span>}
                                </label>
                                <input type="text" value={description} onChange={e => setDescription(e.target.value)}
                                    placeholder={mode === 'SPEND' ? 'e.g. Taxi fare for bank errand' : 'e.g. Monthly top-up'}
                                    className={INPUT_CLASS} style={INPUT_STYLE} />
                            </div>

                            {mode === 'SPEND' && requisitionId && (
                                <div className="rounded-[7px] px-3 py-2 bg-indigo-50/60 flex items-center gap-2"
                                    style={{ border: '1px solid rgba(99,102,241,0.2)' }}>
                                    <PiReceipt className="text-[#6366F1] text-[13px] shrink-0" />
                                    <p className="text-[11.5px] text-gray-600">Linked to an approved expense — it will be stamped with this voucher number.</p>
                                </div>
                            )}
                        </>
                    )}
                </div>

                <div className="px-5 py-3.5 flex items-center justify-end gap-2 bg-gray-50/60" style={{ borderTop: '1px solid rgba(0,0,0,0.06)' }}>
                    <button onClick={close} disabled={isSubmitting}
                        className="px-3 py-[7px] rounded-[6px] text-[12.5px] font-[500] text-gray-500 hover:bg-gray-100 transition-colors disabled:opacity-50">
                        Cancel
                    </button>
                    <button onClick={submit} disabled={isSubmitting || !canSubmit}
                        className="px-3.5 py-[7px] rounded-[6px] text-[12.5px] font-[500] text-white bg-[#6366F1] hover:bg-[#5457E5] transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                        {isSubmitting ? 'Saving…' : mode === 'LIMIT' ? 'Save limit' : 'Record'}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    ) : null;

    return (
        <div className="space-y-5">
            {stats.lowFloat && (
                <div className="rounded-[8px] px-4 py-3 flex items-center gap-2.5 bg-amber-50/70"
                    style={{ border: '1px solid rgba(245,158,11,0.25)' }}>
                    <PiWarningCircle className="text-amber-500 text-[15px] shrink-0" />
                    <p className="text-[12.5px] text-gray-700">
                        The float is below 20% of its limit — time to replenish.
                    </p>
                    <button onClick={() => openMode('REPLENISH')}
                        className="ml-auto text-[12px] font-[500] text-amber-700 hover:underline shrink-0">
                        Replenish now
                    </button>
                </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {statCards.map(card => (
                    <div key={card.label} className="bg-white rounded-[8px] px-4 py-3.5" style={CARD_STYLE}>
                        <div className="flex items-center gap-2 mb-2">
                            <div className={cn("w-6 h-6 rounded-[5px] flex items-center justify-center", toneCls[card.tone])}>
                                <card.icon className="text-[12px]" />
                            </div>
                            <p className="text-[11.5px] text-gray-400 font-[500]">{card.label}</p>
                        </div>
                        <p className="text-[16px] font-[600] text-gray-900 font-mono tabular-nums">{card.value}</p>
                    </div>
                ))}
            </div>

            <div className="flex items-center gap-2 flex-wrap">
                <button onClick={() => openMode('REPLENISH')}
                    className="flex items-center gap-1.5 px-3 py-[7px] rounded-[6px] text-[12.5px] font-[500] text-white bg-[#6366F1] hover:bg-[#5457E5] transition-colors">
                    <PiPlus className="text-[12px]" /> Replenish float
                </button>
                <button onClick={() => openMode('SPEND')}
                    className="flex items-center gap-1.5 px-3 py-[7px] rounded-[6px] text-[12.5px] font-[500] text-gray-600 bg-white hover:bg-gray-50 transition-colors"
                    style={CARD_STYLE}>
                    <PiArrowUp className="text-[12px]" /> Record payout
                </button>
                <button onClick={() => openMode('RECONCILE')}
                    className="flex items-center gap-1.5 px-3 py-[7px] rounded-[6px] text-[12.5px] font-[500] text-gray-600 bg-white hover:bg-gray-50 transition-colors"
                    style={CARD_STYLE}>
                    <PiScales className="text-[12px]" /> Reconcile
                </button>
                {canManageLimit && (
                    <button onClick={() => openMode('LIMIT')}
                        className="flex items-center gap-1.5 px-3 py-[7px] rounded-[6px] text-[12.5px] font-[500] text-gray-500 hover:bg-gray-50 transition-colors ml-auto">
                        <PiSlidersHorizontal className="text-[12px]" /> Float limit
                    </button>
                )}
            </div>

            <div className="bg-white rounded-[9px] overflow-hidden" style={CARD_STYLE}>
                <div className="flex items-center gap-1 px-2 pt-2">
                    {([
                        { key: 'LEDGER' as const, label: `Ledger (${ledger.length})` },
                        { key: 'PENDING' as const, label: `Awaiting payout (${unsettled.length})` },
                    ]).map(t => (
                        <button key={t.key} onClick={() => setTab(t.key)}
                            className={cn("px-3 py-2 rounded-[6px] text-[12.5px] font-[500] transition-colors",
                                tab === t.key ? "text-[#6366F1] bg-indigo-50" : "text-gray-400 hover:text-gray-600")}>
                            {t.label}
                        </button>
                    ))}
                </div>

                {tab === 'LEDGER' ? (
                    ledger.length === 0 ? (
                        <EmptyState icon={PiWallet} title="No movements yet"
                            body="Replenish the float to start the ledger." />
                    ) : (
                        <div className="overflow-x-auto mt-2">
                            <table className="w-full">
                                <thead>
                                    <tr className="bg-gray-50/70" style={ROW_BORDER}>
                                        <Th>Date</Th><Th>Voucher</Th><Th>Description</Th><Th>Type</Th>
                                        <Th right>Amount</Th><Th right>Balance</Th><Th>By</Th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {ledger.map(row => {
                                        const meta = TYPE_META[row.type] || TYPE_META.ADJUSTMENT;
                                        return (
                                            <tr key={row.id} className="hover:bg-gray-50/50 transition-colors" style={ROW_BORDER}>
                                                <td className="px-5 py-3 text-[12.5px] text-gray-400 whitespace-nowrap">
                                                    {new Date(row.occurredAt).toLocaleDateString()}
                                                    {row.isBackdated && (
                                                        <span
                                                            className="ml-1.5 inline-flex px-1.5 py-[1px] rounded-[4px] text-[9.5px] font-[600] text-amber-600 bg-amber-50 align-middle"
                                                            style={{ border: '1px solid rgba(245,158,11,0.25)' }}
                                                            title={`Entered on ${new Date(row.createdAt).toLocaleDateString()}. The balance column shows the float at that point, not on the date shown.`}>
                                                            Backdated
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-5 py-3 text-[12px] font-mono text-gray-500">{row.voucherNumber || '—'}</td>
                                                <td className="px-5 py-3 text-[13px] text-gray-900 max-w-[280px] truncate" title={row.description}>
                                                    {row.description}
                                                </td>
                                                <td className="px-5 py-3">
                                                    <span className={cn("inline-flex px-2 py-[3px] rounded-[4px] text-[10.5px] font-[500]", meta.cls)}
                                                        style={{ border: `1px solid ${meta.border}` }}>
                                                        {meta.label}
                                                    </span>
                                                </td>
                                                <td className={cn("px-5 py-3 text-right font-mono text-[13px] tabular-nums font-[500]",
                                                    row.type === 'EXPENSE' ? "text-rose-600" : "text-emerald-600")}>
                                                    {meta.sign}{money(row.amount)}
                                                </td>
                                                <td className="px-5 py-3 text-right font-mono text-[13px] text-gray-900 tabular-nums">
                                                    {money(row.balanceAfter)}
                                                </td>
                                                <td className="px-5 py-3 text-[12px] text-gray-400 truncate max-w-[120px]">{row.createdBy || '—'}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )
                ) : (
                    pending.length === 0 ? (
                        <EmptyState icon={PiReceipt} title="Nothing awaiting payout"
                            body="Expenses submitted with Petty Cash as the payment method show up here." />
                    ) : (
                        <div className="overflow-x-auto mt-2">
                            <table className="w-full">
                                <thead>
                                    <tr className="bg-gray-50/70" style={ROW_BORDER}>
                                        <Th>Date</Th><Th>Expense</Th><Th>Requester</Th><Th>Status</Th>
                                        <Th right>Amount</Th><Th right>Action</Th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {pending.map(p => (
                                        <tr key={p.id} className="hover:bg-gray-50/50 transition-colors" style={ROW_BORDER}>
                                            <td className="px-5 py-3 text-[12.5px] text-gray-400 whitespace-nowrap">
                                                {new Date(p.createdAt).toLocaleDateString()}
                                            </td>
                                            <td className="px-5 py-3 text-[13px] text-gray-900 max-w-[240px] truncate" title={p.title}>{p.title}</td>
                                            <td className="px-5 py-3 text-[12.5px] text-gray-500">{p.requester}</td>
                                            <td className="px-5 py-3 text-[12px] text-gray-400">{p.status}</td>
                                            <td className="px-5 py-3 text-right font-mono text-[13px] text-gray-900 tabular-nums">{money(p.amount)}</td>
                                            <td className="px-5 py-3 text-right">
                                                {p.isSettled ? (
                                                    <span className="inline-flex items-center gap-1 text-[11.5px] text-emerald-600 font-[500]">
                                                        <PiCheckCircle className="text-[12px]" /> Paid {p.voucherNumber || ''}
                                                    </span>
                                                ) : (
                                                    <button onClick={() => openMode('SPEND', p)}
                                                        className="px-2.5 py-1.5 rounded-[5px] text-[11.5px] font-[500] text-[#6366F1] hover:bg-indigo-50 transition-colors"
                                                        style={{ border: '1px solid rgba(99,102,241,0.2)' }}>
                                                        Pay out
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )
                )}
            </div>

            {modal}
        </div>
    );
}

function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
    return (
        <th className={cn("px-5 py-2.5 text-[11px] font-[500] text-gray-400 uppercase tracking-wide",
            right ? "text-right" : "text-left")}>
            {children}
        </th>
    );
}

function EmptyState({ icon: Icon, title, body }: { icon: any; title: string; body: string }) {
    return (
        <div className="flex flex-col items-center justify-center py-14 gap-2.5">
            <div className="w-11 h-11 rounded-[9px] bg-gray-50 flex items-center justify-center" style={CARD_STYLE}>
                <Icon className="text-xl text-gray-300" />
            </div>
            <div className="text-center">
                <p className="text-[13.5px] font-[600] text-gray-900">{title}</p>
                <p className="text-[12.5px] text-gray-400 mt-0.5">{body}</p>
            </div>
        </div>
    );
}
