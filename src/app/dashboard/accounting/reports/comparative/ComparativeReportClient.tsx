'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { PiArrowCounterClockwise, PiDownloadSimple } from 'react-icons/pi';

export function ComparativeReportClient() {
    const thisYear = new Date().getFullYear();
    const [reportType, setReportType] = useState<'PL' | 'BS'>('PL');
    const [p1Start, setP1Start] = useState(`${thisYear}-01-01`);
    const [p1End, setP1End] = useState(`${thisYear}-12-31`);
    const [p1Label, setP1Label] = useState(`FY ${thisYear}`);
    const [p2Start, setP2Start] = useState(`${thisYear - 1}-01-01`);
    const [p2End, setP2End] = useState(`${thisYear - 1}-12-31`);
    const [p2Label, setP2Label] = useState(`FY ${thisYear - 1}`);
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(false);

    const fmt = (n: number) => new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', maximumFractionDigits: 0 }).format(n);
    const fmtPct = (a: number, b: number) => b === 0 ? '—' : `${((a - b) / Math.abs(b) * 100).toFixed(1)}%`;

    const load = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ reportType, p1Start, p1End, p1Label, p2Start, p2End, p2Label });
            const res = await fetch(`/api/accounting/reports/comparative?${params}`);
            setData(await res.json());
        } finally { setLoading(false); }
    };

    const renderPL = () => {
        if (!data || data.reportType !== 'PL') return null;
        const { rows, summary } = data;

        const revenueRows = rows.filter((r: any) => r.period1 > 0 || r.period2 > 0);
        const expenseRows = rows.filter((r: any) => r.period1 < 0 || r.period2 < 0);

        const renderRows = (items: any[]) => items.map((r: any) => (
            <tr key={r.code} className="border-t hover:bg-gray-50">
                <td className="px-4 py-2.5 font-mono text-xs text-gray-500 w-16">{r.code}</td>
                <td className="px-4 py-2.5">{r.name}</td>
                <td className="px-4 py-2.5 text-right">{fmt(Math.abs(r.period1))}</td>
                <td className="px-4 py-2.5 text-right">{fmt(Math.abs(r.period2))}</td>
                <td className={`px-4 py-2.5 text-right ${r.variance > 0 ? 'text-green-600' : r.variance < 0 ? 'text-red-600' : 'text-gray-400'}`}>
                    {fmt(Math.abs(r.variance))} ({fmtPct(r.period1, r.period2)})
                </td>
            </tr>
        ));

        return (
            <Card className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead className="bg-gray-50"><tr className="text-left text-gray-500">
                        <th className="px-4 py-3 font-medium w-16">Code</th>
                        <th className="px-4 py-3 font-medium">Account</th>
                        <th className="px-4 py-3 font-medium text-right">{p1Label}</th>
                        <th className="px-4 py-3 font-medium text-right">{p2Label}</th>
                        <th className="px-4 py-3 font-medium text-right">Variance</th>
                    </tr></thead>
                    <tbody>
                        <tr className="bg-gray-50"><td colSpan={5} className="px-4 py-2 font-semibold text-gray-700">Revenue</td></tr>
                        {renderRows(revenueRows)}
                        <tr className="bg-gray-50 font-semibold border-t">
                            <td colSpan={2} className="px-4 py-2.5 text-gray-700">Total Revenue</td>
                            <td className="px-4 py-2.5 text-right">{fmt(summary.period1.revenue)}</td>
                            <td className="px-4 py-2.5 text-right">{fmt(summary.period2.revenue)}</td>
                            <td className={`px-4 py-2.5 text-right ${summary.variance.revenue >= 0 ? 'text-green-600' : 'text-red-600'}`}>{fmt(Math.abs(summary.variance.revenue))}</td>
                        </tr>

                        <tr className="bg-gray-50"><td colSpan={5} className="px-4 py-2 font-semibold text-gray-700">Expenses</td></tr>
                        {renderRows(expenseRows)}
                        <tr className="bg-gray-50 font-semibold border-t">
                            <td colSpan={2} className="px-4 py-2.5 text-gray-700">Total Expenses</td>
                            <td className="px-4 py-2.5 text-right">{fmt(summary.period1.expenses)}</td>
                            <td className="px-4 py-2.5 text-right">{fmt(summary.period2.expenses)}</td>
                            <td className={`px-4 py-2.5 text-right ${summary.variance.expenses <= 0 ? 'text-green-600' : 'text-red-600'}`}>{fmt(Math.abs(summary.variance.expenses))}</td>
                        </tr>

                        <tr className="border-t-2 bg-gray-100">
                            <td colSpan={2} className="px-4 py-3 font-bold text-gray-900">Net Income / (Loss)</td>
                            <td className={`px-4 py-3 text-right font-bold ${summary.period1.netIncome >= 0 ? 'text-green-700' : 'text-red-600'}`}>{fmt(summary.period1.netIncome)}</td>
                            <td className={`px-4 py-3 text-right font-bold ${summary.period2.netIncome >= 0 ? 'text-green-700' : 'text-red-600'}`}>{fmt(summary.period2.netIncome)}</td>
                            <td className={`px-4 py-3 text-right font-bold ${summary.variance.netIncome >= 0 ? 'text-green-700' : 'text-red-600'}`}>{fmt(Math.abs(summary.variance.netIncome))}</td>
                        </tr>
                    </tbody>
                </table>
            </Card>
        );
    };

    const renderBS = () => {
        if (!data || data.reportType !== 'BS') return null;
        const p1 = data.period1.data;
        const p2 = data.period2.data;

        const renderSection = (title: string, s1: any, s2: any) => (
            <>
                <tr className="bg-gray-50"><td colSpan={4} className="px-4 py-2 font-semibold text-gray-700">{title}</td></tr>
                {s1.accounts.map((a: any) => {
                    const a2 = s2.accounts.find((x: any) => x.code === a.code);
                    const v2 = a2?.balance ?? 0;
                    const variance = a.balance - v2;
                    return (
                        <tr key={a.code} className="border-t hover:bg-gray-50">
                            <td className="px-4 py-2 font-mono text-xs text-gray-500">{a.code}</td>
                            <td className="px-4 py-2">{a.name}</td>
                            <td className="px-4 py-2 text-right">{fmt(a.balance)}</td>
                            <td className="px-4 py-2 text-right">{fmt(v2)}</td>
                        </tr>
                    );
                })}
                <tr className="bg-gray-50 font-semibold border-t">
                    <td colSpan={2} className="px-4 py-2">Total {title}</td>
                    <td className="px-4 py-2 text-right">{fmt(s1.total)}</td>
                    <td className="px-4 py-2 text-right">{fmt(s2.total)}</td>
                </tr>
            </>
        );

        return (
            <Card className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead className="bg-gray-50"><tr className="text-left text-gray-500">
                        <th className="px-4 py-3 font-medium w-16">Code</th>
                        <th className="px-4 py-3 font-medium">Account</th>
                        <th className="px-4 py-3 font-medium text-right">{p1Label}</th>
                        <th className="px-4 py-3 font-medium text-right">{p2Label}</th>
                    </tr></thead>
                    <tbody>
                        {renderSection('Assets', p1.assets, p2.assets)}
                        {renderSection('Liabilities', p1.liabilities, p2.liabilities)}
                        {renderSection('Equity', p1.equity, p2.equity)}
                    </tbody>
                </table>
            </Card>
        );
    };

    return (
        <div className="space-y-6">
            <Card className="p-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Report type */}
                    <div className="md:col-span-2 flex items-center gap-4">
                        <label className="text-sm font-medium text-gray-700">Report:</label>
                        <div className="flex rounded-lg overflow-hidden border border-gray-200">
                            {(['PL', 'BS'] as const).map(t => (
                                <button key={t} onClick={() => setReportType(t)}
                                    className={`px-5 py-2 text-sm font-medium transition-colors ${reportType === t ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
                                    {t === 'PL' ? 'Profit & Loss' : 'Balance Sheet'}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Period 1 */}
                    <div className="space-y-3 border border-gray-200 rounded-lg p-4">
                        <h3 className="text-sm font-semibold text-gray-700">Current Period</h3>
                        <div><label className="block text-xs text-gray-500 mb-1">Label</label><Input value={p1Label} onChange={e => setP1Label(e.target.value)} /></div>
                        <div className="grid grid-cols-2 gap-3">
                            {reportType === 'PL' && <div><label className="block text-xs text-gray-500 mb-1">Start</label><Input type="date" value={p1Start} onChange={e => setP1Start(e.target.value)} /></div>}
                            <div className={reportType === 'BS' ? 'col-span-2' : ''}><label className="block text-xs text-gray-500 mb-1">{reportType === 'BS' ? 'As of' : 'End'}</label><Input type="date" value={p1End} onChange={e => setP1End(e.target.value)} /></div>
                        </div>
                    </div>

                    {/* Period 2 */}
                    <div className="space-y-3 border border-gray-200 rounded-lg p-4">
                        <h3 className="text-sm font-semibold text-gray-700">Comparison Period</h3>
                        <div><label className="block text-xs text-gray-500 mb-1">Label</label><Input value={p2Label} onChange={e => setP2Label(e.target.value)} /></div>
                        <div className="grid grid-cols-2 gap-3">
                            {reportType === 'PL' && <div><label className="block text-xs text-gray-500 mb-1">Start</label><Input type="date" value={p2Start} onChange={e => setP2Start(e.target.value)} /></div>}
                            <div className={reportType === 'BS' ? 'col-span-2' : ''}><label className="block text-xs text-gray-500 mb-1">{reportType === 'BS' ? 'As of' : 'End'}</label><Input type="date" value={p2End} onChange={e => setP2End(e.target.value)} /></div>
                        </div>
                    </div>
                </div>
                <div className="mt-4">
                    <Button onClick={load} disabled={loading}>
                        <PiArrowCounterClockwise className={`mr-2 ${loading ? 'animate-spin' : ''}`} /> Generate Report
                    </Button>
                </div>
            </Card>

            {data && (reportType === 'PL' ? renderPL() : renderBS())}
        </div>
    );
}
