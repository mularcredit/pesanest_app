import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import prisma from '@/lib/prisma';
import {
    PiArrowUp, PiArrowDown,
    PiFactory, PiChartLine, PiBank, PiCurrencyDollar,
} from 'react-icons/pi';
import { ReportExportButton } from '@/components/accounting/ReportExportButton';
import type { ReportExportData } from '@/components/accounting/ReportExportButton';

const HAIRLINE = '1px solid rgba(0,0,0,0.07)';

function fmt(n: number) {
    return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Math.abs(n));
}

function SignedAmount({ value, size = 'md' }: { value: number; size?: 'sm' | 'md' | 'lg' }) {
    const positive = value >= 0;
    const sizeClass = size === 'lg' ? 'text-[18px]' : size === 'sm' ? 'text-[11.5px]' : 'text-[12.5px]';
    const color = positive ? 'text-emerald-600' : 'text-rose-600';
    return (
        <span className={`${sizeClass} font-[600] font-mono tabular-nums ${color}`}>
            {positive ? '' : '('}{fmt(value)}{!positive ? ')' : ''}
        </span>
    );
}

export default async function CashFlowPage() {
    const session = await auth();
    if (!session?.user) return redirect('/login');

    const accounts = await prisma.account.findMany({
        where: { isActive: true },
        include: {
            journalLines: {
                where: { entry: { status: 'POSTED' } },
                include: { entry: true },
            },
        },
        orderBy: { code: 'asc' },
    });

    const accountBalances = accounts.map(acc => {
        const dr = acc.journalLines.reduce((s, l) => s + l.debit, 0);
        const cr = acc.journalLines.reduce((s, l) => s + l.credit, 0);
        const isDebitNormal = acc.type === 'ASSET' || acc.type === 'EXPENSE';
        return {
            id: acc.id, code: acc.code, name: acc.name,
            type: acc.type, subtype: acc.subtype,
            balance: isDebitNormal ? dr - cr : cr - dr,
        };
    });

    const isCash = (a: typeof accountBalances[0]) => {
        if (a.type !== 'ASSET') return false;
        const n = a.name.toLowerCase();
        return n.includes('bank') || n.includes('cash') || n.includes('wallet') || n.includes('pesa') || n.includes('stripe');
    };

    const cashAccounts = accountBalances.filter(isCash);
    const totalCash = cashAccounts.reduce((s, a) => s + a.balance, 0);

    // ── Operating ──
    const revenues   = accountBalances.filter(a => a.type === 'REVENUE');
    const expenses   = accountBalances.filter(a => a.type === 'EXPENSE');
    const totalRevenue  = revenues.reduce((s, a) => s + a.balance, 0);
    const totalExpenses = expenses.reduce((s, a) => s + a.balance, 0);
    const netIncome     = totalRevenue - totalExpenses;

    const depreciation        = expenses.filter(a => a.name.toLowerCase().includes('depreciation'));
    const depreciationAddBack = depreciation.reduce((s, a) => s + a.balance, 0);

    const receivables       = accountBalances.filter(a => a.type === 'ASSET' && !isCash(a) &&
        (a.subtype?.toUpperCase() === 'RECEIVABLE' || a.name.toLowerCase().includes('receivable')));
    const changeReceivables = receivables.reduce((s, a) => s + a.balance, 0);

    const payables       = accountBalances.filter(a => a.type === 'LIABILITY' &&
        (a.subtype?.toUpperCase() === 'PAYABLE' || a.name.toLowerCase().includes('payable')));
    const changePayables = payables.reduce((s, a) => s + a.balance, 0);

    const operatingCashFlow = netIncome + depreciationAddBack + changePayables - changeReceivables;

    // ── Investing ──
    const fixedAssets       = accountBalances.filter(a => a.type === 'ASSET' && !isCash(a) && !receivables.includes(a));
    const investingCashFlow = -1 * fixedAssets.reduce((s, a) => s + a.balance, 0);

    // ── Financing ──
    const loans             = accountBalances.filter(a => a.type === 'LIABILITY' && !payables.includes(a));
    const equity            = accountBalances.filter(a => a.type === 'EQUITY');
    const changeLoans       = loans.reduce((s, a) => s + a.balance, 0);
    const changeEquity      = equity.reduce((s, a) => s + a.balance, 0);
    const financingCashFlow = changeLoans + changeEquity;

    const netCashFlow = operatingCashFlow + investingCashFlow + financingCashFlow;

    const asOf = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

    const exportData: ReportExportData = {
        title: 'Cash Flow Statement',
        subtitle: `For the period ended ${asOf} · Indirect method`,
        company: 'Company',
        currency: 'KES',
        sections: [
            {
                title: 'Operating Activities',
                lines: [
                    { name: 'Net Income / (Loss)', current: netIncome },
                    ...(depreciationAddBack !== 0 ? [{ name: 'Add back: Depreciation', current: depreciationAddBack, indent: true as const }] : []),
                    ...(changeReceivables !== 0 ? [{ name: 'Change in Accounts Receivable', current: -changeReceivables, indent: true as const }] : []),
                    ...(changePayables !== 0 ? [{ name: 'Change in Accounts Payable', current: changePayables, indent: true as const }] : []),
                    { name: 'Net Cash from Operating Activities', current: operatingCashFlow, isBold: true, isSubtotal: true },
                ],
            },
            {
                title: 'Investing Activities',
                lines: [
                    ...(fixedAssets.length > 0 ? [{ name: 'Net Purchases of Fixed Assets', current: investingCashFlow }] : []),
                    { name: 'Net Cash from Investing Activities', current: investingCashFlow, isBold: true, isSubtotal: true },
                ],
            },
            {
                title: 'Financing Activities',
                lines: [
                    ...(changeLoans !== 0 ? [{ name: 'Change in Loans & Liabilities', current: changeLoans }] : []),
                    ...(changeEquity !== 0 ? [{ name: 'Change in Equity & Capital', current: changeEquity }] : []),
                    { name: 'Net Cash from Financing Activities', current: financingCashFlow, isBold: true, isSubtotal: true },
                ],
            },
            {
                title: 'Net Position',
                lines: [
                    { name: 'Net Increase / (Decrease) in Cash', current: netCashFlow, isBold: true, isGrandTotal: true },
                    { name: 'Cash Balance on Books', current: totalCash },
                ],
            },
        ],
    };

    const sections = [
        {
            key: 'operating',
            label: 'Operating Activities',
            description: 'Cash from core business operations',
            icon: <PiFactory className="text-[15px]" />,
            accent: '#6366F1',
            bg: 'rgba(99,102,241,0.07)',
            total: operatingCashFlow,
            lines: [
                { label: 'Net Income / (Loss)', value: netIncome, indent: false },
                ...(depreciationAddBack !== 0 ? [{ label: 'Add back: Depreciation', value: depreciationAddBack, indent: true }] : []),
                ...(changeReceivables !== 0 ? [{ label: 'Change in Accounts Receivable', value: -changeReceivables, indent: true }] : []),
                ...(changePayables !== 0 ? [{ label: 'Change in Accounts Payable', value: changePayables, indent: true }] : []),
            ],
        },
        {
            key: 'investing',
            label: 'Investing Activities',
            description: 'Cash from asset purchases and disposals',
            icon: <PiChartLine className="text-[15px]" />,
            accent: '#0284c7',
            bg: 'rgba(2,132,199,0.07)',
            total: investingCashFlow,
            lines: [
                ...(fixedAssets.length > 0 ? [{ label: 'Net Purchases of Fixed Assets', value: investingCashFlow, indent: false }] : []),
            ],
        },
        {
            key: 'financing',
            label: 'Financing Activities',
            description: 'Cash from borrowings and equity',
            icon: <PiBank className="text-[15px]" />,
            accent: '#7c3aed',
            bg: 'rgba(124,58,237,0.07)',
            total: financingCashFlow,
            lines: [
                ...(changeLoans !== 0 ? [{ label: 'Change in Loans & Liabilities', value: changeLoans, indent: false }] : []),
                ...(changeEquity !== 0 ? [{ label: 'Change in Equity & Capital', value: changeEquity, indent: false }] : []),
            ],
        },
    ];

    return (
        <div className="pb-20 space-y-5">

            {/* ── Header ── */}
            <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <div className="w-[30px] h-[30px] rounded-[7px] bg-[#6366F1] flex items-center justify-center">
                            <PiCurrencyDollar className="text-white text-[15px]" />
                        </div>
                        <h1 className="text-[19px] font-[600] text-gray-900 tracking-tight">Cash Flow Statement</h1>
                    </div>
                    <p className="text-[12px] text-gray-400 pl-[38px]">For the period ended {asOf} · Indirect method</p>
                </div>
                <ReportExportButton data={exportData} />
            </div>

            {/* ── KPI strip ── */}
            <div className="grid grid-cols-4 gap-3">
                {sections.map(s => (
                    <div key={s.key} className="bg-white rounded-[8px] px-4 py-4" style={{ border: HAIRLINE }}>
                        <div className="flex items-center gap-1.5 mb-2">
                            <span style={{ color: s.accent }}>{s.icon}</span>
                            <p className="text-[10px] font-[600] uppercase tracking-[0.09em] text-gray-400">{s.label.split(' ')[0]}</p>
                        </div>
                        <p className={`text-[18px] font-[700] font-mono tabular-nums leading-none ${s.total >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {s.total >= 0 ? '' : '('}{fmt(s.total)}{s.total < 0 ? ')' : ''}
                        </p>
                        <div className="flex items-center gap-1 mt-1.5">
                            {s.total >= 0
                                ? <PiArrowUp className="text-[11px] text-emerald-400" />
                                : <PiArrowDown className="text-[11px] text-rose-400" />
                            }
                            <p className="text-[10.5px] text-gray-400">KES</p>
                        </div>
                    </div>
                ))}
                {/* Intentionally removed: net cash replaces the 4th card */}
            </div>

            {/* Net change summary bar */}
            <div className="bg-white rounded-[8px] px-5 py-4 flex items-center justify-between"
                style={{ border: netCashFlow >= 0 ? '1px solid rgba(5,150,105,0.25)' : '1px solid rgba(225,29,72,0.25)' }}>
                <div>
                    <p className="text-[10px] font-[600] uppercase tracking-[0.09em] text-gray-400 mb-0.5">Net Change in Cash</p>
                    <p className="text-[11.5px] text-gray-500">
                        Operating {operatingCashFlow >= 0 ? '+' : ''}{fmt(operatingCashFlow)} &nbsp;·&nbsp;
                        Investing {investingCashFlow >= 0 ? '+' : ''}{fmt(investingCashFlow)} &nbsp;·&nbsp;
                        Financing {financingCashFlow >= 0 ? '+' : ''}{fmt(financingCashFlow)}
                    </p>
                </div>
                <div className="text-right">
                    <p className={`text-[24px] font-[800] font-mono tabular-nums leading-none ${netCashFlow >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {netCashFlow >= 0 ? '' : '('}{fmt(netCashFlow)}{netCashFlow < 0 ? ')' : ''}
                    </p>
                    <p className="text-[10.5px] text-gray-400 mt-0.5">KES · All-time</p>
                </div>
            </div>

            {/* ── Statement sections ── */}
            <div className="bg-white rounded-[8px] overflow-hidden" style={{ border: HAIRLINE }}>
                {sections.map((section, si) => (
                    <div key={section.key} style={si > 0 ? { borderTop: '1px solid rgba(0,0,0,0.06)' } : {}}>

                        {/* Section header */}
                        <div className="flex items-center justify-between px-5 py-3"
                            style={{ background: section.bg }}>
                            <div className="flex items-center gap-2.5">
                                <div className="w-[26px] h-[26px] rounded-[6px] flex items-center justify-center"
                                    style={{ background: section.accent }}>
                                    <span className="text-white">{section.icon}</span>
                                </div>
                                <div>
                                    <p className="text-[12.5px] font-[600]" style={{ color: section.accent }}>{section.label}</p>
                                    <p className="text-[10.5px] text-gray-400">{section.description}</p>
                                </div>
                            </div>
                            <SignedAmount value={section.total} size="md" />
                        </div>

                        {/* Line items */}
                        {section.lines.length === 0 ? (
                            <div className="px-5 py-4" style={{ borderTop: '1px solid rgba(0,0,0,0.04)' }}>
                                <p className="text-[12px] text-gray-400 italic">No activity recorded</p>
                            </div>
                        ) : (
                            <table className="w-full">
                                <tbody>
                                    {section.lines.map((line, li) => (
                                        <tr key={li}
                                            className="hover:bg-gray-50/40 transition-colors"
                                            style={{ borderTop: '1px solid rgba(0,0,0,0.04)' }}>
                                            <td className="px-5 py-3">
                                                <div className="flex items-center gap-2">
                                                    {line.indent && (
                                                        <span className="w-3 h-px shrink-0"
                                                            style={{ background: 'rgba(0,0,0,0.15)', display: 'inline-block' }} />
                                                    )}
                                                    <span className={`text-[12.5px] ${line.indent ? 'text-gray-500' : 'text-gray-800 font-[500]'}`}>
                                                        {line.label}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-5 py-3 text-right w-[160px]">
                                                <SignedAmount value={line.value} size="sm" />
                                            </td>
                                        </tr>
                                    ))}

                                    {/* Section subtotal */}
                                    <tr style={{ borderTop: HAIRLINE, background: 'rgba(0,0,0,0.012)' }}>
                                        <td className="px-5 py-3">
                                            <span className="text-[11px] font-[600] uppercase tracking-[0.07em]"
                                                style={{ color: section.accent }}>
                                                Net cash {section.total >= 0 ? 'provided by' : 'used in'} {section.label}
                                            </span>
                                        </td>
                                        <td className="px-5 py-3 text-right w-[160px]">
                                            <span className={`text-[13px] font-[700] font-mono tabular-nums ${section.total >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                {section.total >= 0 ? '' : '('}{fmt(section.total)}{section.total < 0 ? ')' : ''}
                                            </span>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        )}
                    </div>
                ))}

                {/* Grand total */}
                <div className="flex items-center justify-between px-5 py-4"
                    style={{ borderTop: HAIRLINE, background: 'rgba(0,0,0,0.018)' }}>
                    <div>
                        <p className="text-[11px] font-[700] uppercase tracking-[0.09em] text-gray-500">
                            Net Increase / (Decrease) in Cash
                        </p>
                        <p className="text-[10.5px] text-gray-400 mt-0.5">
                            Cash balance on books: KES {fmt(totalCash)}
                        </p>
                    </div>
                    <div className="text-right">
                        <p className={`text-[18px] font-[800] font-mono tabular-nums ${netCashFlow >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {netCashFlow >= 0 ? '' : '('}{fmt(netCashFlow)}{netCashFlow < 0 ? ')' : ''}
                        </p>
                        <p className="text-[10px] font-[600] uppercase tracking-[0.07em] text-gray-400 mt-0.5">KES</p>
                    </div>
                </div>
            </div>

            {/* ── Cash position reconciliation ── */}
            <div className="bg-white rounded-[8px] overflow-hidden" style={{ border: HAIRLINE }}>
                <div className="px-5 py-3" style={{ borderBottom: HAIRLINE, background: 'rgba(0,0,0,0.015)' }}>
                    <p className="text-[10px] font-[600] uppercase tracking-[0.09em] text-gray-400">Cash Position</p>
                </div>
                <div>
                    {cashAccounts.length === 0 ? (
                        <div className="px-5 py-4">
                            <p className="text-[12px] text-gray-400 italic">No cash accounts found</p>
                        </div>
                    ) : (
                        cashAccounts.map((acc, i) => (
                            <div key={acc.id}
                                className="flex items-center justify-between px-5 py-3 hover:bg-gray-50/40 transition-colors"
                                style={i > 0 ? { borderTop: HAIRLINE } : {}}>
                                <div>
                                    <p className="text-[12.5px] font-[500] text-gray-900">{acc.name}</p>
                                    <p className="text-[10.5px] text-gray-400 font-mono">{acc.code}</p>
                                </div>
                                <SignedAmount value={acc.balance} size="sm" />
                            </div>
                        ))
                    )}
                    <div className="flex items-center justify-between px-5 py-3"
                        style={{ background: 'rgba(0,0,0,0.018)', borderTop: HAIRLINE }}>
                        <p className="text-[11px] font-[700] uppercase tracking-[0.07em] text-gray-500">Total Cash Balance</p>
                        <span className={`text-[13px] font-[700] font-mono tabular-nums ${totalCash >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {totalCash >= 0 ? '' : '('}{fmt(totalCash)}{totalCash < 0 ? ')' : ''}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}
