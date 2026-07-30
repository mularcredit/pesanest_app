'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { useToast } from '@/components/ui/ToastProvider';
import { useRouter } from 'next/navigation';
import { PiPlus, PiPlay, PiCalendarBlank, PiTrash, PiMinus } from 'react-icons/pi';

const FREQ_LABELS: Record<string, string> = { WEEKLY: 'Weekly', MONTHLY: 'Monthly', QUARTERLY: 'Quarterly', ANNUALLY: 'Annually' };

export function RecurringJournalsClient({ templates, accounts }: { templates: any[]; accounts: any[] }) {
    const router = useRouter();
    const { showToast } = useToast();
    const [showForm, setShowForm] = useState(false);
    const [loading, setLoading] = useState(false);
    const [runningId, setRunningId] = useState<string | null>(null);
    const [form, setForm] = useState({ name: '', description: '', frequency: 'MONTHLY', nextRunDate: '', endDate: '' });
    const [lines, setLines] = useState([{ accountId: '', description: '', debit: '', credit: '' }, { accountId: '', description: '', debit: '', credit: '' }]);

    const accountOptions = accounts.map(a => ({ value: a.id, label: `${a.code} — ${a.name}` }));
    const fmt = (n: number) => new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(n);

    const addLine = () => setLines(l => [...l, { accountId: '', description: '', debit: '', credit: '' }]);
    const removeLine = (i: number) => setLines(l => l.filter((_, idx) => idx !== i));
    const updateLine = (i: number, field: string, val: string) => setLines(l => l.map((line, idx) => idx === i ? { ...line, [field]: val } : line));

    const totalDebits = lines.reduce((s, l) => s + Number(l.debit || 0), 0);
    const totalCredits = lines.reduce((s, l) => s + Number(l.credit || 0), 0);
    const balanced = Math.abs(totalDebits - totalCredits) < 0.001;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!balanced) { showToast('Journal lines do not balance', 'error'); return; }
        setLoading(true);
        try {
            const res = await fetch('/api/accounting/recurring-journals', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...form, lines: lines.map(l => ({ ...l, debit: Number(l.debit || 0), credit: Number(l.credit || 0) })) })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            showToast('Recurring journal created', 'success');
            setShowForm(false);
            router.refresh();
        } catch (err: any) {
            showToast(err.message, 'error');
        } finally { setLoading(false); }
    };

    const handleRun = async (id: string) => {
        setRunningId(id);
        try {
            const res = await fetch(`/api/accounting/recurring-journals/${id}/run`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            if (data.skipped) { showToast(data.message, 'error'); return; }
            showToast(`Posted entry ${data.entryNumber}. Next run: ${new Date(data.nextRunDate).toLocaleDateString()}`, 'success');
            router.refresh();
        } catch (err: any) {
            showToast(err.message, 'error');
        } finally { setRunningId(null); }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-end">
                <Button onClick={() => setShowForm(v => !v)}><PiPlus className="mr-2" /> New Template</Button>
            </div>

            {showForm && (
                <Card className="p-6 space-y-4">
                    <h2 className="text-lg font-semibold">New Recurring Journal</h2>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                                <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required placeholder="e.g. Monthly rent" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Frequency</label>
                                <Select value={form.frequency} onChange={v => setForm(f => ({ ...f, frequency: v }))}
                                    options={Object.entries(FREQ_LABELS).map(([v, l]) => ({ value: v, label: l }))} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">First Run Date</label>
                                <Input type="date" value={form.nextRunDate} onChange={e => setForm(f => ({ ...f, nextRunDate: e.target.value }))} required />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">End Date (optional)</label>
                                <Input type="date" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} />
                            </div>
                        </div>

                        <div>
                            <div className="flex justify-between items-center mb-2">
                                <label className="text-sm font-medium text-gray-700">Journal Lines</label>
                                <Button type="button" size="sm" variant="secondary" onClick={addLine}><PiPlus className="mr-1" /> Add Line</Button>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead><tr className="text-left text-gray-500">
                                        <th className="pb-2 pr-2 font-medium">Account</th>
                                        <th className="pb-2 pr-2 font-medium">Description</th>
                                        <th className="pb-2 pr-2 font-medium w-28">Debit</th>
                                        <th className="pb-2 pr-2 font-medium w-28">Credit</th>
                                        <th className="pb-2 w-8" />
                                    </tr></thead>
                                    <tbody>
                                        {lines.map((line, i) => (
                                            <tr key={i}>
                                                <td className="pr-2 pb-2">
                                                    <Select value={line.accountId} onChange={v => updateLine(i, 'accountId', v)}
                                                        options={[{ value: '', label: 'Select…' }, ...accountOptions]} />
                                                </td>
                                                <td className="pr-2 pb-2"><Input value={line.description} onChange={e => updateLine(i, 'description', e.target.value)} placeholder="Optional" /></td>
                                                <td className="pr-2 pb-2"><Input type="number" step="0.01" min="0" value={line.debit} onChange={e => updateLine(i, 'debit', e.target.value)} /></td>
                                                <td className="pr-2 pb-2"><Input type="number" step="0.01" min="0" value={line.credit} onChange={e => updateLine(i, 'credit', e.target.value)} /></td>
                                                <td className="pb-2">
                                                    {lines.length > 2 && <button type="button" onClick={() => removeLine(i)} className="text-red-400 hover:text-red-600"><PiMinus /></button>}
                                                </td>
                                            </tr>
                                        ))}
                                        <tr className="border-t font-semibold">
                                            <td colSpan={2} className="pt-2 text-right text-gray-600 pr-2">Totals</td>
                                            <td className={`pt-2 pr-2 ${!balanced ? 'text-red-600' : 'text-green-600'}`}>{fmt(totalDebits)}</td>
                                            <td className={`pt-2 pr-2 ${!balanced ? 'text-red-600' : 'text-green-600'}`}>{fmt(totalCredits)}</td>
                                            <td />
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <Button type="submit" disabled={loading || !balanced}>{loading ? 'Creating…' : 'Create Template'}</Button>
                            <Button type="button" variant="secondary" onClick={() => setShowForm(false)}>Cancel</Button>
                        </div>
                    </form>
                </Card>
            )}

            <div className="space-y-4">
                {templates.length === 0 && <Card className="p-8 text-center text-gray-500">No recurring journal templates yet.</Card>}
                {templates.map((t: any) => {
                    const isDue = new Date(t.nextRunDate) <= new Date();
                    return (
                        <Card key={t.id} className="p-5">
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-3 flex-wrap">
                                        <span className="font-semibold text-gray-900">{t.name}</span>
                                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${t.isActive ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>{t.isActive ? 'Active' : 'Inactive'}</span>
                                        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{FREQ_LABELS[t.frequency]}</span>
                                    </div>
                                    {t.description && <p className="text-sm text-gray-500 mt-0.5">{t.description}</p>}
                                    <div className="mt-1 text-xs text-gray-500 flex gap-3 flex-wrap">
                                        <span className="flex items-center gap-1"><PiCalendarBlank /> Next: <strong className={isDue ? 'text-orange-600' : ''}>{new Date(t.nextRunDate).toLocaleDateString()}{isDue ? ' (due)' : ''}</strong></span>
                                        {t.endDate && <span>Ends: {new Date(t.endDate).toLocaleDateString()}</span>}
                                        <span>{t.lines.length} lines</span>
                                    </div>
                                </div>
                                {t.isActive && (
                                    <Button size="sm" onClick={() => handleRun(t.id)} disabled={runningId === t.id}>
                                        <PiPlay className="mr-1" /> {runningId === t.id ? 'Posting…' : 'Run Now'}
                                    </Button>
                                )}
                            </div>
                        </Card>
                    );
                })}
            </div>
        </div>
    );
}
