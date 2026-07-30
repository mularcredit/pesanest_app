"use client";

import {
    PiEnvelope,
    PiQuestion,
    PiSquaresFour,
    PiList,
    PiReceipt,
    PiCheckCircle,
    PiBell
} from "react-icons/pi";
import { useState, useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { useToast } from "@/components/ui/ToastProvider";
import { ConfirmationModal } from "@/components/ui/Modal";

interface Notification {
    id: string;
    type: string;
    title: string;
    message: string;
    link?: string;
    isRead: boolean;
    createdAt: string;
}

export function Header({ onMenuClick }: { onMenuClick?: () => void }) {
    const [notificationsOpen, setNotificationsOpen] = useState(false);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [loading, setLoading] = useState(false);
    const pathname = usePathname();
    const router = useRouter();
    const { showToast } = useToast();
    
    
    const notificationsRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (notificationsRef.current && !notificationsRef.current.contains(event.target as Node)) {
                setNotificationsOpen(false);
            }
        }

        if (notificationsOpen) {
            document.addEventListener("mousedown", handleClickOutside);
        }
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [notificationsOpen]);

    const getBreadcrumbs = () => {
        const paths = pathname.split('/').filter(Boolean);
        return paths.map((path, index) => {
            const decoded = decodeURIComponent(path).replace(/-/g, ' ');
            return {
                name: decoded.charAt(0).toUpperCase() + decoded.slice(1),
                isLast: index === paths.length - 1
            };
        });
    };

    const breadcrumbs = getBreadcrumbs();

    // Fetch notifications
    const fetchNotifications = async () => {
        try {
            setLoading(true);
            const res = await fetch('/api/notifications');
            if (res.ok) {
                const data = await res.json();
                setNotifications(data.notifications || []);
                setUnreadCount(data.unreadCount || 0);
            }
        } catch (error) {
            console.error('Failed to fetch notifications:', error);
        } finally {
            setLoading(false);
        }
    };

    // Mark notification as read
    const markAsRead = async (notificationId: string) => {
        try {
            const res = await fetch('/api/notifications', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ notificationId }),
            });
            if (res.ok) {
                setNotifications(prev =>
                    prev.map(n => n.id === notificationId ? { ...n, isRead: true } : n)
                );
                setUnreadCount(prev => Math.max(0, prev - 1));
            }
        } catch (error) {
            console.error('Failed to mark notification as read:', error);
        }
    };

    // Mark all as read
    const markAllAsRead = async () => {
        try {
            const res = await fetch('/api/notifications', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ markAllRead: true }),
            });
            if (res.ok) {
                setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
                setUnreadCount(0);
                showToast('All notifications marked as read', 'success');
            }
        } catch (error) {
            console.error('Failed to mark all as read:', error);
        }
    };

    // Handle notification click
    const handleNotificationClick = (notification: Notification) => {
        if (!notification.isRead) {
            markAsRead(notification.id);
        }
        if (notification.link) {
            router.push(notification.link);
        }
        setNotificationsOpen(false);
    };

    // Fetch on mount and when dropdown opens
    useEffect(() => {
        fetchNotifications();
        // Poll for new notifications every 30 seconds
        const interval = setInterval(fetchNotifications, 30000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        if (notificationsOpen) {
            fetchNotifications();
        }
    }, [notificationsOpen]);

    const handleNotImplemented = (feature: string) => {
        showToast(`${feature} feature coming soon!`, 'info');
    };

    const getNotificationColor = (type: string) => {
        switch (type) {
            case 'APPROVAL': return 'bg-blue-500';
            case 'EXPENSE': return 'bg-emerald-500';
            case 'INVOICE': return 'bg-purple-500';
            case 'BUDGET': return 'bg-orange-500';
            case 'PAYMENT': return 'bg-cyan-500';
            default: return 'bg-gray-500';
        }
    };

    const formatTimeAgo = (dateString: string) => {
        const date = new Date(dateString);
        const now = new Date();
        const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

        if (seconds < 60) return 'Just now';
        if (seconds < 3600) return `${Math.floor(seconds / 60)} mins ago`;
        if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
        if (seconds < 604800) return `${Math.floor(seconds / 86400)} days ago`;
        return date.toLocaleDateString();
    };

    return (
        <div className="flex-shrink-0 sticky top-0 z-40" style={{ background: 'var(--page)' }}>
        <header className="topbar px-4 md:px-8">
            {/* Left: Breadcrumbs & Search */}
            <div className="flex items-center gap-4 md:gap-6 flex-1">
                {/* Mobile Menu Toggle */}
                <button onClick={onMenuClick} className="lg:hidden p-2 -ml-2 text-2xl transition-colors hover:bg-[var(--glass-h)] rounded-lg text-[var(--t3)]">
                    <PiList />
                </button>

                {/* Breadcrumbs */}
                <div className="flex items-center gap-2 text-sm">
                    {breadcrumbs.map((crumb, index) => (
                        <div key={index} className="flex items-center gap-2">
                            {index > 0 && <span className="text-[var(--t4)]">/</span>}
                            <span className={crumb.isLast ? "font-semibold text-[var(--t1)]" : "text-[var(--t3)]"}>
                                {crumb.name}
                            </span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Right: Actions & Status */}
            <div className="flex items-center gap-3 ml-6">
                {/* System Status */}
                <div className="hidden xl:flex items-center gap-1 border rounded-full px-4 py-1.5 bg-emerald-500/10 border-emerald-500/20">
                    <div className="w-2 h-2 rounded-full animate-pulse bg-emerald-500"></div>
                    <span className="text-[10px] font-semibold  text-emerald-600">System Live</span>
                </div>

                {/* Help */}
                <button
                    onClick={() => handleNotImplemented("Help Center")}
                    className="relative w-10 h-10 flex items-center justify-center rounded-full transition-all duration-300 group hover:bg-black/5 text-gray-500">
                    <PiQuestion className="text-xl group-hover:text-cyan-600 transition-colors" />
                </button>

                {/* Notifications */}
                <div className="relative" ref={notificationsRef}>
                    <button
                        onClick={() => setNotificationsOpen(!notificationsOpen)}
                        className="relative w-10 h-10 flex items-center justify-center rounded-full transition-all duration-300 group hover:bg-[var(--glass-h)] text-[var(--t3)]">
                        <PiEnvelope className="text-[22px] group-hover:text-purple-600 transition-colors" />
                        {unreadCount > 0 && (
                            <>
                                <span className="absolute top-2 right-2.5 w-2 h-2 rounded-full shadow-[0_0_8px_rgba(147,51,234,0.6)] animate-pulse bg-purple-600"></span>
                                <span className="absolute -top-1 -right-1 bg-purple-600 text-white text-[9px] font-semibold rounded-full w-5 h-5 flex items-center justify-center border-2 border-white">
                                    {unreadCount > 9 ? '9+' : unreadCount}
                                </span>
                            </>
                        )}
                    </button>

                    {notificationsOpen && (
                        <>
                            <div className="absolute right-0 top-full mt-2 w-96 bg-white rounded-xl shadow-xl border border-[var(--p-line)] z-40 overflow-hidden animate-fade-in-up">
                                <div className="p-4 border-b border-[var(--p-line)] flex justify-between items-center bg-[var(--glass)]">
                                    <h3 className="text-sm font-semibold text-gray-900">System Messages</h3>
                                    <div className="flex items-center gap-2">
                                        {unreadCount > 0 && (
                                            <span className="text-[10px] text-purple-600 font-semibold bg-purple-50 px-2 py-1 rounded-full border border-purple-100">
                                                {unreadCount} New
                                            </span>
                                        )}
                                        {notifications.length > 0 && (
                                            <button
                                                onClick={markAllAsRead}
                                                className="text-[10px] font-semibold text-gray-500 hover:text-purple-600 transition-colors flex items-center gap-1"
                                            >
                                                <PiCheckCircle />
                                                Mark all read
                                            </button>
                                        )}
                                    </div>
                                </div>
                                <div className="divide-y divide-gray-50 max-h-[400px] overflow-y-auto">
                                    {loading ? (
                                        <div className="p-8 text-center text-sm text-gray-500">
                                            Loading notifications...
                                        </div>
                                    ) : notifications.length === 0 ? (
                                        <div className="p-8 text-center border border-[var(--p-line)] rounded-xl bg-[var(--glass)] my-6 mx-4">
                                            <PiEnvelope className="text-4xl text-gray-300 mx-auto mb-3" />
                                            <p className="text-sm font-semibold text-gray-500">No messages yet</p>
                                        </div>
                                    ) : (
                                        notifications.map((notification) => (
                                            <div
                                                key={notification.id}
                                                onClick={() => handleNotificationClick(notification)}
                                                className={`p-4 hover:bg-gray-50 transition-colors cursor-pointer group ${!notification.isRead ? 'bg-purple-50/30' : ''
                                                    }`}
                                            >
                                                <div className="flex gap-3">
                                                    <div className={`mt-1 w-2 h-2 rounded-full shrink-0 ${getNotificationColor(notification.type)} ${!notification.isRead ? 'animate-pulse' : 'opacity-50'
                                                        }`}></div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className={`text-sm group-hover:text-purple-600 transition-colors ${!notification.isRead ? 'font-semibold text-gray-900' : 'font-medium text-gray-700'
                                                            }`}>
                                                            {notification.title}
                                                        </p>
                                                        <p className="text-xs text-gray-600 mt-1 line-clamp-2">
                                                            {notification.message}
                                                        </p>
                                                        <p className="text-[10px] text-gray-400 mt-2 font-medium">
                                                            {formatTimeAgo(notification.createdAt)}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                                {notifications.length > 0 && (
                                    <div className="p-3 border-t border-[var(--p-line)] bg-[var(--glass)] text-center">
                                        <Link
                                            href="/dashboard/notifications"
                                            onClick={() => setNotificationsOpen(false)}
                                            className="text-xs font-semibold text-gray-600 hover:text-purple-600 transition-colors"
                                        >
                                            View All Notifications
                                        </Link>
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>

                {/* App Switcher */}
                <button
                    onClick={() => handleNotImplemented("App Switcher")}
                    className="relative w-10 h-10 flex items-center justify-center rounded-full transition-all duration-300 hover:bg-black/5 group text-gray-500">
                    <PiSquaresFour className="text-xl group-hover:text-purple-600 transition-colors" />
                </button>
            </div>

        </header>
        </div>
    );
}
