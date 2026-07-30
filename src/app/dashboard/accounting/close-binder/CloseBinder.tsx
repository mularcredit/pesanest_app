'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { useToast } from '@/components/ui/ToastProvider';
import { PiArrowCounterClockwise, PiWarning, PiCheckCircle, PiFileText, PiListNumbers, PiSiren } from 'react-icons/pi';

const TABS = [
    { id: 'tb', label: 'Trial Balance', icon: PiFileText },
    { id: 'journals', label: 'Journal Listing', icon: PiListNumbers },
    { id: 'gaps', label: 'Sequence Gaps', icon: PiWarning },
    { id: 'exceptions', label: 'Exceptions', icon: PiSiren },
    { id: 'orphans', label: 'Orphaned Docs', icon: PiWarning },
];

export function CloseBinder({ fiscalYears }: { fiscalYears: any[] }) {
    const { showToast } = useToast();
    const [selectedPeriodId, setSelectedPeriodId] = useState('');
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [tab, setTab] = useState('tb');

    const allPeriods = fiscalYears.flatMap((fy: any) =>
        fy.periods.map((p: any) => ({ ...p, fyName: fy.name }))
    );
    const periodOptions = [{ value: '', label: 'Select period…' }, ...allPeriods.map(p => ({ value: p.id, label: `${p.fyName} — ${p.name}` }))];

    const fmt = (n: number) => new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(n);

    const load = async () => {
        if (!selectedPeriodId) { showToast('Select a period first', 'error'); return; }
        setLoading(true);
        try {
            const res = await fetch(`/api/accounting/close-binder?periodId=${selectedPeriodId}`);
            const json = await res.json();
            if (!res.ok) throw new Error(json.error);
            setData(json);
        } catch (err: any) {
            showToast(err.message, 'error');
        } finally { setLoading(false); }
    };

    return (
        <div className="space-y-6">
            {/* Controls */}
            <Card className="p-4 flex flex-wrap gap-4 items-end">
                <div className="flex-1 min-w-48">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Period</label>
                    <Select value={selectedPeriodId} onChange={v => setSelectedPeriodId(v)} options={periodOptions} />
                </div>
                <Button onClick={load} disabled={loading || !selectedPeriodId}>
                    <PiArrowCounterClockwise className={`mr-2 ${loading ? 'animate-spin' : ''}`} /> Generate Binder
                </Button>
            </Card>

            {data && (
                <>
                    {/* Period header */}
                    <Card className="p-4 flex flex-wrap gap-6 items-center text-sm">
                        <div><span className="text-gray-500">Period:</span> <strong>{data.period.name}</strong></div>
                        <div><span className="text-gray-500">Fiscal Year:</span> <strong>{data.period.fiscalYear}</strong></div>
                        <div><span className="text-gray-500">Status:</span> <span className={`font-semibold ${data.period.isClosed ? 'text-green-600' : 'text-orange-500'}`}>{data.period.isClosed ? 'Closed' : 'Open'}</span></div>
                        <div className={`flex items-center gap-1 font-semibold ${data.totals.balanced ? 'text-green-600' : 'text-red-600'}`}>
                            {data.totals.balanced ? <PiCheckCircle /> : <PiWarning />} TB {data.totals.balanced ? 'balanced' : 'OUT OF BALANCE'}
                        </div>
                    </Card>

                    {/* Tabs */}
                    <div className="border-b border-gray-200">
                        <nav className="flex gap-1 -mb-px overflow-x-auto">
                            {TABS.map(t => (
                                <button key={t.id} onClick={() => setTab(t.id)}
                                    className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${tab === t.id ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                                    <t.icon className="text-base" />{t.label}
                                    {t.id === 'exceptions' && (data.exceptions.backdated.length + data.exceptions.manualJournals.length + data.exceptions.missingNumbers.length) > 0 && (
                                        <span className="ml-1 bg-red-100 text-red-700 text-xs px-1.5 py-0.5 rounded-full">
                                            {data.exceptions.backdated.length + data.exceptions.manualJournals.length + data.exceptions.missingNumbers.length}
                                        </span>
                                    )}
                                </button>
                            ))}
                        </nav>
                    </div>

                    {/* Tab content */}
                    {tab === 'tb' && (
                        <Card className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-gray-50"><tr className="text-left text-gray-500">
                                    <th className="px-4 py-3 font-medium">Code</th>
                                    <th className="px-4 py-3 font-medium">Account</th>
                                    <th className="px-4 py-3 font-medium">Type</th>
                                    <th className="px-4 py-3 font-medium text-right">Debit</th>
                                    <th className="px-4 py-3 font-medium text-right">Credit</th>
                                    <th className="px-4 py-3 font-medium text-right">Net</th>
                                </tr></thead>
                                <tbody>
                                    {data.trialBalance.map((a: any) => (
                                        <tr key={a.id} className="border-t hover:bg-gray-50">
                                            <td className="px-4 py-2.5 font-mono text-xs text-gray-600">{a.code}</td>
                                            <td className="px-4 py-2.5">{a.name}</td>
                                            <td className="px-4 py-2.5 text-xs text-gray-500">{a.type}</td>
                                            <td className="px-4 py-2.5 text-right">{fmt(a.debit)}</td>
                                            <td className="px-4 py-2.5 text-right">{fmt(a.credit)}</td>
                                            <td className={`px-4 py-2.5 text-right font-medium ${a.net < 0 ? 'text-red-600' : ''}`}>{fmt(a.net)}</td>
                                        </tr>
                                    ))}
                                    <tr className="border-t-2 bg-gray-50 font-semibold">
                                        <td colSpan={3} className="px-4 py-2.5 text-gray-700">Totals</td>
                                        <td className="px-4 py-2.5 text-right">{fmt(data.totals.debit)}</td>
                                        <td className="px-4 py-2.5 text-right">{fmt(data.totals.credit)}</td>
                                        <td className={`px-4 py-2.5 text-right ${data.totals.balanced ? 'text-green-600' : 'text-red-600'}`}>{fmt(data.totals.debit - data.totals.credit)}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </Card>
                    )}

                    {tab === 'journals' && (
                        <Card className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-gray-50"><tr className="text-left text-gray-500">
                                    <th className="px-4 py-3 font-medium">Entry #</th>
                                    <th className="px-4 py-3 font-medium">Date</th>
                                    <th className="px-4 py-3 font-medium">Description</th>
                                    <th className="px-4 py-3 font-medium">Ref</th>
                                    <th className="px-4 py-3 font-medium text-right">Amount</th>
                                    <th className="px-4 py-3 font-medium">Flags</th>
                                </tr></thead>
                                <tbody>
                                    {data.journalListing.map((e: any) => (
                                        <tr key={e.id} className="border-t hover:bg-gray-50">
                                            <td className="px-4 py-2.5 font-mono text-xs">{e.entryNumber || '—'}</td>
                                            <td className="px-4 py-2.5 text-gray-600">{new Date(e.date).toLocaleDateString()}</td>
                                            <td className="px-4 py-2.5 max-w-xs truncate">{e.description}</td>
                                            <td className="px-4 py-2.5 text-xs text-gray-500">{e.reference || '—'}</td>
                                            <td className="px-4 py-2.5 text-right font-mono text-xs">{fmt(e.totalDebit)}</td>
                                            <td className="px-4 py-2.5 flex gap-1">
                                                {e.isBackdated && <span className="text-xs bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded">Backdated</span>}
                                                {e.isManual && <span className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">Manual</span>}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </Card>
                    )}

                    {tab === 'gaps' && (
                        <Card className="p-5 space-y-4">
                            <div>
                                <h3 className="font-semibold mb-2 text-gray-900">Sequence Gaps</h3>
                                {data.sequenceGaps.gaps.length === 0 ? (
                                    <p className="text-green-600 flex items-center gap-2"><PiCheckCircle /> No gaps found</p>
                                ) : (
                                    <p className="text-red-600"><PiWarning className="inline mr-1" />Missing numbers: {data.sequenceGaps.gaps.join(', ')}</p>
                                )}
                            </div>
                            <div>
                                <h3 className="font-semibold mb-2 text-gray-900">Duplicates</h3>
                                {data.sequenceGaps.duplicates.length === 0 ? (
                                    <p className="text-green-600 flex items-center gap-2"><PiCheckCircle /> No duplicates</p>
                                ) : (
                                    <p className="text-red-600"><PiWarning className="inline mr-1" />Duplicate numbers: {data.sequenceGaps.duplicates.join(', ')}</p>
                                )}
                            </div>
                        </Card>
                    )}

                    {tab === 'exceptions' && (
                        <div className="space-y-4">
                            {[
                                { title: 'Backdated Entries', items: data.exceptions.backdated, color: 'orange' },
                                { title: 'Manual Journals', items: data.exceptions.manualJournals, color: 'purple' },
                                { title: 'Missing Entry Numbers', items: data.exceptions.missingNumbers, color: 'red' }
                            ].map(({ title, items, color }) => (
                                <Card key={title} className="p-5">
                                    <h3 className="font-semibold mb-3 text-gray-900">{title} <span className={`text-${color}-600`}>({items.length})</span></h3>
                                    {items.length === 0 ? <p className="text-green-600 text-sm flex items-center gap-2"><PiCheckCircle /> None found</p> : (
                                        <div className="space-y-1 text-sm">
                                            {items.map((e: any) => (
                                                <div key={e.id} className="flex gap-4 py-1 border-b last:border-0">
                                                    <span className="font-mono text-xs text-gray-500 w-24">{e.entryNumber || '—'}</span>
                                                    <span className="text-gray-500 w-24">{new Date(e.date).toLocaleDateString()}</span>
                                                    <span className="flex-1 truncate">{e.description}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </Card>
                            ))}
                        </div>
                    )}

                    {tab === 'orphans' && (
                        <div className="space-y-4">
                            <Card className="p-5">
                                <h3 className="font-semibold mb-3 text-gray-900">Paid Expenses without Posting ({data.orphanedDocuments.expenses.length})</h3>
                                {data.orphanedDocuments.expenses.length === 0 ? <p className="text-green-600 text-sm flex items-center gap-2"><PiCheckCircle /> None found</p> : (
                                    <table className="w-full text-sm"><tbody>
                                        {data.orphanedDocuments.expenses.map((e: any) => (
                                            <tr key={e.id} className="border-b last:border-0"><td className="py-1.5 flex-1">{e.title}</td><td className="py-1.5 text-right">{fmt(e.amount)}</td></tr>
                                        ))}
                                    </tbody></table>
                                )}
                            </Card>
                            <Card className="p-5">
                                <h3 className="font-semibold mb-3 text-gray-900">Paid Invoices without Posting ({data.orphanedDocuments.invoices.length})</h3>
                                {data.orphanedDocuments.invoices.length === 0 ? <p className="text-green-600 text-sm flex items-center gap-2"><PiCheckCircle /> None found</p> : (
                                    <table className="w-full text-sm"><tbody>
                                        {data.orphanedDocuments.invoices.map((i: any) => (
                                            <tr key={i.id} className="border-b last:border-0"><td className="py-1.5 flex-1 font-mono text-xs">{i.invoiceNumber}</td><td className="py-1.5 text-right">{fmt(Number(i.amount))}</td></tr>
                                        ))}
                                    </tbody></table>
                                )}
                            </Card>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
