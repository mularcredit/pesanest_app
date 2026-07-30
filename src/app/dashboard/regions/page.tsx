"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { PiGlobe, PiPlus, PiBuildings, PiUsers, PiPencil, PiX, PiSpinner } from "react-icons/pi";
import { cn } from "@/lib/utils";
import { CustomSelect } from "@/components/ui/CustomSelect";

interface Region {
    id: string; name: string; code: string; isActive: boolean;
    branches: { id: string; name: string; code: string }[];
}
interface User { id: string; name: string; email: string; role: string; }

const CARD_STYLE: React.CSSProperties = { border: '1px solid rgba(0,0,0,0.09)' };
const INPUT_CLS = "w-full rounded-[6px] px-3 py-[10px] text-[13px] text-gray-900 placeholder:text-gray-300 outline-none focus:ring-1 focus:ring-[#6366F1] transition-colors bg-white";
const INPUT_STYLE: React.CSSProperties = { border: '1px solid rgba(0,0,0,0.09)' };
const LABEL_CLS = "block text-[11.5px] font-[500] text-gray-400 mb-1.5";

export default function RegionsPage() {
    const [regions, setRegions] = useState<Region[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [mounted, setMounted] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState({ name: "", code: "", managerId: "" });

    useEffect(() => { setMounted(true); fetchData(); }, []);

    const fetchData = async () => {
        setLoading(true);
        const [rRes, uRes] = await Promise.all([fetch("/api/regions"), fetch("/api/team")]);
        if (rRes.ok) { const d = await rRes.json(); setRegions(d.regions || []); }
        if (uRes.ok) { const d = await uRes.json(); setUsers(d.users || d.members || []); }
        setLoading(false);
    };

    const saveRegion = async () => {
        if (!form.name || !form.code) return;
        setSaving(true);
        const res = await fetch("/api/regions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(form)
        });
        setSaving(false);
        if (res.ok) { setShowModal(false); setForm({ name: "", code: "", managerId: "" }); fetchData(); }
    };

    const modal = (mounted && showModal) ? createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/30" onClick={() => !saving && setShowModal(false)} />
            <div className="relative bg-white w-full max-w-md rounded-[12px] overflow-hidden"
                style={{ border: '1px solid rgba(0,0,0,0.09)', boxShadow: '0 8px 40px rgba(0,0,0,0.12)' }}>
                {/* Header */}
                <div className="px-6 py-4 flex items-center justify-between"
                    style={{ borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-[7px] bg-indigo-50 flex items-center justify-center shrink-0">
                            <PiGlobe className="text-[#6366F1] text-[15px]" />
                        </div>
                        <div>
                            <h2 className="text-[14px] font-[600] text-gray-900">New Region</h2>
                            <p className="text-[11.5px] text-gray-400 mt-0.5">Create a new geographic region</p>
                        </div>
                    </div>
                    <button onClick={() => setShowModal(false)}
                        className="p-1.5 rounded-[6px] text-gray-400 hover:bg-gray-50 hover:text-gray-700 transition-colors">
                        <PiX className="text-[16px]" />
                    </button>
                </div>

                {/* Body */}
                <div className="px-6 py-5 space-y-4">
                    <div>
                        <label className={LABEL_CLS}>Region Name <span className="text-rose-400">*</span></label>
                        <input value={form.name}
                            onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                            className={INPUT_CLS} style={INPUT_STYLE}
                            placeholder="e.g. East Africa" />
                    </div>
                    <div>
                        <label className={LABEL_CLS}>Region Code <span className="text-rose-400">*</span></label>
                        <input value={form.code}
                            onChange={e => setForm(p => ({ ...p, code: e.target.value.toUpperCase() }))}
                            className={INPUT_CLS + " font-mono"} style={INPUT_STYLE}
                            placeholder="e.g. EA" />
                    </div>
                    <div>
                        <label className={LABEL_CLS}>Regional Manager</label>
                        <CustomSelect
                            value={form.managerId}
                            onChange={val => setForm(p => ({ ...p, managerId: val }))}
                            options={users.map(u => ({ value: u.id, label: `${u.name} (${u.email})` }))}
                            placeholder="No manager assigned"
                            className={INPUT_CLS}
                            style={INPUT_STYLE}
                        />
                        <div className="mt-2 flex items-start gap-2 px-3 py-2 rounded-[6px]"
                            style={{ background: 'rgba(238,242,255,0.7)', border: '1px solid rgba(99,102,241,0.15)' }}>
                            <PiUsers className="text-[#6366F1] text-[13px] shrink-0 mt-0.5" />
                            <p className="text-[11.5px] text-[#6366F1]">
                                Assigning a manager will set their role to Regional Manager.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 flex gap-3" style={{ borderTop: '1px solid rgba(0,0,0,0.07)' }}>
                    <button onClick={() => setShowModal(false)} disabled={saving}
                        className="flex-1 px-4 py-2 rounded-[6px] text-[12.5px] font-[500] text-gray-600 bg-white hover:bg-gray-50 transition-colors"
                        style={CARD_STYLE}>
                        Cancel
                    </button>
                    <button onClick={saveRegion} disabled={saving || !form.name || !form.code}
                        className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 rounded-[6px] text-[12.5px] font-[500] text-white bg-[#6366F1] hover:bg-indigo-600 transition-colors disabled:opacity-50">
                        {saving ? <PiSpinner className="animate-spin text-[14px]" /> : null}
                        {saving ? "Creating..." : "Create Region"}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    ) : null;

    return (
        <div className="space-y-6 pb-24">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-[20px] font-[600] text-gray-900 tracking-tight">Regions</h1>
                    <p className="text-[12.5px] text-gray-400 mt-0.5">{regions.length} regions configured</p>
                </div>
                <button onClick={() => setShowModal(true)}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-[6px] text-[12.5px] font-[500] text-white bg-[#6366F1] hover:bg-indigo-600 transition-colors">
                    <PiPlus className="text-[14px]" /> New Region
                </button>
            </div>

            {loading ? (
                <div className="bg-white rounded-[8px] py-20 flex flex-col items-center" style={CARD_STYLE}>
                    <PiSpinner className="animate-spin text-[#6366F1] text-2xl mb-2" />
                    <p className="text-[12.5px] text-gray-400">Loading regions...</p>
                </div>
            ) : regions.length === 0 ? (
                <div className="bg-white rounded-[8px] py-20 flex flex-col items-center" style={CARD_STYLE}>
                    <div className="w-10 h-10 rounded-[8px] bg-gray-50 flex items-center justify-center mb-3"
                        style={{ border: '1px solid rgba(0,0,0,0.07)' }}>
                        <PiGlobe className="text-gray-300 text-xl" />
                    </div>
                    <p className="text-[13px] font-[500] text-gray-700">No regions configured yet</p>
                    <p className="text-[12px] text-gray-400 mt-0.5">Create your first region to organize branches.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {regions.map(r => (
                        <div key={r.id}
                            className="bg-white rounded-[8px] p-5 hover:bg-gray-50/50 transition-colors group cursor-pointer"
                            style={CARD_STYLE}>
                            <div className="flex items-start justify-between mb-4">
                                <div className="min-w-0">
                                    <span className="inline-block text-[10px] font-mono px-2 py-0.5 rounded-[4px] text-gray-500 bg-gray-100 tracking-wider mb-1.5"
                                        style={{ border: '1px solid rgba(0,0,0,0.09)' }}>
                                        {r.code}
                                    </span>
                                    <h3 className="text-[14px] font-[600] text-gray-900 group-hover:text-[#6366F1] transition-colors truncate">
                                        {r.name}
                                    </h3>
                                </div>
                                <button className="w-7 h-7 rounded-[6px] bg-gray-50 hover:bg-indigo-50 text-gray-400 hover:text-[#6366F1] flex items-center justify-center transition-colors opacity-0 group-hover:opacity-100 shrink-0 ml-2"
                                    style={{ border: '1px solid rgba(0,0,0,0.09)' }}>
                                    <PiPencil className="text-[13px]" />
                                </button>
                            </div>

                            <div className="flex items-center gap-2 text-[12.5px] text-gray-400">
                                <PiBuildings className="text-[13px] shrink-0" />
                                <span>{r.branches?.length || 0} branches</span>
                            </div>

                            {r.branches?.length > 0 && (
                                <div className="mt-4 pt-3 flex flex-wrap gap-1.5"
                                    style={{ borderTop: '1px solid rgba(0,0,0,0.07)' }}>
                                    {r.branches.slice(0, 4).map(b => (
                                        <span key={b.id}
                                            className="text-[10px] font-mono px-2 py-0.5 rounded-[4px] text-gray-500 bg-gray-50 tracking-wide"
                                            style={{ border: '1px solid rgba(0,0,0,0.09)' }}>
                                            {b.code}
                                        </span>
                                    ))}
                                    {r.branches.length > 4 && (
                                        <span className="text-[10px] font-[500] px-2 py-0.5 rounded-[4px] text-gray-400 bg-gray-100"
                                            style={{ border: '1px solid rgba(0,0,0,0.09)' }}>
                                            +{r.branches.length - 4}
                                        </span>
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {modal}
        </div>
    );
}
