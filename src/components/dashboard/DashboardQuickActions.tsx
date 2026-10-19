
import Link from "next/link";
import {
    PiHandCoins,
    PiCheckCircle,
    PiReceipt,
    PiCurrencyCircleDollar,
    PiArrowRight,
} from "react-icons/pi";
import { CARD_STYLE, HAIRLINE } from "./SectionHeader";

const ITEM_BORDER: React.CSSProperties = { borderBottom: HAIRLINE };

const ITEMS = [
    {
        href: '/dashboard/requisitions',
        icon: PiHandCoins,
        label: 'Expenses',
        sub: 'Expenses, advances & budgets',
        color: '#6366F1',
        bg: 'rgba(99,102,241,0.1)',
    },
    {
        href: '/dashboard/invoices',
        icon: PiReceipt,
        label: 'Invoices',
        sub: 'Vendor invoices & billing',
        color: '#D97706',
        bg: 'rgba(217,119,6,0.1)',
    },
    {
        href: '/dashboard/payments',
        icon: PiCurrencyCircleDollar,
        label: 'Payments',
        sub: 'Disbursements & transfers',
        color: '#059669',
        bg: 'rgba(5,150,105,0.1)',
    },
    {
        href: '/dashboard/approvals',
        icon: PiCheckCircle,
        label: 'Approvals',
        sub: 'Pending team requests',
        color: '#7C3AED',
        bg: 'rgba(124,58,237,0.1)',
    },
];

export function DashboardQuickActions() {
    return (
        <div className="bg-white rounded-[16px] overflow-hidden" style={CARD_STYLE}>
            <div className="px-5 py-3.5 text-[10.5px] font-[600] uppercase tracking-[0.08em] text-gray-400"
                style={{ borderBottom: HAIRLINE }}>
                Quick Access
            </div>

            {ITEMS.map(({ href, icon: Icon, label, sub, color, bg }, i) => (
                <Link
                    key={href}
                    href={href}
                    className="group flex items-center gap-3.5 px-5 py-3.5 hover:bg-gray-50/60 transition-colors"
                    style={i < ITEMS.length - 1 ? ITEM_BORDER : undefined}
                >
                    <div className="w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0"
                        style={{ background: bg, color }}>
                        <Icon className="text-[15px]" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-[12.5px] font-[500] text-gray-900">{label}</p>
                        <p className="text-[11px] text-gray-400">{sub}</p>
                    </div>
                    <PiArrowRight className="text-[13px] text-gray-300 shrink-0 transition-transform group-hover:translate-x-0.5" />
                </Link>
            ))}
        </div>
    );
}
