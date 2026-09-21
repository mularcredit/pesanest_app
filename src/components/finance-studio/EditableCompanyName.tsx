"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";

interface EditableCompanyNameProps {
    value: string;
    className?: string;
}

// Same fetch/save mechanics as EditableImage.tsx, but for the company_name
// text setting instead of a logo file — click to edit, save posts straight
// to /api/settings (the same endpoint EditableImage already uses), then
// refresh so the server-rendered page picks up the new value everywhere.
export function EditableCompanyName({ value, className }: EditableCompanyNameProps) {
    const router = useRouter();
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState(value);
    const [saving, setSaving] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => { setDraft(value); }, [value]);
    useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);

    const handleSave = async () => {
        const trimmed = draft.trim();
        if (!trimmed || trimmed === value) { setEditing(false); setDraft(value); return; }
        setSaving(true);
        try {
            const res = await fetch('/api/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ updates: [{ key: 'company_name', value: trimmed }] }),
            });
            if (!res.ok) throw new Error('Failed to save');
            setEditing(false);
            router.refresh();
        } catch {
            alert('Failed to update company name. Please try again.');
            setDraft(value);
        } finally {
            setSaving(false);
        }
    };

    if (editing) {
        return (
            <input
                ref={inputRef}
                value={draft}
                onChange={e => setDraft(e.target.value)}
                onBlur={handleSave}
                onKeyDown={e => {
                    if (e.key === 'Enter') { e.preventDefault(); handleSave(); }
                    if (e.key === 'Escape') { setDraft(value); setEditing(false); }
                }}
                disabled={saving}
                className={`${className} bg-white outline-none ring-1 ring-[#6366F1] rounded-[4px] px-1 disabled:opacity-50 print:hidden`}
            />
        );
    }

    return (
        <span
            onClick={() => setEditing(true)}
            title="Click to edit company name"
            className={`${className} cursor-pointer hover:bg-gray-50 rounded-[4px] px-1 -mx-1 transition-colors print:cursor-auto`}
        >
            {value}
        </span>
    );
}
