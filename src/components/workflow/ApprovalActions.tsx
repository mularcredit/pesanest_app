'use client';

import { useState } from 'react';
import { useApproval } from '@/lib/hooks/useWorkflow';
import {
    PiCheck, PiX, PiSpinner, PiPencil, PiQuestion, PiClock,
    PiWarningCircle, PiCheckCircle, PiCaretDown,
} from 'react-icons/pi';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/Card";
import { cn } from '@/lib/utils';

type ActionType = 'approve' | 'reject' | 'adjust' | 'clarify' | 'postpone';

interface ActionConfig {
    label: string;
    confirmLabel: string;
    icon: React.ReactNode;
    placeholder: string;
    required: boolean;
    color: string;
    confirmColor: string;
    description: string;
}

const ACTION_CONFIGS: Record<ActionType, ActionConfig> = {
    approve: {
        label: 'Approve',
        confirmLabel: 'Confirm Approval',
        icon: <PiCheck size={15} />,
        placeholder: 'Add any approval notes (optional)...',
        required: false,
        color: 'bg-[#6366F1] text-white hover:bg-[#6366F1]/90 border-transparent',
        confirmColor: 'bg-[#6366F1] hover:bg-[#6366F1]/90 text-white',
        description: 'This will approve the request and move it to the next step.',
    },
    reject: {
        label: 'Reject',
        confirmLabel: 'Confirm Rejection',
        icon: <PiX size={15} />,
        placeholder: 'Briefly explain the reason for rejection...',
        required: true,
        color: 'bg-white border-rose-200 text-rose-500 hover:bg-rose-50',
        confirmColor: 'bg-rose-500 hover:bg-rose-600 text-white',
        description: 'This will permanently reject the request. A reason is required.',
    },
    adjust: {
        label: 'Request Adjustment',
        confirmLabel: 'Send for Adjustment',
        icon: <PiPencil size={15} />,
        placeholder: 'Describe the specific adjustments needed before approval...',
        required: true,
        color: 'bg-white border-amber-200 text-amber-600 hover:bg-amber-50',
        confirmColor: 'bg-amber-500 hover:bg-amber-600 text-white',
        description: 'Return the request to the submitter with specific changes needed.',
    },
    clarify: {
        label: 'Request Clarification',
        confirmLabel: 'Send for Clarification',
        icon: <PiQuestion size={15} />,
        placeholder: 'What information or documentation do you need from the submitter?',
        required: true,
        color: 'bg-white border-blue-200 text-blue-600 hover:bg-blue-50',
        confirmColor: 'bg-blue-600 hover:bg-blue-700 text-white',
        description: 'Ask the submitter to provide more information before you can decide.',
    },
    postpone: {
        label: 'Postpone',
        confirmLabel: 'Confirm Postponement',
        icon: <PiClock size={15} />,
        placeholder: 'Give a reason for deferring this request (e.g., budget cycle, pending policy)...',
        required: false,
        color: 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50',
        confirmColor: 'bg-gray-700 hover:bg-gray-800 text-white',
        description: 'Defer this request for later review without approving or rejecting.',
    },
};

interface ApprovalActionsProps {
    approvalId: string;
    itemTitle: string;
    onSuccess?: () => void;
    onError?: (error: string) => void;
}

