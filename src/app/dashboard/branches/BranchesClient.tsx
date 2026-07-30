"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import {
    PiBuildings, PiPlus, PiPencil, PiTrash, PiMapPin, PiUsers,
    PiCheck, PiX, PiSpinner, PiUploadSimple, PiClock, PiWarningCircle,
    PiArrowRight,
} from "react-icons/pi";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/ToastProvider";
import { CustomSelect } from "@/components/ui/CustomSelect";

interface Region { id: string; name: string; code: string; branches: any[]; }
interface Branch {
    id: string; name: string; code: string; address?: string;
    regionId: string; teamLeaderId?: string; isActive: boolean;
    region: Region; teamLeader?: { id: string; name: string; email: string };
    wallet?: { balance: number; currency: string };
}
interface User { id: string; name: string; email: string; role: string; }

const CARD_STYLE: React.CSSProperties = { border: '1px solid rgba(0,0,0,0.09)' };
const INPUT_CLS = "w-full rounded-[6px] px-3 py-[10px] text-[13px] text-gray-900 placeholder:text-gray-300 outline-none focus:ring-1 focus:ring-[#6366F1] transition-colors bg-white";
const INPUT_STYLE: React.CSSProperties = { border: '1px solid rgba(0,0,0,0.09)' };
const LABEL_CLS = "block text-[11.5px] font-[500] text-gray-400 mb-1.5";

