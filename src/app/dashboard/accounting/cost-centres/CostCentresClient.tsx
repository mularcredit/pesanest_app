'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useToast } from '@/components/ui/ToastProvider';
import { useRouter } from 'next/navigation';
import { PiPlus, PiPencil, PiTrash, PiCheckCircle, PiProhibit } from 'react-icons/pi';

export function CostCentresClient({ costCentres }: { costCentres: any[] }) {
    const router = useRouter();
    const { showToast } = useToast();
    const [showForm, setShowForm] = useState(false);
    const [loading, setLoading] = useState(false);
    const [editId, setEditId] = useState<string | null>(null);
    const [form, setForm] = useState({ code: '', name: '', description: '' });
    const [editForm, setEditForm] = useState<{ name: string; description: string }>({ name: '', description: '' });

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const res = await fetch('/api/accounting/cost-centres', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form)
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            showToast('Cost centre created', 'success');
            setShowForm(false);
            setForm({ code: '', name: '', description: '' });
            router.refresh();
        } catch (err: any) {
            showToast(err.message, 'error');
        } finally { setLoading(false); }
    };

    const handleUpdate = async (id: string) => {
        try {
            const res = await fetch(`/api/accounting/cost-centres/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(editForm)
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            showToast('Updated', 'success');
            setEditId(null);
            router.refresh();
        } catch (err: any) {
            showToast(err.message, 'error');
        }
    };

    const handleToggle = async (cc: any) => {
        try {
            const res = await fetch(`/api/accounting/cost-centres/${cc.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ isActive: !cc.isActive })
            });
            if (!res.ok) throw new Error((await res.json()).error);
            router.refresh();
        } catch (err: any) {
            showToast(err.message, 'error');
        }
    };

    const handleDelete = async (cc: any) => {
        if (cc._count.lines > 0) {
            showToast(`Cannot delete: ${cc._count.lines} journal line(s) tagged. Deactivate instead.`, 'error');
            return;
        }
        if (!confirm(`Delete cost centre "${cc.name}"?`)) return;
        try {
            const res = await fetch(`/api/accounting/cost-centres/${cc.id}`, { method: 'DELETE' });
            if (!res.ok) throw new Error((await res.json()).error);
            showToast('Deleted', 'success');
            router.refresh();
        } catch (err: any) {
            showToast(err.message, 'error');
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex justify-end">
                <Button onClick={() => setShowForm(v => !v)}><PiPlus className="mr-2" /> New Cost Centre</Button>
            </div>

            {showForm && (
                <Card className="p-5">
                    <h2 className="text-base font-semibold mb-4">New Cost Centre</h2>
                    <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Code</label>
                            <Input value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))} required placeholder="HQ" maxLength={10} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                            <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required placeholder="Headquarters" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Description (optional)</label>
                            <Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Optional description" />
                        </div>
                        <div className="md:col-span-3 flex gap-3">
                            <Button type="submit" disabled={loading}>{loading ? 'Creating…' : 'Create'}</Button>
                            <Button type="button" variant="secondary" onClick={() => setShowForm(false)}>Cancel</Button>
                        </div>
                    </form>
                </Card>
            )}

            <Card className="overflow-hidden">
                <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                        <tr className="text-left text-gray-500 text-xs font-medium uppercase tracking-wider">
                            <th className="px-5 py-3">Code</th>
                            <th className="px-5 py-3">Name</th>
                            <th className="px-5 py-3">Description</th>
                            <th className="px-5 py-3 text-right">Journal Lines</th>
                            <th className="px-5 py-3 text-right">Status</th>
                            <th className="px-5 py-3" />
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {costCentres.length === 0 && (
                            <tr><td colSpan={6} className="px-5 py-8 text-center text-gray-400">No cost centres yet.</td></tr>
                        )}
                        {costCentres.map((cc: any) => (
                            <tr key={cc.id} className="hover:bg-gray-50">
                                {editId === cc.id ? (
                                    <>
                                        <td className="px-5 py-3 font-mono text-xs text-gray-600">{cc.code}</td>
                                        <td className="px-5 py-3"><Input value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} /></td>
                                        <td className="px-5 py-3"><Input value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} /></td>
                                        <td className="px-5 py-3 text-right">{cc._count.lines.toLocaleString()}</td>
                                        <td />
                                        <td className="px-5 py-3 text-right flex gap-2 justify-end">
                                            <Button size="sm" onClick={() => handleUpdate(cc.id)}>Save</Button>
                                            <Button size="sm" variant="secondary" onClick={() => setEditId(null)}>Cancel</Button>
                                        </td>
                                    </>
                                ) : (
                                    <>
                                        <td className="px-5 py-3 font-mono font-semibold text-gray-500">{cc.code}</td>
                                        <td className="px-5 py-3 font-medium">{cc.name}</td>
                                        <td className="px-5 py-3 text-gray-500 text-xs">{cc.description || '—'}</td>
                                        <td className="px-5 py-3 text-right text-gray-600">{cc._count.lines.toLocaleString()}</td>
                                        <td className="px-5 py-3 text-right">
                                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cc.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                                                {cc.isActive ? 'Active' : 'Inactive'}
                                            </span>
                                        </td>
                                        <td className="px-5 py-3 text-right">
                                            <div className="flex gap-2 justify-end">
                                                <button onClick={() => { setEditId(cc.id); setEditForm({ name: cc.name, description: cc.description || '' }); }}
                                                    className="text-gray-400 hover:text-gray-700"><PiPencil /></button>
                                                <button onClick={() => handleToggle(cc)} className={`${cc.isActive ? 'text-orange-400 hover:text-orange-600' : 'text-green-400 hover:text-green-600'}`}>
                                                    {cc.isActive ? <PiProhibit /> : <PiCheckCircle />}
                                                </button>
                                                <button onClick={() => handleDelete(cc)} className="text-red-400 hover:text-red-600"><PiTrash /></button>
                                            </div>
                                        </td>
                                    </>
                                )}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </Card>
        </div>
    );
}
