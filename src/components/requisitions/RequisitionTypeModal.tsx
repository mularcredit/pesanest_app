"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { PiX, PiPlusCircle, PiScroll, PiFilePlus, PiFolderPlus, PiFileText } from "react-icons/pi";
import { AddItemModal } from "@/components/requisitions/AddItemModal";
import { motion, AnimatePresence } from "framer-motion";

interface RequisitionTypeModalProps {
    isOpen: boolean;
    onClose: () => void;
    existingRequisitions?: any[]; // For the add item flow
    isLoading?: boolean;
}

export function RequisitionTypeModal({ isOpen, onClose, existingRequisitions = [], isLoading = false }: RequisitionTypeModalProps) {
    const router = useRouter();
    const [showAddItemModal, setShowAddItemModal] = useState(false);
    const [selectedRequisition, setSelectedRequisition] = useState<any>(null);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!isOpen) return null;
    if (!mounted) return null;

    let content;

    if (showAddItemModal && selectedRequisition) {
        content = (
            <AddItemModal
                isOpen={true}
                onClose={() => {
                    setShowAddItemModal(false);
                    setSelectedRequisition(null);
                    onClose();
                }}
                requisitionId={selectedRequisition.id}
                currency={selectedRequisition.currency || 'KES'}
                onItemAdded={() => {
                    onClose();
                    router.refresh();
                }}
            />
        );
    } else if (showAddItemModal && !selectedRequisition) {
        content = (
            <AnimatePresence>
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6 bg-[#0B0F19]/40 backdrop-blur-sm">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.98, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.98, y: 10 }}
                        transition={{ duration: 0.15, ease: "easeOut" }}
                        className="bg-white rounded-2xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.1),0_0_1px_rgba(0,0,0,0.2)] max-w-2xl w-full overflow-hidden flex flex-col max-h-[80vh] border border-gray-100"
                    >
                        <div className="px-6 py-5 sm:px-8 sm:py-6 flex items-start justify-between border-b border-gray-100 bg-[#FAFAFC]">
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-xl bg-white shadow-[0_2px_8px_rgba(41,37,141,0.12)] border border-[#6366F1]/10 flex items-center justify-center shrink-0">
                                    <PiFolderPlus className="text-xl text-[#6366F1]" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-semibold text-[#111827] tracking-tight leading-tight">Select Target Expense</h2>
                                    <p className="text-sm text-gray-500 mt-0.5">Append items to an active workflow.</p>
                                </div>
                            </div>
                            <button onClick={() => setShowAddItemModal(false)} className="p-2 -mr-2 bg-transparent hover:bg-gray-200/50 rounded-lg transition-colors text-gray-400 hover:text-gray-900 focus:outline-none">
                                <PiX className="text-xl" />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 sm:p-8 custom-scrollbar bg-white">
                            {isLoading ? (
                                <div className="flex justify-center items-center py-12">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#6366F1]"></div>
                                </div>
                            ) : existingRequisitions.length === 0 ? (
                                <div className="text-center py-12 text-gray-500 bg-[#FAFAFC] rounded-xl border border-dashed border-gray-200">
                                    <div className="mx-auto w-12 h-12 mb-3 bg-white shadow-sm border border-gray-100 rounded-xl flex items-center justify-center">
                                        <PiScroll className="text-2xl text-gray-400" />
                                    </div>
                                    <p className="text-sm font-semibold text-gray-900 mb-1">No Active Workflows</p>
                                    <p className="text-sm text-gray-500 max-w-[250px] mx-auto">You can only append items to pending, approved, or paid expenses.</p>
                                </div>
                            ) : (
                                <div className="grid gap-3">
                                    {existingRequisitions.map((req) => (
                                        <button
                                            key={req.id}
                                            onClick={() => setSelectedRequisition(req)}
                                            className="text-left p-4 rounded-[12px] bg-white border border-gray-200 hover:border-[#6366F1]/30 focus:ring-2 focus:ring-[#6366F1]/20 outline-none transition-all group flex items-center justify-between shadow-sm hover:shadow-[0_4px_20px_rgba(41,37,141,0.06)]"
                                        >
                                            <div>
                                                <div className="flex items-center gap-3 mb-1">
                                                    <span className="font-semibold text-gray-900 text-[15px] truncate max-w-[300px]">{req.title}</span>
                                                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full tracking-wide uppercase ${req.status === 'APPROVED' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                                                        req.status === 'PAID' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                                                            'bg-amber-50 text-amber-700 border border-amber-200'
                                                        }`}>
                                                        {req.status}
                                                    </span>
                                                </div>
                                                <div className="text-[13px] text-gray-500 flex items-center gap-2">
                                                    <span className="font-mono text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded border border-gray-100">{req.id.slice(0, 8).toUpperCase()}</span>
                                                    <span className="text-gray-300">•</span>
                                                    <span>{new Date(req.createdAt).toLocaleDateString()}</span>
                                                </div>
                                            </div>
                                            <div className="text-right flex flex-col items-end">
                                                <span className="font-mono font-semibold text-gray-900 text-[15px]">{req.currency} {req.amount.toLocaleString()}</span>
                                                <PiPlusCircle className="text-gray-300 group-hover:text-[#6366F1] text-lg mt-1 transition-colors" />
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </motion.div>
                </div>
            </AnimatePresence>
        );
    } else {
        content = (
            <AnimatePresence>
                <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-4 sm:p-6 bg-[#0B0F19]/40 backdrop-blur-sm">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.98, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.98, y: 20 }}
                        transition={{ duration: 0.15, ease: "easeOut" }}
                        className="bg-white rounded-2xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.1),0_0_1px_rgba(0,0,0,0.2)] max-w-lg w-full overflow-hidden border border-gray-100"
                    >
                        <div className="pt-8 px-8 pb-5 text-center relative">
                            <button onClick={onClose} className="absolute right-5 top-5 p-2 bg-transparent hover:bg-gray-100 rounded-lg transition-colors text-gray-400 hover:text-gray-900 focus:outline-none">
                                <PiX className="text-xl" />
                            </button>
                            <div className="w-14 h-14 mx-auto bg-white shadow-[0_2px_8px_rgba(41,37,141,0.12)] border border-[#6366F1]/10 rounded-2xl flex items-center justify-center mb-4">
                                <PiFileText className="text-2xl text-[#6366F1]" />
                            </div>
                            <h2 className="text-xl font-semibold text-[#111827] tracking-tight mb-1">Create Expense</h2>
                            <p className="text-sm text-gray-500">Initiate a new purchase request or append to an existing workflow.</p>
                        </div>

                        <div className="px-6 pb-8 pt-2 grid gap-3">
                            <button
                                onClick={() => {
                                    onClose();
                                    router.push('/dashboard/requisitions/new');
                                }}
                                className="flex items-start gap-4 p-5 rounded-2xl bg-white border border-gray-200 hover:border-[#6366F1]/40 focus:ring-2 focus:ring-[#6366F1]/20 outline-none transition-all group text-left shadow-sm hover:shadow-[0_4px_20px_rgba(41,37,141,0.06)]"
                            >
                                <div className="shrink-0 mt-0.5 text-gray-400 group-hover:text-[#6366F1] transition-colors">
                                    <PiFilePlus className="text-[26px]" />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-gray-900 text-[15px] tracking-tight group-hover:text-[#6366F1] transition-colors">Start Fresh Form</h3>
                                    <p className="text-[13px] text-gray-500 mt-1 leading-relaxed">
                                        Open a blank purchase expense template to document a completely new initiative.
                                    </p>
                                </div>
                            </button>

                            <button
                                onClick={() => setShowAddItemModal(true)}
                                className="flex items-start gap-4 p-5 rounded-2xl bg-white border border-gray-200 hover:border-[#6366F1]/40 focus:ring-2 focus:ring-[#6366F1]/20 outline-none transition-all group text-left shadow-sm hover:shadow-[0_4px_20px_rgba(41,37,141,0.06)]"
                            >
                                <div className="shrink-0 mt-0.5 text-gray-400 group-hover:text-[#6366F1] transition-colors">
                                    <PiFolderPlus className="text-[26px]" />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-gray-900 text-[15px] tracking-tight group-hover:text-[#6366F1] transition-colors">Append to Workflow</h3>
                                    <p className="text-[13px] text-gray-500 mt-1 leading-relaxed">
                                        Attach sub-items or subsequent requests to an existing in-progress purchase order.
                                    </p>
                                </div>
                            </button>
                        </div>
                    </motion.div>
                </div>
            </AnimatePresence>
        );
    }

    return createPortal(content, document.body);
}
