import prisma from "@/lib/prisma";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { AccountingActions } from "@/components/accounting/AccountingActions";
import { AccountsTableClient } from "./AccountsTableClient";
import { PiFiles, PiTrendUp, PiTrendDown, PiWallet, PiCreditCard, PiBank } from "react-icons/pi";

const HAIRLINE = '1px solid rgba(0,0,0,0.07)';

// Used only for the KPI strip — icon components stay server-side here
const TYPE_META_SERVER: Record<string, { label: string; accent: string; bg: string; icon: any }> = {
    ASSET:     { label: 'Assets',      accent: '#059669', bg: 'rgba(5,150,105,0.06)',   icon: PiWallet     },
    LIABILITY: { label: 'Liabilities', accent: '#e11d48', bg: 'rgba(225,29,72,0.06)',   icon: PiCreditCard },
    EQUITY:    { label: 'Equity',      accent: '#6366F1', bg: 'rgba(99,102,241,0.06)',  icon: PiBank       },
    REVENUE:   { label: 'Revenue',     accent: '#0284c7', bg: 'rgba(2,132,199,0.06)',   icon: PiTrendUp    },
    EXPENSE:   { label: 'Expenses',    accent: '#d97706', bg: 'rgba(217,119,6,0.06)',   icon: PiTrendDown  },
    DEFAULT:   { label: 'Other',       accent: '#6b7280', bg: 'rgba(107,114,128,0.06)', icon: PiFiles      },
};

const TYPE_ORDER = ['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'];

export default async function ChartOfAccountsPage() {
    const session = await auth();
    if (!session?.user) return redirect("/login");

    const accounts = await prisma.account.findMany({
        where: { isArchived: false } as any,
        orderBy: { code: 'asc' },
    });

    const grouped = accounts.reduce((acc: Record<string, any[]>, account: any) => {
        if (!acc[account.type]) acc[account.type] = [];
        acc[account.type].push(account);
        return acc;
    }, {});

    const totalAccounts = accounts.length;
    const activeCount   = accounts.filter((a: any) => a.isActive).length;

    return (
        <div className="pb-20 space-y-5">

            {/* ── Header ── */}
            <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <div className="w-[30px] h-[30px] rounded-[7px] bg-[#6366F1] flex items-center justify-center shrink-0">
                            <PiFiles className="text-white text-[15px]" />
                        </div>
                        <h1 className="text-[19px] font-[600] text-gray-900 tracking-tight">Chart of Accounts</h1>
                    </div>
                    <p className="text-[12px] text-gray-400 pl-[38px]">
                        {totalAccounts} account{totalAccounts !== 1 ? 's' : ''} · {activeCount} active · general ledger codes
                    </p>
                </div>
                <AccountingActions type="NEW_ACCOUNT" />
            </div>

            {/* ── KPI strip ── */}
            <div className="grid grid-cols-5 gap-3">
                {TYPE_ORDER.map(type => {
                    const meta  = TYPE_META_SERVER[type];
                    const count = (grouped[type] || []).length;
                    const Icon  = meta.icon;
                    return (
                        <div key={type} className="bg-white rounded-[8px] px-4 py-3.5" style={{ border: HAIRLINE }}>
                            <div className="flex items-center gap-1.5 mb-2">
                                <Icon className="text-[13px] shrink-0" style={{ color: meta.accent }} />
                                <p className="text-[10px] font-[600] uppercase tracking-[0.09em] text-gray-400">{meta.label}</p>
                            </div>
                            <p className="text-[22px] font-[700] tabular-nums leading-none" style={{ color: count > 0 ? meta.accent : '#d1d5db' }}>
                                {count}
                            </p>
                            <p className="text-[10.5px] text-gray-400 mt-1">account{count !== 1 ? 's' : ''}</p>
                        </div>
                    );
                })}
            </div>

            {/* ── Account groups (client — handles selection + bulk edit) ── */}
            <AccountsTableClient
                grouped={grouped}
                typeOrder={TYPE_ORDER}
            />
        </div>
    );
}
