"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { BrandLogo } from "@/components/ui/BrandLogo";
import {
    PiSquaresFour,
    PiChartBar,
    PiReceipt,
    PiCheckCircle,
    PiCurrencyDollar,
    PiBuildings,
    PiFileText,
    PiCalendarBlank,
    PiUsers,
    PiShieldCheck,
    PiGear,
    PiCaretDown,
    PiBell,
    PiQuestion,
    PiSignOut,
    PiTrendUp,
    PiChartPieSlice,
    PiClockCounterClockwise,
    PiInvoice,
    PiChartLine,
    PiUsersThree,
    PiBookOpenText,
    PiList,
    PiX,
    PiUploadSimple,
    PiPackage,
    PiPercent,
    PiArrowsLeftRight,
    PiGlobe,
    PiMagnifyingGlass,
    PiSiren,
    PiCoins,
    PiCalculator,
    PiBriefcase,
    PiTag,
    PiLock,
    PiDeviceMobile,
} from "react-icons/pi";
import { useSession, signOut } from "next-auth/react";
import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Avatar, { genConfig } from "react-nice-avatar";

interface MenuItem {
    name: string;
    href: string;
    icon: any;
    badge?: string;
}

interface MenuCategory {
    title: string;
    icon: any;
    items: MenuItem[];
}

const menuCategories: MenuCategory[] = [
    {
        title: "Overview",
        icon: PiSquaresFour,
        items: [
            { name: "Dashboard", href: "/dashboard", icon: PiSquaresFour },
            { name: "Branches", href: "/dashboard/branches", icon: PiBuildings },
            { name: "Regions", href: "/dashboard/regions", icon: PiGlobe },
            { name: "Analytics", href: "/dashboard/reports", icon: PiChartBar },
            { name: "Workflow Analytics", href: "/dashboard/workflow-analytics", icon: PiChartLine },
        ]
    },
    {
        title: "Expenses",
        icon: PiSiren,
        items: [
            { name: "Expenses", href: "/dashboard/requisitions", icon: PiReceipt },
            { name: "Approvals", href: "/dashboard/approvals", icon: PiCheckCircle },
            { name: "Payments", href: "/dashboard/payments", icon: PiCurrencyDollar },
        ]
    },
    {
        title: "Financial",
        icon: PiCoins,
        items: [
            { name: "Corporate wallet", href: "/dashboard/wallet", icon: PiChartPieSlice },
            { name: "Budgets", href: "/dashboard/budgets", icon: PiTrendUp },
            { name: "Forecasting", href: "/dashboard/forecasting", icon: PiChartPieSlice },
            { name: "Audit trail", href: "/dashboard/audit", icon: PiClockCounterClockwise },
        ]
    },
    {
        title: "Accounting",
        icon: PiCalculator,
        items: [
            { name: "Trial Balance", href: "/dashboard/accounting/reports/trial-balance", icon: PiChartLine },
            { name: "Income Statement", href: "/dashboard/accounting/reports/income-statement", icon: PiChartBar },
            { name: "Balance Sheet", href: "/dashboard/accounting/reports/balance-sheet", icon: PiFileText },
            { name: "Comparative Reports", href: "/dashboard/accounting/reports/comparative", icon: PiArrowsLeftRight },
            { name: "Cash Flow Statement", href: "/dashboard/accounting/reports/cash-flow", icon: PiArrowsLeftRight },
            { name: "AR / AP Aging", href: "/dashboard/accounting/aging", icon: PiCoins },
            { name: "General Ledger", href: "/dashboard/accounting/ledger", icon: PiBookOpenText },
            { name: "Journal Approvals", href: "/dashboard/accounting/journal-approvals", icon: PiCheckCircle },
            { name: "Accrual Schedules", href: "/dashboard/accounting/accruals", icon: PiCalendarBlank },
            { name: "Recurring Journals", href: "/dashboard/accounting/recurring-journals", icon: PiClockCounterClockwise },
            { name: "Close Binder", href: "/dashboard/accounting/close-binder", icon: PiFileText },
            { name: "Cost Centres", href: "/dashboard/accounting/cost-centres", icon: PiTag },
            { name: "Cost Centre Report", href: "/dashboard/accounting/reports/by-dimension", icon: PiChartPieSlice },
            { name: "Customers", href: "/dashboard/accounting/customers", icon: PiUsersThree },
            { name: "Sales & Income", href: "/dashboard/accounting/sales", icon: PiBookOpenText },
            { name: "Accounts Payable", href: "/dashboard/accounting/payables", icon: PiInvoice },
            { name: "Period Management", href: "/dashboard/accounting/periods", icon: PiCalendarBlank },
            { name: "Tax Rates", href: "/dashboard/accounting/tax-rates", icon: PiPercent },
            { name: "Chart of Accounts", href: "/dashboard/accounting/chart-of-accounts", icon: PiList },
            { name: "Bank Reconciliation", href: "/dashboard/accounting/reconciliation", icon: PiMagnifyingGlass },
        ]
    },
    {
        title: "Operations",
        icon: PiBriefcase,
        items: [
            { name: "Vendors", href: "/dashboard/vendors", icon: PiBuildings },
            { name: "Invoices", href: "/dashboard/invoices", icon: PiInvoice },
            { name: "Contracts", href: "/dashboard/contracts", icon: PiFileText },
            { name: "Assets", href: "/dashboard/assets", icon: PiPackage },
            { name: "Schedules", href: "/dashboard/schedules", icon: PiCalendarBlank },
        ]
    },
    {
        title: "Administration",
        icon: PiGear,
        items: [
            { name: "Team management", href: "/dashboard/team", icon: PiUsers },
            { name: "Account Requests", href: "/dashboard/users", icon: PiUsersThree },
            { name: "Roles & Permissions", href: "/dashboard/roles", icon: PiShieldCheck },
            { name: "Policies", href: "/dashboard/policies", icon: PiShieldCheck },
            { name: "Data Import", href: "/dashboard/settings/import", icon: PiUploadSimple },
            { name: "Account Security", href: "/dashboard/settings/security", icon: PiLock },
            { name: "System config", href: "/dashboard/settings", icon: PiGear },
            { name: "SMS Notifications", href: "/dashboard/sms", icon: PiDeviceMobile },
        ]
    }
];

