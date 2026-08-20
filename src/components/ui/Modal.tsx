"use client";

import { useEffect, useState, ReactNode } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { PiX, PiWarning } from "react-icons/pi";
import { cn } from "@/lib/utils";

interface BaseModalProps {
    isOpen: boolean;
    onClose: () => void;
    children: ReactNode;
    maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl";
    showCloseButton?: boolean;
}

/**
 * Base Modal Component
 * Enforces the standard dashboard modal design pattern
 * - White/40 backdrop with blur-xl
 * - Proper portal rendering
 * - Consistent animations
 * - Z-index management
 */
export function BaseModal({
    isOpen,
    onClose,
    children,
    maxWidth = "md",
    showCloseButton = false
}: BaseModalProps) {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) return null;

    const maxWidthClasses = {
        sm: "max-w-sm",
        md: "max-w-md",
        lg: "max-w-lg",
        xl: "max-w-xl",
        "2xl": "max-w-2xl"
    };

    const modalContent = (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6 lg:p-8">
                    {/* Standard Dashboard Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/25 backdrop-blur-md"
                    />

                    {/* Modal Card */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className={`relative bg-[var(--card)] w-full ${maxWidthClasses[maxWidth]} rounded-[var(--r-xl)] overflow-hidden`} style={{ boxShadow: 'var(--card-rim), 0 24px 64px rgba(15,23,42,0.12)' }}
                    >
                        {showCloseButton && (
                            <button
                                onClick={onClose}
                                className="absolute top-4 right-4 p-2 rounded-lg hover:bg-[var(--glass-h)] text-[var(--t-muted)] hover:text-[var(--t1)] transition-colors z-10"
                            >
                                <PiX className="text-xl" />
                            </button>
                        )}
                        {children}
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );

    return createPortal(modalContent, document.body);
}

interface ConfirmationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void | Promise<void>;
    title: string;
    description: string;
    confirmText?: string;
    cancelText?: string;
    variant?: "danger" | "warning" | "info";
    isLoading?: boolean;
    entityName?: string;
    onCancel?: () => void;
}

/**
 * Confirmation Modal Component
 * Pre-configured for delete/confirm actions
 * Automatically handles the standard confirmation pattern
 */
export function ConfirmationModal({
    isOpen,
    onClose,
    onConfirm,
    title,
    description,
    confirmText = "Confirm",
    cancelText = "Cancel",
    variant = "danger",
    isLoading = false,
    entityName,
    onCancel
}: ConfirmationModalProps) {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    const handleConfirm = async () => {
        await onConfirm();
    };

    if (!mounted) return null;

    const variantStyles = {
        danger: {
            iconBg: "bg-[rgba(255,90,54,0.12)]",
            iconColor: "text-[var(--red)]",
            buttonBg: "bg-[var(--red)] hover:bg-[var(--red)]/80"
        },
        warning: {
            iconBg: "bg-[var(--amber-d)]",
            iconColor: "text-[var(--amber)]",
            buttonBg: "bg-[var(--amber)] hover:bg-[var(--amber)]/80"
        },
        info: {
            iconBg: "bg-[var(--p-dim)]",
            iconColor: "text-[var(--p)]",
            buttonBg: "bg-[var(--p)] hover:bg-[var(--p-bright)]"
        }
    };

    const styles = variantStyles[variant];

    const modalContent = (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6 lg:p-8">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/25 backdrop-blur-md"
                    />

                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="relative bg-[var(--card)] w-full max-w-md rounded-[var(--r-xl)] overflow-hidden"
                        style={{ boxShadow: 'var(--card-rim), 0 24px 64px rgba(15,23,42,0.12)' }}
                    >
                        <div className="p-8 text-center">
                            <div className={`w-14 h-14 rounded-full ${styles.iconBg} ${styles.iconColor} flex items-center justify-center mx-auto mb-4`}>
                                <PiWarning className="text-3xl" />
                            </div>
                            <h3 className="text-xl font-bold text-[var(--t1)] mb-2">{title}</h3>
                            <p className="text-sm text-[var(--t3)] mb-8">
                                {entityName ? (
                                    <>
                                        {description.split(entityName)[0]}
                                        <span className="font-semibold text-[var(--t1)]">{entityName}</span>
                                        {description.split(entityName)[1]}
                                    </>
                                ) : (
                                    description
                                )}
                            </p>

                            <div className="flex gap-3 justify-center">
                                <button
                                    onClick={onCancel || onClose}
                                    disabled={isLoading}
                                    className="px-6 py-2.5 text-sm font-semibold text-[var(--t2)] bg-[var(--glass-h)] hover:bg-transparent rounded-[var(--r-btn)] transition-colors disabled:opacity-50"
                                >
                                    {cancelText}
                                </button>
                                <button
                                    onClick={handleConfirm}
                                    disabled={isLoading}
                                    className={`px-6 py-2.5 text-sm font-semibold text-white ${styles.buttonBg} rounded-[var(--r-btn)] transition-colors flex items-center gap-2 disabled:opacity-50`}
                                >
                                    {isLoading && (
                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    )}
                                    {isLoading ? "Processing..." : confirmText}
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );

    return createPortal(modalContent, document.body);
}

interface FormModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    subtitle?: string;
    icon?: ReactNode;
    children: ReactNode;
    maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "4xl" | "5xl" | "6xl";
    hideIconBackground?: boolean;
}

/**
 * Form Modal Component
 * Pre-configured for forms with header and gray body
 */
export function FormModal({
    isOpen,
    onClose,
    title,
    subtitle,
    icon,
    children,
    maxWidth = "xl",
    hideIconBackground = false
}: FormModalProps) {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) return null;

    const maxWidthClasses = {
        sm: "max-w-sm",
        md: "max-w-md",
        lg: "max-w-lg",
        xl: "max-w-xl",
        "2xl": "max-w-2xl",
        "3xl": "max-w-3xl",
        "4xl": "max-w-4xl",
        "5xl": "max-w-5xl",
        "6xl": "max-w-6xl"
    };

    const modalContent = (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6 lg:p-8">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/25 backdrop-blur-md"
                    />

                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className={`relative bg-[var(--card)] w-full ${maxWidthClasses[maxWidth]} rounded-[var(--r-xl)] overflow-hidden max-h-[90vh] flex flex-col`}
                        style={{ boxShadow: 'var(--card-rim), 0 24px 64px rgba(15,23,42,0.12)' }}
                    >
                        {/* Header */}
                        <div className="h-[72px] px-8 border-b border-[var(--p-line)] flex justify-between items-center bg-[var(--card)] shrink-0">
                            <div className="flex items-center gap-4">
                                {icon && (
                                    <div className={cn(
                                        !hideIconBackground && "p-2.5 rounded-lg bg-[var(--p-dim)] text-[var(--p)]"
                                    )}>
                                        {icon}
                                    </div>
                                )}
                                <div>
                                    <h3 className="text-base font-semibold text-[var(--t1)]">{title}</h3>
                                    {subtitle && (
                                        <p className="text-[var(--t3)] text-xs mt-0.5 font-medium">{subtitle}</p>
                                    )}
                                </div>
                            </div>
                            <button
                                onClick={onClose}
                                className="p-2 rounded-full hover:bg-[var(--glass)] text-[var(--t-muted)] hover:text-[var(--t1)] transition-all"
                            >
                                <PiX className="text-xl" />
                            </button>
                        </div>

                        {/* Body with gray background */}
                        <div className="flex-1 overflow-y-auto bg-[var(--card)]">
                            {children}
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );

    return createPortal(modalContent, document.body);
}
