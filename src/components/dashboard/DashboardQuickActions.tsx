
import Link from "next/link";
import {
    PiHandCoins,
    PiCheckCircle,
    PiReceipt,
    PiCurrencyCircleDollar,
} from "react-icons/pi";

const CARD_STYLE: React.CSSProperties = { border: '1px solid rgba(0,0,0,0.09)' };
const ITEM_BORDER: React.CSSProperties = { borderBottom: '1px solid rgba(0,0,0,0.06)' };

const ITEMS = [
    {
        href: '/dashboard/requisitions',
        icon: PiHandCoins,
        label: 'Expenses',
        sub: 'Expenses, advances & budgets',
        iconBg: 'bg-indigo-50 text-[#6366F1]',
        iconBorder: 'rgba(99,102,241,0.2)',
    },
    {
        href: '/dashboard/invoices',
        icon: PiReceipt,
        label: 'Invoices',
        sub: 'Vendor invoices & billing',
        iconBg: 'bg-gray-50 text-gray-500',
        iconBorder: 'rgba(0,0,0,0.09)',
    },
    {
        href: '/dashboard/payments',
        icon: PiCurrencyCircleDollar,
        label: 'Payments',
        sub: 'Disbursements & transfers',
        iconBg: 'bg-emerald-50 text-emerald-600',
        iconBorder: 'rgba(16,185,129,0.2)',
    },
    {
        href: '/dashboard/approvals',
        icon: PiCheckCircle,
        label: 'Approvals',
        sub: 'Pending team requests',
        iconBg: 'bg-amber-50 text-amber-500',
        iconBorder: 'rgba(245,158,11,0.2)',
    },
];

export function DashboardQuickActions() {
    return (
        <div className="bg-white rounded-[8px] overflow-hidden" style={CARD_STYLE}>
            <div className="px-5 py-3.5 text-[10.5px] font-[500] uppercase tracking-[0.08em] text-gray-400"
                style={{ borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
                Quick Access
            </div>

            {ITEMS.map(({ href, icon: Icon, label, sub, iconBg, iconBorder }, i) => (
                <Link
                    key={href}
                    href={href}
                    className="flex items-center gap-3.5 px-5 py-3.5 hover:bg-gray-50/60 transition-colors"
                    style={i < ITEMS.length - 1 ? ITEM_BORDER : undefined}
                >
                    <div className={`w-8 h-8 rounded-[7px] flex items-center justify-center shrink-0 ${iconBg}`}
                        style={{ border: `1px solid ${iconBorder}` }}>
                        <Icon className="text-[14px]" />
                    </div>
                    <div>
                        <p className="text-[12.5px] font-[500] text-gray-900">{label}</p>
                        <p className="text-[11px] text-gray-400">{sub}</p>
                    </div>
                </Link>
            ))}
        </div>
    );
}