export function Sidebar({ isOpen = false, onClose, isDesktopCollapsed, onToggleDesktop }: { isOpen?: boolean; onClose?: () => void; isDesktopCollapsed?: boolean; onToggleDesktop?: () => void; }) {
    const pathname = usePathname();
    const { data: session } = useSession();
    const user = session?.user;
    const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({ "Expenses": true });
    const [counts, setCounts] = useState<{ expenses: number; approvals: number }>({ expenses: 0, approvals: 0 });

    useEffect(() => {
        const fetchCounts = async () => {
            try {
                const res = await fetch('/api/approvals');
                const data = await res.json();
                if (data.counts) {
                    setCounts({
                        expenses: 0,
                        approvals: data.counts.total
                    });
                }
            } catch (error) {
                console.error("Failed to fetch sidebar counts:", error);
            }
        };

        if (session) {
            fetchCounts();
            const interval = setInterval(fetchCounts, 30000);
            return () => clearInterval(interval);
        }
    }, [session]);

    /**
     * Checks if the user has access to a specific path using permissions.
     * Maps paths to logical permissions.
     */
    const hasAccess = (href: string) => {
        if (!user) return false;

        const role = (user as any).role || "EMPLOYEE";
        const permissions = (user as any).permissions || [];

        // System Admin has full access
        if (role === 'SYSTEM_ADMIN' || permissions.includes('*')) return true;

        // Roles management is SYSTEM_ADMIN only — no permission grant can open this
        if (href.startsWith('/dashboard/roles')) return role === 'SYSTEM_ADMIN';

        const requiredPermissions: Record<string, string[]> = {
            // Admin / Management
            "/dashboard/team": ["USERS.VIEW", "USERS.MANAGE", "USERS.EDIT"],
            "/dashboard/users": ["USERS.VIEW", "USERS.MANAGE"],
            "/dashboard/settings": ["SETTINGS.MANAGE"],
            "/dashboard/settings/import": ["SETTINGS.MANAGE", "IMPORT.MANAGE"],
            "/dashboard/policies": ["POLICIES.MANAGE", "POLICIES.VIEW"],
            "/dashboard/regions": ["REGIONS.VIEW", "BRANCHES.VIEW"],
            "/dashboard/branches": ["BRANCHES.VIEW", "BRANCHES.MANAGE"],
            "/dashboard/branch-approvals": ["REQUISITIONS.VIEW_BRANCH", "REQUISITIONS.APPROVE"],

            // Financials
            "/dashboard/invoices": ["INVOICES.VIEW", "INVOICES.MANAGE", "SALES.MANAGE"],
            "/dashboard/approvals": ["EXPENSES.APPROVE", "REQUISITIONS.APPROVE", "APPROVALS.VIEW"],
            "/dashboard/wallet": ["WALLET.VIEW", "FINANCE.VIEW"],
            "/dashboard/budgets": ["BUDGETS.VIEW", "FINANCE.VIEW"],
            "/dashboard/forecasting": ["FORECASTING.VIEW", "FINANCE.VIEW"],
            "/dashboard/audit": ["AUDIT.VIEW"],

            // Accounting
            "/dashboard/accounting/customers": ["ACCOUNTING.VIEW", "CUSTOMERS.VIEW", "SALES.MANAGE"],
            "/dashboard/accounting/sales": ["ACCOUNTING.VIEW", "SALES.MANAGE"],
            "/dashboard/accounting/payables": ["ACCOUNTING.VIEW", "PAYABLES.VIEW"],
            "/dashboard/accounting/ledger": ["ACCOUNTING.VIEW", "LEDGER.VIEW"],
            "/dashboard/accounting/reports/trial-balance": ["ACCOUNTING.VIEW", "REPORTS.VIEW"],
            "/dashboard/accounting/reports/balance-sheet": ["ACCOUNTING.VIEW", "REPORTS.VIEW"],
            "/dashboard/accounting/reports/income-statement": ["ACCOUNTING.VIEW", "REPORTS.VIEW"],
            "/dashboard/accounting/reports/cash-flow": ["ACCOUNTING.VIEW", "REPORTS.VIEW"],

            "/finance-studio": ["STUDIO.VIEW", "FINANCE.VIEW", "REPORTS.VIEW"],
            "/dashboard/workflow-analytics": ["ANALYTICS.VIEW", "REPORTS.VIEW"],

            // Operations
            "/dashboard/vendors": ["VENDORS.VIEW"],
            "/dashboard/contracts": ["CONTRACTS.VIEW"],
            "/dashboard/assets": ["ASSETS.VIEW"],
        };

        const required = requiredPermissions[href];

        if (!required) {
            return true; // Default allow (e.g. Expenses, Requisitions)
        }

        return required.some(p => permissions.includes(p));
    };

    const filteredCategories = useMemo(() => {
        return menuCategories
            .map(category => ({
                ...category,
                items: category.items.filter(item => hasAccess(item.href))
            }))
            .filter(category => category.items.length > 0);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user]);

    // Auto-expand the group containing the active item
    useEffect(() => {
        const activeGroup = menuCategories.find(cat =>
            cat.items.some(item => pathname === item.href)
        );
        const next: Record<string, boolean> = { "Expenses": true };
        if (activeGroup) next[activeGroup.title] = true;
        setOpenGroups(next);
    }, [pathname]);

    const toggleGroup = (title: string) => {
        setOpenGroups(prev => ({
            [title]: !prev[title]
        }));
    };

    return (
        <aside className={cn("sb", isOpen ? 'translate-x-0' : '-translate-x-full', "lg:translate-x-0 fixed lg:static transition-transform duration-300 z-50")}>
            <div className="sb-logo justify-between">
                <Link href="/dashboard" className="flex items-center gap-2">
                    <BrandLogo width={130} height={30} color="rgba(255,255,255,0.88)" />
                </Link>
                <button onClick={onClose} className="lg:hidden text-[var(--t-muted)] hover:text-[var(--t1)] transition-colors">
                    <PiX />
                </button>
            </div>

            <nav className="nav custom-scrollbar">
                {filteredCategories.map((category) => {
                    const isOpen = openGroups[category.title];
                    const Icon = category.icon;
                    const hasActiveChild = category.items.some(item => pathname === item.href);

                    return (
                        <div key={category.title} className={cn("nav-group", isOpen ? 'open' : '')}>
                            <div
                                className={cn("nav-group-trigger", hasActiveChild && !isOpen ? 'text-[var(--sb-active)] font-bold' : '')}
                                onClick={() => toggleGroup(category.title)}
                            >
                                <Icon />
                                {category.title}
                                <PiCaretDown className="chevron" />
                            </div>

                            <AnimatePresence initial={false}>
                                {isOpen && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: "auto", opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        transition={{ duration: 0.25, ease: "easeInOut" }}
                                        className="overflow-hidden"
                                    >
                                        <div className="nav-sub-list">
                                            {category.items.map((item) => {
                                                let badge = item.badge;
                                                if (item.name === "Approvals" && counts.approvals > 0) {
                                                    badge = counts.approvals.toString();
                                                }
                                                return (
                                                    <Link
                                                        key={item.href}
                                                        href={item.href}
                                                        prefetch={false}
                                                        className={cn("nav-sub-item", pathname === item.href ? 'on' : '')}
                                                        onClick={() => onClose?.()}
                                                    >
                                                        <Icon />
                                                        <span className="nav-sub-label">{item.name}</span>
                                                        {badge && <span className="nb r">{badge}</span>}
                                                    </Link>
                                                );
                                            })}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    );
                })}
            </nav>

            <div className="sb-foot">
                <div className="foot-glow"></div>

                <div className="user-card">
                    <div className="avatar-wrap">
                        <div className="avatar">
                            <Avatar
                                style={{ width: '32px', height: '32px', borderRadius: '50%' }}
                                {...genConfig(user?.name || "User")}
                            />
                        </div>
                        <div className="avatar-ring"></div>
                    </div>

                    <div className="u-info">
                        <div className="u-name">{user?.name || 'User'}</div>
                        <div className="u-email">{(user as any)?.role?.toLowerCase()?.replace(/_/g, ' ') || user?.email || 'Employee'}</div>
                    </div>

                    <button
                        className="btn-logout"
                        onClick={() => signOut({ callbackUrl: '/login' })}
                        title="Logout"
                    >
                        <PiSignOut />
                    </button>
                </div>
            </div>
        </aside>
    );
}
