'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/ToastProvider';
import { useRouter } from 'next/navigation';
import { PiCheckCircle, PiWarning, PiCaretDown, PiCaretUp } from 'react-icons/pi';

export function JournalApprovalsClient({ drafts }: { drafts: any[] }) {
    const router = useRouter();
    const { showToast } = useToast();
    const [approvingId, setApprovingId] = useState<string | null>(null);
    const [expandedId, setExpandedId] = useState<string | null>(null);

    const fmt = (n: number) => new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(n);

    const handleApprove = async (id: string) => {
        setApprovingId(id);
        try {
            const res = await fetch(`/api/accounting/journal/${id}/approve`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            showToast(`Entry ${data.entryNumber || id} approved and posted`, 'success');
            router.refresh();
        } catch (err: any) {
            showToast(err.message, 'error');
        } finally { setApprovingId(null); }
    };

    if (drafts.length === 0) {
        return (
            <Card className="p-8 text-center">
                <PiCheckCircle className="mx-auto text-4xl text-green-500 mb-2" />
                <p className="text-gray-600 font-medium">No journals pending approval.</p>
                <p className="text-gray-400 text-sm mt-1">All draft journals have been processed.</p>
            </Card>
        );
    }

    return (
        <div className="space-y-4">
            <p className="text-sm text-gray-500">{drafts.length} journal{drafts.length !== 1 ? 's' : ''} awaiting approval</p>
            {drafts.map((entry: any) => {
                const totalDebit = entry.lines.reduce((s: number, l: any) => s + l.debit, 0);
                const isExpanded = expandedId === entry.id;
                const isBackdated = (entry as any).isBackdated;

                return (
                    <Card key={entry.id} className="overflow-hidden">
                        <div className="p-4 flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-semibold text-gray-900">{entry.description}</span>
                                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${entry.status === 'DRAFT' ? 'bg-yellow-100 text-yellow-700' : 'bg-blue-100 text-blue-700'}`}>{entry.status}</span>
                                    {isBackdated && <span className="text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 flex items-center gap-1"><PiWarning />Backdated</span>}
                                </div>
                                <div className="mt-1 text-sm text-gray-500 flex gap-4 flex-wrap">
                                    <span>Date: <strong>{new Date(entry.date).toLocaleDateString()}</strong></span>
                                    <span>Amount: <strong>{fmt(totalDebit)}</strong></span>
                                    {entry.reference && <span>Ref: {entry.reference}</span>}
                                    <span className="text-gray-400">Created: {new Date(entry.createdAt).toLocaleDateString()}</span>
                                </div>
                            </div>
                            <div className="flex gap-2 shrink-0">
                                <button onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                                    className="text-sm text-gray-500 flex items-center gap-1 hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-100">
                                    {isExpanded ? <PiCaretUp /> : <PiCaretDown />} Lines
                                </button>
                                <Button size="sm" onClick={() => handleApprove(entry.id)} disabled={approvingId === entry.id}>
                                    <PiCheckCircle className="mr-1" /> {approvingId === entry.id ? 'Posting…' : 'Approve & Post'}
                                </Button>
                            </div>
                        </div>

                        {isExpanded && (
                            <div className="border-t bg-gray-50 px-4 py-3">
                                <table className="w-full text-sm">
                                    <thead><tr className="text-left text-gray-500">
                                        <th className="pb-2 pr-4 font-medium">Account</th>
                                        <th className="pb-2 pr-4 font-medium">Description</th>
                                        <th className="pb-2 pr-4 font-medium text-right">Debit</th>
                                        <th className="pb-2 font-medium text-right">Credit</th>
                                    </tr></thead>
                                    <tbody>
                                        {entry.lines.map((line: any) => (
                                            <tr key={line.id} className="border-t">
                                                <td className="py-1.5 pr-4 font-mono text-xs">{line.account.code} {line.account.name}</td>
                                                <td className="py-1.5 pr-4 text-gray-500">{line.description || '—'}</td>
                                                <td className="py-1.5 pr-4 text-right">{line.debit ? fmt(line.debit) : '—'}</td>
                                                <td className="py-1.5 text-right">{line.credit ? fmt(line.credit) : '—'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </Card>
                );
            })}
        </div>
    );
}