export default function BranchesClient() {
    const router = useRouter();
    const { showToast } = useToast();
    const [mounted, setMounted] = useState(false);
    const [branches, setBranches] = useState<Branch[]>([]);
    const [regions, setRegions] = useState<Region[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [showBulkModal, setShowBulkModal] = useState(false);
    const [editBranch, setEditBranch] = useState<Branch | null>(null);
    const [saving, setSaving] = useState(false);
    const [activeRegion, setActiveRegion] = useState<string>("all");
    const [form, setForm] = useState({ name: "", code: "", address: "", regionId: "", teamLeaderId: "" });
    const [bulkText, setBulkText] = useState("");
    const [bulkError, setBulkError] = useState("");

    useEffect(() => { setMounted(true); fetchData(); }, []);

    const fetchData = async () => {
        setLoading(true);
        const [bRes, rRes, uRes] = await Promise.all([
            fetch("/api/branches"), fetch("/api/regions"), fetch("/api/team")
        ]);
        if (bRes.ok) { const d = await bRes.json(); setBranches(d.branches || []); }
        if (rRes.ok) { const d = await rRes.json(); setRegions(d.regions || []); }
        if (uRes.ok) { const d = await uRes.json(); setUsers(d.users || d.members || []); }
        setLoading(false);
    };

    const openCreate = () => {
        setEditBranch(null);
        setForm({ name: "", code: "", address: "", regionId: "", teamLeaderId: "" });
        setShowModal(true);
    };
    const openEdit = (b: Branch) => {
        setEditBranch(b);
        setForm({ name: b.name, code: b.code, address: b.address || "", regionId: b.regionId, teamLeaderId: b.teamLeaderId || "" });
        setShowModal(true);
    };

    const saveBranch = async () => {
        if (!form.name || !form.code || !form.regionId) return;
        setSaving(true);
        const url = editBranch ? `/api/branches/${editBranch.id}` : "/api/branches";
        const method = editBranch ? "PATCH" : "POST";
        const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
        setSaving(false);
        if (res.ok) { setShowModal(false); fetchData(); }
    };

    const deactivateBranch = async (id: string) => {
        if (!confirm("Deactivate this branch?")) return;
        await fetch(`/api/branches/${id}`, { method: "DELETE" });
        fetchData();
    };

    const saveBulk = async () => {
        setBulkError("");
        let parsed: any[] = [];
        try {
            parsed = JSON.parse(bulkText);
        } catch {
            const lines = bulkText.trim().split("\n");
            const headers = lines[0].split(",").map((h: string) => h.trim());
            parsed = lines.slice(1).map((line: string) => {
                const vals = line.split(",").map((v: string) => v.trim());
                const obj: any = {};
                headers.forEach((h: string, i: number) => { obj[h] = vals[i] || ""; });
                return obj;
            });
        }
        if (!Array.isArray(parsed) || parsed.length === 0) { setBulkError("Could not parse input. Use JSON or CSV."); return; }
        setSaving(true);
        const res = await fetch("/api/branches/bulk", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ branches: parsed }) });
        setSaving(false);
        if (res.ok) { setShowBulkModal(false); setBulkText(""); fetchData(); }
        else { const d = await res.json(); setBulkError(d.error || "Failed to import"); }
    };

    const filtered = activeRegion === "all" ? branches : branches.filter(b => b.regionId === activeRegion);

    const branchModal = (mounted && showModal) ? createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/30" onClick={() => !saving && setShowModal(false)} />
            <div className="relative bg-white w-full max-w-md rounded-[12px] overflow-hidden"
                style={{ border: '1px solid rgba(0,0,0,0.09)', boxShadow: '0 8px 40px rgba(0,0,0,0.12)' }}>
                {/* Header */}
                <div className="px-6 py-4 flex items-center justify-between"
                    style={{ borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-[7px] bg-indigo-50 flex items-center justify-center shrink-0">
                            <PiBuildings className="text-[#6366F1] text-[15px]" />
                        </div>
                        <div>
                            <h2 className="text-[14px] font-[600] text-gray-900">
                                {editBranch ? "Edit Branch" : "New Branch"}
                            </h2>
                            <p className="text-[11.5px] text-gray-400 mt-0.5">
                                {editBranch ? "Update branch details" : "Create a new branch location"}
                            </p>
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
                        <label className={LABEL_CLS}>Branch Name <span className="text-rose-400">*</span></label>
                        <input value={form.name}
                            onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                            className={INPUT_CLS} style={INPUT_STYLE}
                            placeholder="e.g. Nairobi CBD Branch" />
                    </div>
                    <div>
                        <label className={LABEL_CLS}>Branch Code <span className="text-rose-400">*</span></label>
                        <input value={form.code}
                            onChange={e => setForm(p => ({ ...p, code: e.target.value.toUpperCase() }))}
                            className={INPUT_CLS + " font-mono"} style={INPUT_STYLE}
                            placeholder="e.g. NRB-001" />
                    </div>
                    <div>
                        <label className={LABEL_CLS}>Region <span className="text-rose-400">*</span></label>
                        <CustomSelect
                            value={form.regionId}
                            onChange={val => setForm(p => ({ ...p, regionId: val }))}
                            options={regions.map(r => ({ value: r.id, label: `${r.name} (${r.code})` }))}
                            placeholder="Select region..."
                            className={INPUT_CLS}
                            style={INPUT_STYLE}
                        />
                    </div>
                    <div>
                        <label className={LABEL_CLS}>Physical Address</label>
                        <input value={form.address}
                            onChange={e => setForm(p => ({ ...p, address: e.target.value }))}
                            className={INPUT_CLS} style={INPUT_STYLE}
                            placeholder="Postal or physical location" />
                    </div>
                    <div>
                        <label className={LABEL_CLS}>Team Leader</label>
                        <CustomSelect
                            value={form.teamLeaderId}
                            onChange={val => setForm(p => ({ ...p, teamLeaderId: val }))}
                            options={users.filter(u => !["SYSTEM_ADMIN", "FINANCE_APPROVER"].includes(u.role)).map(u => ({ value: u.id, label: `${u.name} (${u.email})` }))}
                            placeholder="No leader assigned"
                            className={INPUT_CLS}
                            style={INPUT_STYLE}
                        />
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 flex gap-3" style={{ borderTop: '1px solid rgba(0,0,0,0.07)' }}>
                    <button onClick={() => setShowModal(false)} disabled={saving}
                        className="flex-1 px-4 py-2 rounded-[6px] text-[12.5px] font-[500] text-gray-600 bg-white hover:bg-gray-50 transition-colors disabled:opacity-50"
                        style={CARD_STYLE}>
                        Cancel
                    </button>
                    <button onClick={saveBranch}
                        disabled={saving || !form.name || !form.code || !form.regionId}
                        className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 rounded-[6px] text-[12.5px] font-[500] text-white bg-[#6366F1] hover:bg-indigo-600 transition-colors disabled:opacity-50">
                        {saving ? <PiClock className="animate-spin text-[14px]" /> : null}
                        {saving ? "Saving..." : (editBranch ? "Update Branch" : "Create Branch")}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    ) : null;

    const bulkModal = (mounted && showBulkModal) ? createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/30" onClick={() => !saving && setShowBulkModal(false)} />
            <div className="relative bg-white w-full max-w-xl rounded-[12px] overflow-hidden"
                style={{ border: '1px solid rgba(0,0,0,0.09)', boxShadow: '0 8px 40px rgba(0,0,0,0.12)' }}>
                {/* Header */}
                <div className="px-6 py-4 flex items-center justify-between"
                    style={{ borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-[7px] bg-indigo-50 flex items-center justify-center shrink-0">
                            <PiUploadSimple className="text-[#6366F1] text-[15px]" />
                        </div>
                        <div>
                            <h2 className="text-[14px] font-[600] text-gray-900">Bulk Import</h2>
                            <p className="text-[11.5px] text-gray-400 mt-0.5">Import multiple branches via JSON or CSV</p>
                        </div>
                    </div>
                    <button onClick={() => { setShowBulkModal(false); setBulkError(""); }}
                        className="p-1.5 rounded-[6px] text-gray-400 hover:bg-gray-50 hover:text-gray-700 transition-colors">
                        <PiX className="text-[16px]" />
                    </button>
                </div>

                {/* Body */}
                <div className="px-6 py-5 space-y-4">
                    <p className="text-[12.5px] text-gray-500 leading-relaxed">
                        Paste a JSON array or CSV. Each record needs <code className="bg-gray-100 px-1 rounded text-[11px]">name</code>, <code className="bg-gray-100 px-1 rounded text-[11px]">code</code>, and <code className="bg-gray-100 px-1 rounded text-[11px]">regionId</code>.
                    </p>

                    <div className="rounded-[6px] p-3 font-mono text-[11px] bg-gray-900 text-indigo-300 overflow-x-auto"
                        style={{ border: '1px solid rgba(0,0,0,0.15)' }}>
                        {`[{"name":"Branch A","code":"BRA-001","regionId":"..."},\n {"name":"Branch B","code":"BRB-001","regionId":"..."}]`}
                    </div>

                    <textarea value={bulkText} onChange={e => setBulkText(e.target.value)} rows={7}
                        className={INPUT_CLS + " font-mono resize-none"} style={INPUT_STYLE}
                        placeholder="Paste JSON or CSV data here..." />

                    {bulkError && (
                        <div className="flex items-start gap-2.5 px-4 py-3 rounded-[6px]"
                            style={{ background: 'rgba(254,242,242,0.8)', border: '1px solid rgba(239,68,68,0.2)' }}>
                            <PiWarningCircle className="text-rose-500 text-[16px] shrink-0 mt-0.5" />
                            <p className="text-[12px] font-[500] text-rose-600">{bulkError}</p>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 flex gap-3" style={{ borderTop: '1px solid rgba(0,0,0,0.07)' }}>
                    <button onClick={() => { setShowBulkModal(false); setBulkError(""); }} disabled={saving}
                        className="flex-1 px-4 py-2 rounded-[6px] text-[12.5px] font-[500] text-gray-600 bg-white hover:bg-gray-50 transition-colors"
                        style={CARD_STYLE}>
                        Cancel
                    </button>
                    <button onClick={saveBulk} disabled={saving || !bulkText.trim()}
                        className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 rounded-[6px] text-[12.5px] font-[500] text-white bg-[#6366F1] hover:bg-indigo-600 transition-colors disabled:opacity-50">
                        {saving ? <PiClock className="animate-spin text-[14px]" /> : <PiCheck className="text-[14px]" />}
                        {saving ? "Importing..." : "Import Branches"}
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
                    <h1 className="text-[20px] font-[600] text-gray-900 tracking-tight">Branch Management</h1>
                    <p className="text-[12.5px] text-gray-400 mt-0.5">
                        {branches.length} branches across {regions.length} regions
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={() => setShowBulkModal(true)}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-[6px] text-[12.5px] font-[500] text-gray-600 bg-white hover:bg-gray-50 transition-colors"
                        style={CARD_STYLE}>
                        <PiUploadSimple className="text-[14px]" /> Bulk Import
                    </button>
                    <button onClick={openCreate}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-[6px] text-[12.5px] font-[500] text-white bg-[#6366F1] hover:bg-indigo-600 transition-colors">
                        <PiPlus className="text-[14px]" /> New Branch
                    </button>
                </div>
            </div>

            {/* Region filter tabs */}
            <div className="flex gap-2 flex-wrap pb-4" style={{ borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
                <button onClick={() => setActiveRegion("all")}
                    className={cn(
                        'px-3 py-1.5 rounded-[6px] text-[12.5px] font-[500] transition-all',
                        activeRegion === "all"
                            ? 'bg-indigo-50 text-[#6366F1]'
                            : 'text-gray-500 bg-white hover:bg-gray-50 hover:text-gray-800'
                    )}
                    style={{ border: activeRegion === "all" ? '1px solid rgba(99,102,241,0.2)' : '1px solid rgba(0,0,0,0.09)' }}>
                    All Regions
                </button>
                {regions.map(r => (
                    <button key={r.id} onClick={() => setActiveRegion(r.id)}
                        className={cn(
                            'px-3 py-1.5 rounded-[6px] text-[12.5px] font-[500] transition-all',
                            activeRegion === r.id
                                ? 'bg-indigo-50 text-[#6366F1]'
                                : 'text-gray-500 bg-white hover:bg-gray-50 hover:text-gray-800'
                        )}
                        style={{ border: activeRegion === r.id ? '1px solid rgba(99,102,241,0.2)' : '1px solid rgba(0,0,0,0.09)' }}>
                        {r.name}
                        <span className="ml-1.5 text-[10.5px] opacity-60">({r.branches?.length || 0})</span>
                    </button>
                ))}
            </div>

            {/* Branches Grid */}
            {loading ? (
                <div className="bg-white rounded-[8px] py-20 flex flex-col items-center" style={CARD_STYLE}>
                    <PiSpinner className="animate-spin text-[#6366F1] text-2xl mb-2" />
                    <p className="text-[12.5px] text-gray-400">Loading branches...</p>
                </div>
            ) : filtered.length === 0 ? (
                <div className="bg-white rounded-[8px] py-20 flex flex-col items-center" style={CARD_STYLE}>
                    <div className="w-10 h-10 rounded-[8px] bg-gray-50 flex items-center justify-center mb-3"
                        style={{ border: '1px solid rgba(0,0,0,0.07)' }}>
                        <PiBuildings className="text-gray-300 text-xl" />
                    </div>
                    <p className="text-[13px] font-[500] text-gray-700">No branches found</p>
                    <p className="text-[12px] text-gray-400 mt-0.5">Create a new branch to get started</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filtered.map(b => (
                        <div key={b.id}
                            onClick={() => router.push(`/dashboard/branches/${b.id}`)}
                            className="bg-white rounded-[8px] p-5 hover:bg-indigo-50/30 transition-all group relative cursor-pointer"
                            style={{ border: '1px solid rgba(0,0,0,0.09)', transition: 'background 0.15s, border-color 0.15s, box-shadow 0.15s' }}
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(99,102,241,0.35)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 12px rgba(99,102,241,0.08)'; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(0,0,0,0.09)'; (e.currentTarget as HTMLElement).style.boxShadow = 'none'; }}
                        >
                            {/* Card top */}
                            <div className="flex items-start justify-between mb-4">
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2 mb-1.5">
                                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-[4px] text-gray-500 bg-gray-100 tracking-wider"
                                            style={{ border: '1px solid rgba(0,0,0,0.09)' }}>
                                            {b.code}
                                        </span>
                                        {b.isActive ? (
                                            <span className="text-[10px] font-[500] px-2 py-0.5 rounded-[4px] text-emerald-600 bg-emerald-50"
                                                style={{ border: '1px solid rgba(16,185,129,0.2)' }}>Active</span>
                                        ) : (
                                            <span className="text-[10px] font-[500] px-2 py-0.5 rounded-[4px] text-rose-500 bg-rose-50"
                                                style={{ border: '1px solid rgba(239,68,68,0.2)' }}>Inactive</span>
                                        )}
                                    </div>
                                    <h3 className="text-[14px] font-[600] text-gray-900 group-hover:text-[#6366F1] transition-colors truncate">
                                        {b.name}
                                    </h3>
                                </div>
                                <div className="flex items-center gap-1 shrink-0 ml-2">
                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={e => { e.stopPropagation(); openEdit(b); }}
                                            className="w-7 h-7 rounded-[6px] bg-gray-50 hover:bg-indigo-50 text-gray-400 hover:text-[#6366F1] flex items-center justify-center transition-colors"
                                            style={{ border: '1px solid rgba(0,0,0,0.09)' }}>
                                            <PiPencil className="text-[13px]" />
                                        </button>
                                        <button onClick={e => { e.stopPropagation(); deactivateBranch(b.id); }}
                                            className="w-7 h-7 rounded-[6px] bg-gray-50 hover:bg-rose-50 text-gray-400 hover:text-rose-500 flex items-center justify-center transition-colors"
                                            style={{ border: '1px solid rgba(0,0,0,0.09)' }}>
                                            <PiTrash className="text-[13px]" />
                                        </button>
                                    </div>
                                    {/* Arrow — always visible, shifts right on hover */}
                                    <PiArrowRight className="text-[15px] text-gray-300 group-hover:text-[#6366F1] group-hover:translate-x-0.5 transition-all ml-1" />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <div className="flex items-center gap-2 text-[12.5px] text-gray-400">
                                    <PiMapPin className="text-[13px] shrink-0" />
                                    <span className="truncate">{b.region?.name || "—"}</span>
                                </div>
                                <div className="flex items-center gap-2 text-[12.5px] text-gray-400">
                                    <PiUsers className="text-[13px] shrink-0" />
                                    <span className="truncate">
                                        {b.teamLeader?.name || <em className="text-gray-300 not-italic">No leader assigned</em>}
                                    </span>
                                </div>
                            </div>

                            {b.wallet && (
                                <div className="mt-4 pt-3 flex items-center justify-between"
                                    style={{ borderTop: '1px solid rgba(0,0,0,0.07)' }}>
                                    <span className="text-[10.5px] font-[500] text-gray-400 uppercase tracking-[0.06em]">
                                        Branch Wallet
                                    </span>
                                    <span className={cn(
                                        'text-[13px] font-[600]',
                                        b.wallet.balance > 0 ? 'text-emerald-600' : 'text-gray-700'
                                    )}>
                                        {b.wallet.currency} {b.wallet.balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                    </span>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {branchModal}
            {bulkModal}
        </div>
    );
}
