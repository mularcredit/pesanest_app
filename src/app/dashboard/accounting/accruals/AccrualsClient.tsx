'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { useToast } from '@/components/ui/ToastProvider';
import { useRouter } from 'next/navigation';
import { PiPlus, PiPlay, PiCalendarBlank, PiCheckCircle, PiClock } from 'react-icons/pi';

const TYPE_LABELS: Record<string, string> = {
    ACCRUAL: 'Accrual',
    PREPAYMENT: 'Prepayment',
    DEFERRED_INCOME: 'Deferred Income'
};

const STATUS_COLORS: Record<string, string> = {
    ACTIVE: 'bg-blue-100 text-blue-700',
    COMPLETED: 'bg-green-100 text-green-700',
    CANCELLED: 'bg-red-100 text-red-700'
};

export function AccrualsClient({ schedules, accounts }: { schedules: any[]; accounts: any[] }) {
    const router = useRouter();
    const { showToast } = useToast();
    const [showForm, setShowForm] = useState(false);
    const [loading, setLoading] = useState(false);
    const [runningId, setRunningId] = useState<string | null>(null);
    const [form, setForm] = useState({
        name: '', type: 'ACCRUAL', totalAmount: '', debitAccountId: '',
        creditAccountId: '', startDate: '', periods: '12', periodType: 'MONTHLY', sourceRef: ''
    });

    const fmt = (n: number) => new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', minimumFractionDigits: 2 }).format(n);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const res = await fetch('/api/accounting/accruals', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...form, totalAmount: Number(form.totalAmount), periods: Number(form.periods) })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            showToast('Accrual schedule created', 'success');
            setShowForm(false);
            router.refresh();
        } catch (err: any) {
            showToast(err.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleRun = async (id: string) => {
        setRunningId(id);
        try {
            const res = await fetch(`/api/accounting/accruals/${id}/run`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            showToast(`Posted ${data.posted} recognition(s). ${data.remaining} remaining.`, 'success');
            router.refresh();
        } catch (err: any) {
            showToast(err.message, 'error');
        } finally {
            setRunningId(null);
        }
    };

    const accountOptions = accounts.map(a => ({ value: a.id, label: `${a.code} — ${a.name}` }));

    return (
        <div className="space-y-6">
            <div className="flex justify-end">
                <Button onClick={() => setShowForm(v => !v)}>
                    <PiPlus className="mr-2" /> New Schedule
                </Button>
            </div>

            {showForm && (
                <Card className="p-6">
                    <h2 className="text-lg font-semibold mb-4">New Accrual Schedule</h2>
                    <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                            <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required placeholder="e.g. Insurance prepayment Q1" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                            <Select value={form.type} onChange={v => setForm(f => ({ ...f, type: v }))}
                                options={[{ value: 'ACCRUAL', label: 'Accrual' }, { value: 'PREPAYMENT', label: 'Prepayment' }, { value: 'DEFERRED_INCOME', label: 'Deferred Income' }]} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Total Amount (KES)</label>
                            <Input type="number" step="0.01" value={form.totalAmount} onChange={e => setForm(f => ({ ...f, totalAmount: e.target.value }))} required />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Debit Account</label>
                            <Select value={form.debitAccountId} onChange={v => setForm(f => ({ ...f, debitAccountId: v }))} options={[{ value: '', label: 'Select account…' }, ...accountOptions]} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Credit Account</label>
                            <Select value={form.creditAccountId} onChange={v => setForm(f => ({ ...f, creditAccountId: v }))} options={[{ value: '', label: 'Select account…' }, ...accountOptions]} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                            <Input type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} required />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Periods</label>
                            <Input type="number" min="1" value={form.periods} onChange={e => setForm(f => ({ ...f, periods: e.target.value }))} required />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Frequency</label>
                            <Select value={form.periodType} onChange={v => setForm(f => ({ ...f, periodType: v }))}
                                options={[{ value: 'MONTHLY', label: 'Monthly' }, { value: 'QUARTERLY', label: 'Quarterly' }, { value: 'WEEKLY', label: 'Weekly' }]} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Source Reference (optional)</label>
                            <Input value={form.sourceRef} onChange={e => setForm(f => ({ ...f, sourceRef: e.target.value }))} placeholder="Invoice #, contract #…" />
                        </div>
                        <div className="md:col-span-2 flex gap-3 pt-2">
                            <Button type="submit" disabled={loading}>{loading ? 'Creating…' : 'Create Schedule'}</Button>
                            <Button type="button" variant="secondary" onClick={() => setShowForm(false)}>Cancel</Button>
                        </div>
                    </form>
                </Card>
            )}

            <div className="space-y-4">
                {schedules.length === 0 && (
                    <Card className="p-8 text-center text-gray-500">No accrual schedules yet.</Card>
                )}
                {schedules.map((s: any) => {
                    const posted = s.recognitions.filter((r: any) => r.status === 'POSTED').length;
                    const pending = s.recognitions.filter((r: any) => r.status === 'PENDING').length;
                    return (
                        <Card key={s.id} className="p-5">
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-3 flex-wrap">
                                        <span className="font-semibold text-gray-900">{s.name}</span>
                                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[s.status] || ''}`}>{s.status}</span>
                                        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{TYPE_LABELS[s.type] || s.type}</span>
                                    </div>
                                    <div className="mt-1 text-sm text-gray-600 flex flex-wrap gap-x-4 gap-y-1">
                                        <span>Total: <strong>{fmt(Number(s.totalAmount))}</strong></span>
                                        <span>Dr: {s.debitAccount.code} {s.debitAccount.name}</span>
                                        <span>Cr: {s.creditAccount.code} {s.creditAccount.name}</span>
                                    </div>
                                    <div className="mt-2 flex gap-2 items-center text-xs text-gray-500 flex-wrap">
                                        <PiCalendarBlank className="shrink-0" />
                                        <span>Starts {new Date(s.startDate).toLocaleDateString()}</span>
                                        <span className="flex items-center gap-1"><PiCheckCircle /> {posted} posted</span>
                                        <span className="flex items-center gap-1"><PiClock /> {pending} pending</span>
                                    </div>
                                </div>
                                {s.status === 'ACTIVE' && pending > 0 && (
                                    <Button size="sm" onClick={() => handleRun(s.id)} disabled={runningId === s.id}>
                                        <PiPlay className="mr-1" /> {runningId === s.id ? 'Running…' : 'Run Due'}
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
