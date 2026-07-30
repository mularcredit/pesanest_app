'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { useToast } from '@/components/ui/ToastProvider';
import { PiArrowsCounterClockwise, PiTrendUp, PiTrendDown, PiMinus } from 'react-icons/pi';

export function DimensionReportClient({ costCentres }: { costCentres: any[] }) {
    const { showToast } = useToast();
    const [startDate, setStartDate] = useState(() => {
        const d = new Date(); d.setMonth(0, 1); return d.toISOString().slice(0, 10);
    });
    const [endDate, setEndDate] = useState(() => new Date().toISOString().slice(0, 10));
    const [ccFilter, setCcFilter] = useState('');
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState<any>(null);

    const fmt = (n: number) => new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', maximumFractionDigits: 0 }).format(n);

    const load = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ startDate, endDate });
            if (ccFilter) params.set('costCentreId', ccFilter);
            const res = await fetch(`/api/accounting/reports/by-dimension?${params}`);
            const json = await res.json();
            if (!res.ok) throw new Error(json.error);
            setData(json);
        } catch (err: any) {
            showToast(err.message, 'error');
        } finally { setLoading(false); }
    };

    const ccOptions = [
        { value: '', label: 'All cost centres' },
        ...costCentres.map(c => ({ value: c.id, label: `${c.code} — ${c.name}` }))
    ];

    return (
        <div className="space-y-6">
            <Card className="p-4 flex flex-wrap gap-4 items-end">
                <div className="flex-1 min-w-32">
                    <label className="block text-xs font-medium text-gray-600 mb-1">From</label>
                    <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
                </div>
                <div className="flex-1 min-w-32">
                    <label className="block text-xs font-medium text-gray-600 mb-1">To</label>
                    <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
                </div>
                <div className="flex-1 min-w-48">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Cost Centre</label>
                    <Select value={ccFilter} onChange={v => setCcFilter(v)} options={ccOptions} />
                </div>
                <Button onClick={load} disabled={loading}>
                    <PiArrowsCounterClockwise className={`mr-2 ${loading ? 'animate-spin' : ''}`} /> Generate
                </Button>
            </Card>

            {data && (
                <div className="space-y-6">
                    {/* Summary row */}
                    <div className="grid grid-cols-3 gap-4">
                        {data.segments.map((seg: any) => (
                            <Card key={seg.costCentre.id} className="p-4">
                                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">{seg.costCentre.code}</div>
                                <div className="font-medium text-gray-900 mb-3">{seg.costCentre.name}</div>
                                <div className="space-y-1.5 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-gray-500 flex items-center gap-1"><PiTrendUp className="text-green-500" /> Revenue</span>
                                        <span className="text-green-600 font-semibold">{fmt(seg.revenue)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-500 flex items-center gap-1"><PiTrendDown className="text-red-500" /> Expenses</span>
                                        <span className="text-red-500 font-semibold">{fmt(seg.expenses)}</span>
                                    </div>
                                    <div className="border-t pt-1.5 flex justify-between font-bold">
                                        <span className="flex items-center gap-1"><PiMinus className="text-gray-400" /> Net</span>
                                        <span className={seg.netIncome >= 0 ? 'text-green-700' : 'text-red-700'}>
                                            {fmt(seg.netIncome)}
                                        </span>
                                    </div>
                                </div>
                            </Card>
                        ))}
                        {data.segments.length === 0 && (
                            <div className="col-span-3">
                                <Card className="p-8 text-center text-gray-400">No journal lines with cost centre tags in this period.</Card>
                            </div>
                        )}
                    </div>

                    {/* Detailed breakdown */}
                    {data.segments.map((seg: any) => (
                        <Card key={seg.costCentre.id} className="overflow-hidden">
                            <div className="px-5 py-3 bg-gray-50 border-b flex justify-between items-center">
                                <span className="font-semibold text-gray-900">{seg.costCentre.code} — {seg.costCentre.name}</span>
                                <span className={`text-sm font-bold ${seg.netIncome >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                    Net: {fmt(seg.netIncome)}
                                </span>
                            </div>
                            <table className="w-full text-sm">
                                <thead className="bg-gray-50/50">
                                    <tr className="text-left text-xs text-gray-500 font-medium">
                                        <th className="px-5 py-2.5">Account</th>
                                        <th className="px-5 py-2.5">Type</th>
                                        <th className="px-5 py-2.5 text-right">Debit</th>
                                        <th className="px-5 py-2.5 text-right">Credit</th>
                                        <th className="px-5 py-2.5 text-right">Net</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {seg.accounts.map((a: any) => (
                                        <tr key={a.account.id} className="hover:bg-gray-50">
                                            <td className="px-5 py-2.5">
                                                <span className="font-mono text-xs text-gray-400 mr-2">{a.account.code}</span>
                                                {a.account.name}
                                            </td>
                                            <td className="px-5 py-2.5 text-xs text-gray-500">{a.account.type}</td>
                                            <td className="px-5 py-2.5 text-right font-mono text-xs">{fmt(a.debit)}</td>
                                            <td className="px-5 py-2.5 text-right font-mono text-xs">{fmt(a.credit)}</td>
                                            <td className={`px-5 py-2.5 text-right font-semibold text-sm ${a.net < 0 ? 'text-red-500' : 'text-green-600'}`}>
                                                {fmt(a.net)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
