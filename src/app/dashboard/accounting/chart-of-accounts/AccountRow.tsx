'use client';

import { useState } from 'react';
import { useToast } from '@/components/ui/ToastProvider';
import { useRouter } from 'next/navigation';
import { PiPencil, PiArchive, PiArrowCounterClockwise, PiCheck, PiX, PiSpinner, PiCheckSquare, PiSquare } from 'react-icons/pi';
import { SUBTYPE_SUGGESTIONS } from './AccountsTableClient';

const HAIRLINE = '1px solid rgba(0,0,0,0.07)';

export function AccountRow({ account, isLast, isSelected, onToggle }: {
    account: any;
    isLast?: boolean;
    isSelected?: boolean;
    onToggle?: () => void;
}) {
    const router = useRouter();
    const { showToast } = useToast();
    const [editing, setEditing]   = useState(false);
    const [name, setName]         = useState(account.name);
    const [subtype, setSubtype]   = useState(account.subtype || '');
    const [loading, setLoading]   = useState(false);

    const subtypeSuggestions = SUBTYPE_SUGGESTIONS[account.type] ?? [];
    const listId = `subtype-list-${account.id}`;

    const save = async () => {
        const nameChanged    = name.trim() && name !== account.name;
        const subtypeChanged = subtype !== (account.subtype || '');
        if (!nameChanged && !subtypeChanged) { setEditing(false); return; }
        setLoading(true);
        try {
            const body: Record<string, string> = {};
            if (nameChanged)    body.name    = name;
            if (subtypeChanged) body.subtype = subtype;
            const res = await fetch(`/api/accounting/accounts/${account.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            showToast('Account updated', 'success');
            setEditing(false);
            router.refresh();
        } catch (err: any) {
            showToast(err.message, 'error');
        } finally { setLoading(false); }
    };

    const cancel = () => { setEditing(false); setName(account.name); setSubtype(account.subtype || ''); };

    const handleKey = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') save();
        if (e.key === 'Escape') cancel();
    };

    const toggleArchive = async () => {
        if (!account.isArchived) {
            const ok = confirm(`Archive "${account.name}"? It will be hidden from posting but journal history is preserved.`);
            if (!ok) return;
        }
        setLoading(true);
        try {
            const res = await fetch(`/api/accounting/accounts/${account.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ isArchived: !account.isArchived, force: true }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            showToast(`Account ${account.isArchived ? 'restored' : 'archived'}`, 'success');
            router.refresh();
        } catch (err: any) {
            showToast(err.message, 'error');
        } finally { setLoading(false); }
    };

    const statusBadge = account.isArchived ? (
        <span className="inline-flex items-center gap-1 text-[10px] font-[600] px-2 py-0.5 rounded-full"
            style={{ background: 'rgba(107,114,128,0.08)', color: '#9ca3af' }}>
            <span className="w-[5px] h-[5px] rounded-full bg-gray-300 shrink-0" />
            Archived
        </span>
    ) : account.isActive ? (
        <span className="inline-flex items-center gap-1 text-[10px] font-[600] px-2 py-0.5 rounded-full"
            style={{ background: 'rgba(5,150,105,0.08)', color: '#059669' }}>
            <span className="w-[5px] h-[5px] rounded-full bg-emerald-500 shrink-0" />
            Active
        </span>
    ) : (
        <span className="inline-flex items-center gap-1 text-[10px] font-[600] px-2 py-0.5 rounded-full"
            style={{ background: 'rgba(0,0,0,0.05)', color: '#6b7280' }}>
            <span className="w-[5px] h-[5px] rounded-full bg-gray-400 shrink-0" />
            Inactive
        </span>
    );

    return (
        <div
            className={`grid items-center px-5 py-3 hover:bg-gray-50/40 transition-colors group ${account.isArchived ? 'opacity-50' : ''} ${isSelected ? 'bg-indigo-50/40' : ''}`}
            style={{
                gridTemplateColumns: '32px 80px 1fr 180px 90px 72px',
                borderTop: isLast === false || !isLast ? HAIRLINE : undefined,
            }}>

            {/* Checkbox */}
            <button
                onClick={onToggle}
                className="text-[15px] transition-colors shrink-0"
                style={{ color: isSelected ? '#6366F1' : 'rgba(0,0,0,0.15)' }}>
                {isSelected ? <PiCheckSquare /> : <PiSquare />}
            </button>

            {/* Code */}
            <p className="text-[12px] font-mono font-[600] text-gray-400 group-hover:text-[#6366F1] transition-colors">
                {account.code}
            </p>

            {/* Name — editable */}
            <div className="min-w-0 pr-4">
                {editing ? (
                    <input
                        className="w-full rounded-[6px] px-3 py-1.5 text-[12.5px] text-gray-900 outline-none focus:ring-2 focus:ring-[#6366F1]/20 transition-all bg-white"
                        style={{ border: HAIRLINE }}
                        value={name}
                        onChange={e => setName(e.target.value)}
                        onKeyDown={handleKey}
                        autoFocus
                    />
                ) : (
                    <p className="text-[12.5px] font-[500] text-gray-900 truncate">{account.name}</p>
                )}
            </div>

            {/* Subtype — combo input (free text + suggestions) */}
            {editing ? (
                <>
                    <input
                        list={listId}
                        value={subtype}
                        onChange={e => setSubtype(e.target.value)}
                        placeholder="e.g. Current Asset"
                        className="w-full rounded-[6px] px-3 py-1.5 text-[11.5px] text-gray-700 outline-none focus:ring-2 focus:ring-[#6366F1]/20 bg-white"
                        style={{ border: HAIRLINE }}
                    />
                    <datalist id={listId}>
                        {subtypeSuggestions.map(s => <option key={s} value={s} />)}
                    </datalist>
                </>
            ) : (
                <p className="text-[11px] font-[500] text-gray-400 truncate">
                    {account.subtype ? account.subtype.replace(/_/g, ' ') : '—'}
                </p>
            )}

            {/* Status */}
            <div className="flex justify-center">
                {statusBadge}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1 justify-end">
                {loading ? (
                    <PiSpinner className="animate-spin text-[14px] text-gray-400" />
                ) : editing ? (
                    <>
                        <button onClick={save}
                            className="w-[26px] h-[26px] flex items-center justify-center rounded-[5px] text-emerald-500 hover:text-emerald-700 hover:bg-emerald-50 transition-colors"
                            style={{ border: HAIRLINE }}
                            title="Save">
                            <PiCheck className="text-[12px]" />
                        </button>
                        <button onClick={cancel}
                            className="w-[26px] h-[26px] flex items-center justify-center rounded-[5px] text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                            style={{ border: HAIRLINE }}
                            title="Cancel">
                            <PiX className="text-[12px]" />
                        </button>
                    </>
                ) : (
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => setEditing(true)}
                            className="w-[26px] h-[26px] flex items-center justify-center rounded-[5px] text-gray-400 hover:text-[#6366F1] hover:bg-indigo-50 transition-colors"
                            style={{ border: HAIRLINE }}
                            title="Edit name">
                            <PiPencil className="text-[12px]" />
                        </button>
                        <button onClick={toggleArchive}
                            className={`w-[26px] h-[26px] flex items-center justify-center rounded-[5px] transition-colors
                                ${account.isArchived
                                    ? 'text-emerald-400 hover:text-emerald-600 hover:bg-emerald-50'
                                    : 'text-gray-400 hover:text-amber-500 hover:bg-amber-50'}`}
                            style={{ border: HAIRLINE }}
                            title={account.isArchived ? 'Restore' : 'Archive'}>
                            {account.isArchived
                                ? <PiArrowCounterClockwise className="text-[12px]" />
                                : <PiArchive className="text-[12px]" />}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
