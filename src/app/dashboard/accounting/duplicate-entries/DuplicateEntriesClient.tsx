'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/ToastProvider';
import { PiCheckCircle, PiWarning, PiTrash } from 'react-icons/pi';
import type { DuplicateGroup } from '@/lib/accounting/duplicate-detection';

const fmt = (n: number) => new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(n);
const fmtDate = (d: Date | string) => new Date(d).toLocaleString('en-KE');

export function DuplicateEntriesClient({ highConfidence, needsReview }: { highConfidence: DuplicateGroup[]; needsReview: DuplicateGroup[] }) {
    const router = useRouter();
    const { showToast } = useToast();
    const [voidingId, setVoidingId] = useState<string | null>(null);

    const voidEntry = async (entryId: string, reason: string) => {
        const res = await fetch('/api/accounting/journal', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'VOID', entryId, reason }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to void entry');
        return data;
    };

    const handleVoidOne = async (entryId: string, entryNumber: string | null, keepEntryNumber: string | null) => {
        setVoidingId(entryId);
        try {
            await voidEntry(entryId, `Duplicate posting — same source document already posted as ${keepEntryNumber || 'an earlier entry'}`);
            showToast(`${entryNumber || 'Entry'} voided`, 'success');
            router.refresh();
        } catch (err: any) {
            showToast(err.message, 'error');
        } finally {
            setVoidingId(null);
        }
    };

    const handleVoidGroup = async (group: DuplicateGroup) => {
        if (!group.voidCandidateIds?.length) return;
        setVoidingId(group.key);
        const keepEntry = group.entries.find(e => e.id === group.keepId);
        try {
            for (const id of group.voidCandidateIds) {
                const dup = group.entries.find(e => e.id === id);
                await voidEntry(id, `Duplicate posting — same source document already posted as ${keepEntry?.entryNumber || 'an earlier entry'}`);
            }
            showToast(`Voided ${group.voidCandidateIds.length} duplicate${group.voidCandidateIds.length !== 1 ? 's' : ''}`, 'success');
            router.refresh();
        } catch (err: any) {
            showToast(err.message, 'error');
        } finally {
            setVoidingId(null);
        }
    };

    const totalHighConfidenceExtra = highConfidence.reduce((s, g) => s + g.amount * (g.entries.length - 1), 0);

    return (
        <div className="space-y-10">
            <section className="space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-gray-900">Confirmed duplicates</h2>
                    {highConfidence.length > 0 && (
                        <span className="text-sm text-gray-500">
                            {highConfidence.length} group{highConfidence.length !== 1 ? 's' : ''} · {fmt(totalHighConfidenceExtra)} overstated
                        </span>
                    )}
                </div>
                <p className="text-sm text-gray-500 -mt-2">
                    Same requisition, asset, or expense referenced by more than one posted entry. Safe to void — the earliest posting is kept.
                </p>

                {highConfidence.length === 0 ? (
                    <Card className="p-8 text-center">
                        <PiCheckCircle className="mx-auto text-4xl text-green-500 mb-2" />
                        <p className="text-gray-600 font-medium">No confirmed duplicates found.</p>
                    </Card>
                ) : (
                    highConfidence.map(group => (
                        <Card key={group.key} className="overflow-hidden">
                            <div className="p-4 flex items-start justify-between gap-4 border-b bg-red-50/50">
                                <div>
                                    <span className="font-semibold text-gray-900">{group.description}</span>
                                    <div className="text-sm text-gray-500 mt-1">
                                        {fmt(group.amount)} × {group.entries.length} postings ·{' '}
                                        <span className="text-red-600 font-medium">{fmt(group.amount * (group.entries.length - 1))} overstated</span>
                                    </div>
                                </div>
                                <Button
                                    size="sm"
                                    variant="destructive"
                                    onClick={() => handleVoidGroup(group)}
                                    disabled={voidingId === group.key}
                                >
                                    <PiTrash className="mr-1" />
                                    {voidingId === group.key ? 'Voiding…' : `Void ${group.voidCandidateIds?.length} duplicate${group.voidCandidateIds!.length !== 1 ? 's' : ''}`}
                                </Button>
                            </div>
                            <table className="w-full text-sm">
                                <tbody>
                                    {group.entries.map(entry => {
                                        const isKeep = entry.id === group.keepId;
                                        return (
                                            <tr key={entry.id} className="border-t">
                                                <td className="py-2 px-4 font-mono text-xs">{entry.entryNumber}</td>
                                                <td className="py-2 px-4 text-gray-500">{entry.reference}</td>
                                                <td className="py-2 px-4 text-gray-500">Date: {new Date(entry.date).toLocaleDateString()}</td>
                                                <td className="py-2 px-4 text-gray-400">Posted: {fmtDate(entry.createdAt)}</td>
                                                <td className="py-2 px-4 text-right w-40">
                                                    {isKeep ? (
                                                        <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">Kept (earliest)</span>
                                                    ) : (
                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            onClick={() => handleVoidOne(entry.id, entry.entryNumber, group.entries.find(e => e.id === group.keepId)?.entryNumber ?? null)}
                                                            disabled={voidingId === entry.id || voidingId === group.key}
                                                        >
                                                            {voidingId === entry.id ? 'Voiding…' : 'Void'}
                                                        </Button>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </Card>
                    ))
                )}
            </section>

            <section className="space-y-4">
                <h2 className="text-lg font-semibold text-gray-900">Needs manual review</h2>
                <p className="text-sm text-gray-500 -mt-2">
                    Same amount, description, and GL accounts, but no shared source reference — could be a duplicate, or just two
                    separate transactions that happen to match (e.g. two airtime top-ups). Compare the underlying requisition or expense
                    before voiding anything here; nothing in this section is auto-actionable.
                </p>

                {needsReview.length === 0 ? (
                    <Card className="p-6 text-center text-gray-500 text-sm">Nothing flagged for review.</Card>
                ) : (
                    needsReview.map(group => (
                        <Card key={group.key} className="overflow-hidden">
                            <div className="p-4 border-b bg-yellow-50/50 flex items-center gap-2">
                                <PiWarning className="text-yellow-600 shrink-0" />
                                <div>
                                    <span className="font-semibold text-gray-900">{group.description}</span>
                                    <span className="text-sm text-gray-500 ml-2">{fmt(group.amount)} × {group.entries.length}</span>
                                </div>
                            </div>
                            <table className="w-full text-sm">
                                <tbody>
                                    {group.entries.map(entry => (
                                        <tr key={entry.id} className="border-t">
                                            <td className="py-2 px-4 font-mono text-xs">{entry.entryNumber}</td>
                                            <td className="py-2 px-4 text-gray-500">{entry.reference || '—'}</td>
                                            <td className="py-2 px-4 text-gray-500">Date: {new Date(entry.date).toLocaleDateString()}</td>
                                            <td className="py-2 px-4 text-gray-400">Posted: {fmtDate(entry.createdAt)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </Card>
                    ))
                )}
            </section>
        </div>
    );
}
