"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { PiX } from "react-icons/pi";
import { Button } from "@/components/ui/Button";
import { ExpenseForm } from "./ExpenseForm";

interface UnifiedExpenseModalProps {
    isOpen: boolean;
    onClose: () => void;
    mode?: "quick" | "full";
    expense?: any; // Add this
}

import { useToast, ToastContext } from "@/components/ui/ToastProvider";

// ... (UnifiedExpenseModalProps interface remains same)

export function UnifiedExpenseModal({
    isOpen,
    onClose,
    mode = "full",
    expense // Add this
}: UnifiedExpenseModalProps) {
    const [mounted, setMounted] = useState(false);

    // Capture context from parent tree
    // If this throws, it means UnifiedExpenseModal is outside provider, correct?
    // We can wrap in try/catch or assume it's safe if we are sure about layout.
    // However, useToast throws if missing. Let's try to capture value directly.
    // If context is missing, useToast throws. That's good debugging info.
    const toastContextValue = useToast();

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) return null;

    const modalContent = (
        <ToastContext.Provider value={toastContextValue}>
            <AnimatePresence>
                {isOpen && (
                    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
                        {/* Backdrop */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={onClose}
                            className="fixed inset-0 bg-black/40 backdrop-blur-md"
                        />

                        {/* Modal Card */}
                        <motion.div
                            initial={{ opacity: 0, scale: 0.98, y: 15 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.98, y: 15 }}
                            className="relative bg-white w-full max-w-4xl rounded-[24px] overflow-hidden max-h-[92vh] flex flex-col shadow-[0_32px_120px_rgba(0,0,0,0.3)] ring-1 ring-black/10 border border-gray-100"
                        >
                            {/* The ExpenseForm handles its own Header/Body/Footer */}
                            <div className="flex-1 overflow-y-auto custom-scrollbar">
                                <ExpenseForm
                                    mode={mode}
                                    expense={expense}
                                    onSuccess={onClose}
                                    onCancel={onClose}
                                />
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </ToastContext.Provider>
    );

    return createPortal(modalContent, document.body);
}
