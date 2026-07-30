"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { PiCheckCircle, PiWarningCircle, PiInfo, PiX, PiWarning } from 'react-icons/pi';

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface Toast {
    id: string;
    message: string;
    title?: string;
    type: ToastType;
    duration: number;
}

interface ToastContextType {
    showToast: (message: string, type?: ToastType, title?: string, duration?: number) => void;
}

export const ToastContext = createContext<ToastContextType | undefined>(undefined);

function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: (id: string) => void }) {
    useEffect(() => {
        const timer = setTimeout(() => onRemove(toast.id), toast.duration);
        return () => clearTimeout(timer);
    }, [toast.id, toast.duration, onRemove]);

    const configs: Record<ToastType, { icon: React.ReactNode; accent: string; iconColor: string }> = {
        success: {
            icon: <PiCheckCircle className="text-lg shrink-0" />,
            accent: 'border-l-emerald-500',
            iconColor: 'text-emerald-500',
        },
        error: {
            icon: <PiWarningCircle className="text-lg shrink-0" />,
            accent: 'border-l-rose-500',
            iconColor: 'text-rose-500',
        },
        warning: {
            icon: <PiWarning className="text-lg shrink-0" />,
            accent: 'border-l-amber-500',
            iconColor: 'text-amber-500',
        },
        info: {
            icon: <PiInfo className="text-lg shrink-0" />,
            accent: 'border-l-[#6366F1]',
            iconColor: 'text-[#6366F1]',
        },
    };

    const c = configs[toast.type];

    return (
        <div
            className={`relative bg-white border border-gray-200 ${c.accent} border-l-4 rounded-lg shadow-[0_8px_30px_rgba(0,0,0,0.10)] flex items-start gap-3 p-4 min-w-[300px] max-w-[380px] animate-in slide-in-from-right-4 fade-in duration-300 overflow-hidden`}
        >
            {/* Auto-dismiss progress bar */}
            <div
                className={`absolute bottom-0 left-0 h-[2px] opacity-25`}
                style={{
                    background: toast.type === 'success' ? '#10b981' : toast.type === 'error' ? '#f43f5e' : toast.type === 'warning' ? '#f59e0b' : '#6366F1',
                    animation: `toastShrink ${toast.duration}ms linear forwards`,
                }}
            />
            <span className={`mt-0.5 ${c.iconColor}`}>{c.icon}</span>
            <div className="flex-1 min-w-0">
                {toast.title && (
                    <p className="text-[11px] font-semibold text-gray-900 mb-0.5 tracking-tight">{toast.title}</p>
                )}
                <p className="text-xs text-gray-600 leading-relaxed">{toast.message}</p>
            </div>
            <button
                onClick={() => onRemove(toast.id)}
                className="p-1 rounded-md hover:bg-gray-100 text-gray-300 hover:text-gray-500 transition-colors shrink-0 mt-0.5"
            >
                <PiX className="text-sm" />
            </button>
        </div>
    );
}

export function ToastProvider({ children }: { children: ReactNode }) {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const showToast = (message: string, type: ToastType = 'info', title?: string, duration: number = 5000) => {
        const id = Math.random().toString(36).substring(7);
        setToasts(prev => [...prev, { id, message, type, title, duration }]);
    };

    const removeToast = (id: string) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    };

    return (
        <ToastContext.Provider value={{ showToast }}>
            {children}

            {/* Toast Container — bottom-right stack */}
            <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-2.5 pointer-events-none">
                {toasts.map(toast => (
                    <div key={toast.id} className="pointer-events-auto">
                        <ToastItem toast={toast} onRemove={removeToast} />
                    </div>
                ))}
            </div>

            <style>{`
                @keyframes toastShrink {
                    from { width: 100%; }
                    to { width: 0%; }
                }
            `}</style>
        </ToastContext.Provider>
    );
}

export function useToast() {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within ToastProvider');
    }
    return context;
}