export function ApprovalActions({
    approvalId,
    itemTitle,
    onSuccess,
    onError
}: ApprovalActionsProps) {
    const { approve, reject, processApproval, loading } = useApproval();
    const [showModal, setShowModal] = useState(false);
    const [comments, setComments] = useState('');
    const [action, setAction] = useState<ActionType | null>(null);
    const [showMoreActions, setShowMoreActions] = useState(false);
    const [validationError, setValidationError] = useState('');

    const openModal = (actionType: ActionType) => {
        setAction(actionType);
        setComments('');
        setValidationError('');
        setShowModal(true);
        setShowMoreActions(false);
    };

    const handleConfirm = async () => {
        if (!action) return;
        const cfg = ACTION_CONFIGS[action];

        if (cfg.required && !comments.trim()) {
            setValidationError(`A ${action === 'reject' ? 'reason' : 'message'} is required for this action.`);
            return;
        }

        try {
            if (action === 'approve') {
                await approve(approvalId, comments);
            } else if (action === 'reject') {
                await reject(approvalId, comments);
            } else {
                // Extended actions — send decision via processApproval with custom decision label
                await processApproval(approvalId, {
                    decision: action.toUpperCase() as any,
                    comments,
                });
            }
            setShowModal(false);
            setComments('');
            onSuccess?.();
        } catch (error: any) {
            onError?.(error.message);
        }
    };

    const cfg = action ? ACTION_CONFIGS[action] : null;

    return (
        <>
            {/* Action Bar */}
            <div className="flex items-center gap-2 flex-wrap">
                {/* Primary: Approve */}
                <button
                    onClick={() => openModal('approve')}
                    disabled={loading}
                    className="flex items-center gap-1.5 px-5 py-2 bg-[#6366F1] text-white text-xs font-semibold rounded-md hover:bg-[#6366F1]/90 transition-all disabled:opacity-50 shadow-sm"
                >
                    {loading ? <PiSpinner className="animate-spin" size={14} /> : <PiCheck size={14} />}
                    Approve
                </button>

                {/* Secondary: Reject */}
                <button
                    onClick={() => openModal('reject')}
                    disabled={loading}
                    className="flex items-center gap-1.5 px-5 py-2 bg-white border border-rose-200 text-rose-500 text-xs font-semibold rounded-md hover:bg-rose-50 transition-all disabled:opacity-50"
                >
                    {loading ? <PiSpinner className="animate-spin" size={14} /> : <PiX size={14} />}
                    Reject
                </button>

                {/* More Actions dropdown */}
                <div className="relative">
                    <button
                        onClick={() => setShowMoreActions(v => !v)}
                        disabled={loading}
                        className="flex items-center gap-1.5 px-4 py-2 bg-white border border-gray-200 text-gray-600 text-xs font-semibold rounded-md hover:bg-gray-50 transition-all disabled:opacity-50"
                    >
                        More
                        <PiCaretDown size={12} className={`transition-transform ${showMoreActions ? 'rotate-180' : ''}`} />
                    </button>

                    {showMoreActions && (
                        <>
                            <div className="fixed inset-0 z-40" onClick={() => setShowMoreActions(false)} />
                            <div className="absolute right-0 top-full mt-1.5 bg-white border border-gray-200 rounded-xl shadow-[0_8px_30px_rgba(0,0,0,0.08)] z-50 py-1.5 min-w-[200px] animate-in fade-in zoom-in-95 duration-100">
                                <button
                                    onClick={() => openModal('adjust')}
                                    className="w-full flex items-center gap-3 px-4 py-2.5 text-xs text-gray-700 hover:bg-amber-50 hover:text-amber-700 transition-colors font-medium"
                                >
                                    <PiPencil className="text-amber-500 shrink-0" />
                                    <div className="text-left">
                                        <p className="font-semibold">Request Adjustment</p>
                                        <p className="text-[10px] text-gray-400 font-normal">Send back for specific changes</p>
                                    </div>
                                </button>
                                <button
                                    onClick={() => openModal('clarify')}
                                    className="w-full flex items-center gap-3 px-4 py-2.5 text-xs text-gray-700 hover:bg-blue-50 hover:text-blue-700 transition-colors font-medium"
                                >
                                    <PiQuestion className="text-blue-500 shrink-0" />
                                    <div className="text-left">
                                        <p className="font-semibold">Request Clarification</p>
                                        <p className="text-[10px] text-gray-400 font-normal">Ask submitter for more info</p>
                                    </div>
                                </button>
                                <div className="mx-3 my-1 h-px bg-gray-100" />
                                <button
                                    onClick={() => openModal('postpone')}
                                    className="w-full flex items-center gap-3 px-4 py-2.5 text-xs text-gray-700 hover:bg-gray-50 transition-colors font-medium"
                                >
                                    <PiClock className="text-gray-400 shrink-0" />
                                    <div className="text-left">
                                        <p className="font-semibold">Postpone</p>
                                        <p className="text-[10px] text-gray-400 font-normal">Defer for later review</p>
                                    </div>
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Confirmation Modal */}
            {showModal && cfg && action && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-[0_24px_60px_rgba(0,0,0,0.15)] max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-200">
                        {/* Modal Header */}
                        <div className="px-6 pt-6 pb-4 border-b border-gray-100">
                            <div className="flex items-center gap-3 mb-1">
                                <div className={cn(
                                    "w-8 h-8 rounded-lg flex items-center justify-center",
                                    action === 'approve' ? 'bg-[#6366F1]/10 text-[#6366F1]' :
                                    action === 'reject' ? 'bg-rose-50 text-rose-500' :
                                    action === 'adjust' ? 'bg-amber-50 text-amber-600' :
                                    action === 'clarify' ? 'bg-blue-50 text-blue-600' :
                                    'bg-gray-100 text-gray-500'
                                )}>
                                    {cfg.icon}
                                </div>
                                <h3 className="text-sm font-semibold text-gray-900">{cfg.label}</h3>
                            </div>
                            <p className="text-xs text-gray-500 ml-11">{cfg.description}</p>
                        </div>

                        {/* Modal Body */}
                        <div className="px-6 py-5 space-y-4">
                            <div className="bg-gray-50 border border-gray-100 rounded-lg px-4 py-3">
                                <p className="text-[9px] font-semibold text-gray-400 uppercase tracking-widest mb-1">Request</p>
                                <p className="text-sm font-semibold text-gray-900 leading-snug">{itemTitle}</p>
                            </div>

                            <div>
                                <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-widest mb-2">
                                    {action === 'approve' ? 'Approval Notes' :
                                     action === 'reject' ? 'Rejection Reason' :
                                     action === 'adjust' ? 'Adjustments Required' :
                                     action === 'clarify' ? 'Clarification Needed' :
                                     'Postponement Reason'}
                                    {cfg.required && <span className="text-rose-500 ml-1">*</span>}
                                </label>
                                <textarea
                                    value={comments}
                                    onChange={(e) => { setComments(e.target.value); setValidationError(''); }}
                                    placeholder={cfg.placeholder}
                                    className="w-full bg-white border border-gray-200 rounded-lg p-3 text-xs text-gray-900 focus:outline-none focus:ring-[3px] focus:ring-[#6366F1]/15 focus:border-[#6366F1] transition-all resize-none placeholder:text-gray-400"
                                    rows={4}
                                    autoFocus
                                />
                                {validationError && (
                                    <p className="mt-1.5 text-[10px] text-rose-500 flex items-center gap-1">
                                        <PiWarningCircle className="shrink-0" /> {validationError}
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="px-6 pb-6 flex gap-2.5">
                            <button
                                onClick={handleConfirm}
                                disabled={loading}
                                className={cn(
                                    "flex-1 py-2.5 text-xs font-semibold rounded-lg transition-all shadow-sm disabled:opacity-50",
                                    cfg.confirmColor
                                )}
                            >
                                {loading ? 'Processing...' : cfg.confirmLabel}
                            </button>
                            <button
                                onClick={() => { setShowModal(false); setComments(''); }}
                                disabled={loading}
                                className="flex-1 py-2.5 text-xs font-semibold rounded-lg bg-white border border-gray-200 text-gray-500 hover:bg-gray-50 transition-all"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

/**
 * Quick action buttons (compact, for list views)
 */
interface QuickApprovalActionsProps {
    approvalId: string;
    onSuccess?: () => void;
}

export function QuickApprovalActions({ approvalId, onSuccess }: QuickApprovalActionsProps) {
    const { approve, reject, loading } = useApproval();

    const handleQuickApprove = async () => {
        try {
            await approve(approvalId);
            onSuccess?.();
        } catch (error) {
            console.error('Approval failed:', error);
        }
    };

    const handleQuickReject = async () => {
        const reason = prompt('Please provide a reason for rejection:');
        if (!reason) return;
        try {
            await reject(approvalId, reason);
            onSuccess?.();
        } catch (error) {
            console.error('Rejection failed:', error);
        }
    };

    return (
        <div className="flex items-center gap-1.5">
            <button
                onClick={handleQuickApprove}
                disabled={loading}
                className="p-2 text-[#6366F1] hover:bg-indigo-50 rounded-lg transition-colors disabled:opacity-50"
                title="Approve"
            >
                <PiCheck size={17} />
            </button>
            <button
                onClick={handleQuickReject}
                disabled={loading}
                className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors disabled:opacity-50"
                title="Reject"
            >
                <PiX size={17} />
            </button>
        </div>
    );
}
