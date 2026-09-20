
import Link from "next/link";
import {
    PiHandCoins,
    PiCheckCircle,
    PiReceipt,
    PiCurrencyCircleDollar,
} from "react-icons/pi";

const HAIRLINE = '1px solid rgba(0,0,0,0.07)';
const ITEM_BORDER: React.CSSProperties = { borderBottom: HAIRLINE };

const ITEMS = [
    {
        href: '/dashboard/requisitions',
        icon: PiHandCoins,
        label: 'Expenses',
        sub: 'Expenses, advances & budgets',
    },
    {
        href: '/dashboard/invoices',
        icon: PiReceipt,
        label: 'Invoices',
        sub: 'Vendor invoices & billing',
    },
    {
        href: '/dashboard/payments',
        icon: PiCurrencyCircleDollar,
        label: 'Payments',
        sub: 'Disbursements & transfers',
    },
    {
        href: '/dashboard/approvals',
        icon: PiCheckCircle,
        label: 'Approvals',
        sub: 'Pending team requests',
    },
];

export function DashboardQuickActions() {
    return (
        <div className="bg-white rounded-[10px] overflow-hidden" style={{ border: HAIRLINE }}>
            <div className="px-5 py-3.5 text-[10.5px] font-[500] uppercase tracking-[0.08em] text-gray-400"
                style={{ borderBottom: HAIRLINE }}>
                Quick Access
            </div>

            {ITEMS.map(({ href, icon: Icon, label, sub }, i) => (
                <Link
                    key={href}
                    href={href}
                    className="flex items-center gap-3.5 px-5 py-3.5 hover:bg-gray-50/60 transition-colors"
                    style={i < ITEMS.length - 1 ? ITEM_BORDER : undefined}
                >
                    <div className="w-8 h-8 rounded-[7px] flex items-center justify-center shrink-0 bg-gray-50"
                        style={{ border: HAIRLINE, color: '#059669' }}>
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
