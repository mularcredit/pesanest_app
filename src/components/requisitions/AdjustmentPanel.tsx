"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PiWarning, PiArrowCounterClockwise, PiSpinner, PiCheckCircle } from "react-icons/pi";
import { updateRequisition } from "@/app/dashboard/requisitions/actions";

interface AdjustmentComment {
    approverName: string;
    approverRole: string;
    comments: string;
    approvedAt?: string;
}

interface Props {
    requisitionId: string;
    currentAmount: number;
    currency: string;
    currentTitle: string;
    currentDescription: string;
    adjustmentComment: AdjustmentComment;
}

const HAIRLINE = '1px solid rgba(0,0,0,0.07)';

export function AdjustmentPanel({
    requisitionId,
    currentAmount,
    currency,
    currentTitle,
    currentDescription,
    adjustmentComment,
}: Props) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [amount, setAmount] = useState(currentAmount.toString());
    const [notes, setNotes] = useState("");
    const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

    async function handleResubmit(e: React.FormEvent) {
        e.preventDefault();
        setResult(null);

        const fd = new FormData();
        fd.append("id", requisitionId);
        fd.append("title", currentTitle);
        fd.append("description", notes.trim() || currentDescription);
        fd.append("amount", amount);
        fd.append("currency", currency);

        startTransition(async () => {
            const res = await updateRequisition(fd);
            setResult(res);
            if (res.success) {
                setTimeout(() => router.refresh(), 1200);
            }
        });
    }

    return (
        <div className="rounded-[8px] overflow-hidden" style={{ border: '1px solid rgba(245,158,11,0.35)' }}>
            {/* Header */}
            <div className="flex items-start gap-3 px-5 py-4 bg-amber-50">
                <div className="w-8 h-8 rounded-[7px] bg-amber-100 flex items-center justify-center shrink-0 mt-0.5">
                    <PiWarning className="text-amber-600 text-[16px]" />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-[600] text-amber-900">Adjustment Required</p>
                    <p className="text-[12px] text-amber-700 mt-0.5">
                        {adjustmentComment.approverName} ({adjustmentComment.approverRole.replace(/_/g, " ")}) has
                        sent this back with changes needed.
                        {adjustmentComment.approvedAt && (
                            <span className="ml-1 font-mono text-[11px] text-amber-600">
                                · {new Date(adjustmentComment.approvedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                            </span>
                        )}
                    </p>
                </div>
            </div>

            {/* Approver comments */}
            {adjustmentComment.comments && (
                <div className="px-5 py-4 bg-white" style={{ borderTop: '1px solid rgba(245,158,11,0.2)' }}>
                    <p className="text-[10px] font-[600] uppercase tracking-[0.08em] text-amber-500 mb-1.5">
                        Reviewer&apos;s notes
                    </p>
                    <p className="text-[13px] text-gray-700 leading-relaxed italic">
                        &ldquo;{adjustmentComment.comments}&rdquo;
                    </p>
                </div>
            )}

            {/* Edit & Resubmit form */}
            <form onSubmit={handleResubmit} className="bg-white" style={{ borderTop: HAIRLINE }}>
                <div className="px-5 py-4 space-y-3">
                    <p className="text-[11px] font-[600] uppercase tracking-[0.08em] text-gray-400">
                        Update &amp; Resubmit
                    </p>

                    {/* Amount field */}
                    <div>
                        <label className="block text-[11.5px] font-[500] text-gray-500 mb-1">
                            Amount ({currency})
                        </label>
                        <div className="flex items-center gap-0 rounded-[6px] overflow-hidden" style={{ border: HAIRLINE }}>
                            <span className="px-3 py-2 text-[12px] text-gray-400 bg-gray-50 border-r border-gray-100 font-mono">
                                {currency}
                            </span>
                            <input
                                type="number"
                                value={amount}
                                onChange={e => setAmount(e.target.value)}
                                step="0.01"
                                min="0"
                                required
                                className="flex-1 px-3 py-2 text-[13px] font-[500] text-gray-900 tabular-nums outline-none bg-white focus:ring-2 focus:ring-amber-200 transition-all"
                                placeholder="0.00"
                            />
                        </div>
                        {parseFloat(amount) !== currentAmount && (
                            <p className="text-[11px] text-amber-600 mt-1">
                                Original: {currency} {currentAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                {" → "}
                                New: {currency} {(parseFloat(amount) || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </p>
                        )}
                    </div>

                    {/* Optional notes */}
                    <div>
                        <label className="block text-[11.5px] font-[500] text-gray-500 mb-1">
                            Additional notes <span className="text-gray-300">(optional)</span>
                        </label>
                        <textarea
                            value={notes}
                            onChange={e => setNotes(e.target.value)}
                            rows={3}
                            placeholder="Explain what you changed and why…"
                            className="w-full px-3 py-2 text-[12.5px] text-gray-700 rounded-[6px] resize-none outline-none focus:ring-2 focus:ring-amber-200 transition-all"
                            style={{ border: HAIRLINE }}
                        />
                    </div>
                </div>

                {/* Footer */}
                <div className="px-5 py-3 flex items-center justify-between gap-3" style={{ borderTop: HAIRLINE, background: 'rgba(0,0,0,0.015)' }}>
                    {result ? (
                        <div className={`flex items-center gap-2 text-[12.5px] font-[500] ${result.success ? "text-emerald-600" : "text-rose-600"}`}>
                            {result.success && <PiCheckCircle className="text-[15px]" />}
                            {result.message}
                        </div>
                    ) : (
                        <p className="text-[11.5px] text-gray-400">
                            Saving will resubmit this request for approval.
                        </p>
                    )}
                    <button
                        type="submit"
                        disabled={isPending || !!result?.success}
                        className="flex items-center gap-1.5 px-5 py-2 rounded-[6px] text-[12.5px] font-[600] text-white bg-amber-500 hover:bg-amber-600 transition-colors disabled:opacity-50 shrink-0"
                    >
                        {isPending
                            ? <><PiSpinner className="animate-spin text-[13px]" /> Resubmitting…</>
                            : <><PiArrowCounterClockwise className="text-[13px]" /> Resubmit</>
                        }
                    </button>
                </div>
            </form>
        </div>
    );
}
