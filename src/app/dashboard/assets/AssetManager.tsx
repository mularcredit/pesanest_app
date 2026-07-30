"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import {
    PiPlus, PiPackage, PiCheckCircle,
    PiWarning, PiTrash, PiTag, PiUser, PiX, PiCaretDown,
    PiArrowsClockwise, PiCurrencyDollar,
} from "react-icons/pi";
import { createAsset, deleteAsset, runDepreciation } from "./actions";
import { useToast } from "@/components/ui/ToastProvider";
import { DatePicker } from "@/components/ui/DatePicker";

const CARD_STYLE: React.CSSProperties = { border: '1px solid rgba(0,0,0,0.09)' };
const ROW_BORDER: React.CSSProperties = { borderBottom: '1px solid rgba(0,0,0,0.06)' };
const INPUT_CLASS = "w-full rounded-[6px] px-3 py-[10px] text-[13px] text-gray-900 placeholder:text-gray-300 outline-none focus:ring-1 focus:ring-[#6366F1] transition-colors bg-white";
const INPUT_STYLE: React.CSSProperties = { border: '1px solid rgba(0,0,0,0.09)' };
const LABEL_CLASS = "block text-[11.5px] font-[500] text-gray-400 mb-1.5";

const ASSET_CATEGORIES = [
    "Vehicles & Transport", "Generators & Power Systems", "IT & Communications",
    "Office Furniture", "Land & Buildings", "Security Equipment",
    "Water Infrastructure", "Machinery & Heavy Plant", "Fixtures & Fittings",
    "Software Licenses", "Other Assets",
];

const STATUS_META: Record<string, { label: string; cls: string; border: string }> = {
    ACTIVE:      { label: 'Active',      cls: 'text-emerald-600 bg-emerald-50', border: 'rgba(16,185,129,0.2)' },
    MAINTENANCE: { label: 'Maintenance', cls: 'text-amber-600 bg-amber-50',     border: 'rgba(245,158,11,0.2)' },
    RETIRED:     { label: 'Retired',     cls: 'text-gray-500 bg-gray-100',      border: 'rgba(0,0,0,0.09)'    },
    DISPOSED:    { label: 'Disposed',    cls: 'text-rose-600 bg-rose-50',       border: 'rgba(239,68,68,0.2)' },
};

const BLANK_ASSET = {
    name: "", category: "IT & Communications", status: "ACTIVE",
    purchaseDate: new Date().toISOString().split("T")[0],
    purchasePrice: "", serialNumber: "", assetTag: "",
    location: "Main Office", assignedToId: "", notes: "",
    depreciationMethod: "NONE", usefulLifeYears: "", salvageValue: "", depreciationRate: "",
};

export function AssetManager({ assets, stats }: { assets: any[]; stats: any }) {
    const router       = useRouter();
    const searchParams = useSearchParams();
    const { showToast } = useToast();
    const [mounted, setMounted]                 = useState(false);
    const [isAddModalOpen, setIsAddModalOpen]   = useState(false);
    const [isSubmitting, setIsSubmitting]       = useState(false);
    const [searchQuery, setSearchQuery]         = useState(searchParams.get("q") || "");
    const [isCategoryOpen, setIsCategoryOpen]   = useState(false);
    const [categorySearch, setCategorySearch]   = useState("");
    const [isDepreciationOpen, setIsDepreciationOpen] = useState(false);
    const [isDepreciating, setIsDepreciating]   = useState(false);
    const [newAsset, setNewAsset]               = useState({ ...BLANK_ASSET });
    const [disposingAssetId, setDisposingAssetId] = useState<string | null>(null);
    const [disposeForm, setDisposeForm]         = useState({ proceeds: '', disposalDate: new Date().toISOString().slice(0, 10), reason: '' });
    const [isDisposing, setIsDisposing]         = useState(false);

    useEffect(() => { setMounted(true); }, []);

    const filteredCategories = ASSET_CATEGORIES.filter(c => c.toLowerCase().includes(categorySearch.toLowerCase()));

    const handleSearch = (term: string) => {
        setSearchQuery(term);
        const params = new URLSearchParams(searchParams.toString());
        if (term) params.set("q", term); else params.delete("q");
        router.replace(`/dashboard/assets?${params.toString()}`);
    };

    const handleSubmit = async () => {
        if (!newAsset.name || !newAsset.purchasePrice) { showToast("Please fill in required fields", "error"); return; }
        setIsSubmitting(true);
        try {
            const result = await createAsset(newAsset);
            if (result.success) {
                showToast("Asset created successfully", "success");
                setIsAddModalOpen(false);
                setNewAsset({ ...BLANK_ASSET });
                router.refresh();
            } else {
                showToast(result.error || "Failed to create asset", "error");
            }
        } catch { showToast("An error occurred", "error"); }
        finally { setIsSubmitting(false); }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure you want to delete this asset?")) return;
        const result = await deleteAsset(id);
        if (result.success) { showToast("Asset deleted", "success"); router.refresh(); }
        else showToast("Failed to delete asset", "error");
    };

    const handleDispose = async () => {
        if (!disposingAssetId) return;
        setIsDisposing(true);
        try {
            const res = await fetch(`/api/assets/${disposingAssetId}/dispose`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...disposeForm, proceeds: Number(disposeForm.proceeds || 0) })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            const gain = data.gainOrLoss >= 0
                ? `Gain: KES ${data.gainOrLoss.toLocaleString()}`
                : `Loss: KES ${Math.abs(data.gainOrLoss).toLocaleString()}`;
            showToast(`Asset disposed. ${gain}`, "success");
            setDisposingAssetId(null);
            router.refresh();
        } catch (err: any) {
            showToast(err.message, "error");
        } finally { setIsDisposing(false); }
    };

    const handleRunDepreciation = async () => {
        if (!confirm("Run depreciation for all active assets? This will create journal entries.")) return;
        setIsDepreciating(true);
        try {
            const result = await runDepreciation();
            if (result.success) { showToast(`Depreciation complete. Posted ${result.count} entries.`, "success"); router.refresh(); }
            else showToast(result.error || "Failed to run depreciation", "error");
        } catch { showToast("An error occurred", "error"); }
        finally { setIsDepreciating(false); }
    };

    const depreciationMethodLabel = (m: string) =>
        m === "STRAIGHT_LINE" ? "Straight Line" : m === "DECLINING_BALANCE" ? "Declining Balance" : "None";

    // ── ADD ASSET MODAL ──
    const addModal = isAddModalOpen && mounted ? createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/30" onClick={() => setIsAddModalOpen(false)} />
            <div className="relative bg-white w-full max-w-2xl rounded-[12px] flex flex-col max-h-[90vh] overflow-hidden"
                style={{ ...CARD_STYLE, boxShadow: '0 8px 40px rgba(0,0,0,0.12)' }}>

                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 shrink-0"
                    style={{ borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-[7px] bg-indigo-50 flex items-center justify-center shrink-0">
                            <PiPackage className="text-[#6366F1] text-[15px]" />
                        </div>
                        <div>
                            <h2 className="text-[14px] font-[600] text-gray-900 leading-none">Add New Asset</h2>
                            <p className="text-[12px] text-gray-400 mt-0.5">Register a new company asset</p>
                        </div>
                    </div>
                    <button onClick={() => setIsAddModalOpen(false)}
                        className="p-1.5 rounded-[6px] text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors">
                        <PiX className="text-[16px]" />
                    </button>
                </div>

                {/* Form body */}
                <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Name */}
                        <div>
                            <label className={LABEL_CLASS}>Asset name <span className="text-rose-400">*</span></label>
                            <input className={INPUT_CLASS} style={INPUT_STYLE} placeholder="e.g. MacBook Pro 16"
                                value={newAsset.name} onChange={e => setNewAsset({ ...newAsset, name: e.target.value })} />
                        </div>

                        {/* Category custom dropdown */}
                        <div className="relative">
                            <label className={LABEL_CLASS}>Category</label>
                            <button type="button" onClick={() => setIsCategoryOpen(!isCategoryOpen)}
                                className={cn(INPUT_CLASS, 'flex items-center justify-between text-left cursor-pointer')}
                                style={INPUT_STYLE}>
                                <span className={newAsset.category ? 'text-gray-900' : 'text-gray-300'}>
                                    {newAsset.category || 'Select category…'}
                                </span>
                                <PiCaretDown className={cn('text-gray-300 text-[13px] transition-transform shrink-0', isCategoryOpen && 'rotate-180')} />
                            </button>
                            {isCategoryOpen && (
                                <>
                                    <div className="fixed inset-0 z-40" onClick={() => setIsCategoryOpen(false)} />
                                    <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-[8px] shadow-lg z-50 p-2"
                                        style={CARD_STYLE}>
                                        <div className="mb-1.5">
                                            <input autoFocus className="w-full px-2 py-1.5 rounded-[5px] text-[12px] text-gray-900 placeholder:text-gray-300 outline-none focus:ring-1 focus:ring-[#6366F1] bg-white"
                                                style={{ border: '1px solid rgba(0,0,0,0.09)' }}
                                                placeholder="Search…" value={categorySearch}
                                                onChange={e => setCategorySearch(e.target.value)}
                                                onClick={e => e.stopPropagation()} />
                                        </div>
                                        <div className="max-h-44 overflow-y-auto space-y-0.5">
                                            {filteredCategories.length > 0 ? filteredCategories.map(cat => (
                                                <button key={cat} type="button"
                                                    onClick={() => { setNewAsset({ ...newAsset, category: cat }); setIsCategoryOpen(false); setCategorySearch(""); }}
                                                    className={cn('w-full text-left px-2.5 py-1.5 rounded-[5px] text-[12.5px] transition-colors',
                                                        newAsset.category === cat ? 'bg-indigo-50 text-[#6366F1] font-[500]' : 'text-gray-700 hover:bg-gray-50')}>
                                                    {cat}
                                                </button>
                                            )) : (
                                                <p className="text-center text-[12px] text-gray-400 py-2">No categories found</p>
                                            )}
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Purchase Price */}
                        <div>
                            <label className={LABEL_CLASS}>Purchase price (KES) <span className="text-rose-400">*</span></label>
                            <div>
                                <input type="number" className={cn(INPUT_CLASS, 'pl-3 tabular-nums')} style={INPUT_STYLE}
                                    placeholder="0.00" value={newAsset.purchasePrice}
                                    onChange={e => setNewAsset({ ...newAsset, purchasePrice: e.target.value })} />
                            </div>
                        </div>

                        {/* Purchase Date */}
                        <div>
                            <DatePicker label="Purchase date"
                                value={newAsset.purchaseDate ? new Date(newAsset.purchaseDate) : undefined}
                                onChange={date => setNewAsset({ ...newAsset, purchaseDate: date.toISOString().split("T")[0] })}
                                placeholder="Select purchase date" />
                        </div>

                        {/* Serial Number */}
                        <div>
                            <label className={LABEL_CLASS}>Serial number</label>
                            <input className={INPUT_CLASS} style={INPUT_STYLE} placeholder="Optional"
                                value={newAsset.serialNumber}
                                onChange={e => setNewAsset({ ...newAsset, serialNumber: e.target.value })} />
                        </div>

                        {/* Asset Tag */}
                        <div>
                            <label className={LABEL_CLASS}>Asset tag</label>
                            <input className={INPUT_CLASS} style={INPUT_STYLE} placeholder="Optional"
                                value={newAsset.assetTag}
                                onChange={e => setNewAsset({ ...newAsset, assetTag: e.target.value })} />
                        </div>
                    </div>

                    {/* Location */}
                    <div>
                        <label className={LABEL_CLASS}>Location</label>
                        <input className={INPUT_CLASS} style={INPUT_STYLE} placeholder="e.g. Headquarters — Floor 2"
                            value={newAsset.location}
                            onChange={e => setNewAsset({ ...newAsset, location: e.target.value })} />
                    </div>

                    {/* Depreciation section */}
                    <div className="pt-4 space-y-4" style={{ borderTop: '1px solid rgba(0,0,0,0.07)' }}>
                        <p className="text-[11px] font-[600] uppercase tracking-[0.07em] text-gray-400">Valuation &amp; Depreciation</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Depreciation Method dropdown */}
                            <div className="relative">
                                <label className={LABEL_CLASS}>Depreciation method</label>
                                <button type="button" onClick={() => setIsDepreciationOpen(!isDepreciationOpen)}
                                    className={cn(INPUT_CLASS, 'flex items-center justify-between text-left cursor-pointer')}
                                    style={INPUT_STYLE}>
                                    <span className="text-gray-900">{depreciationMethodLabel(newAsset.depreciationMethod)}</span>
                                    <PiCaretDown className={cn('text-gray-300 text-[13px] transition-transform shrink-0', isDepreciationOpen && 'rotate-180')} />
                                </button>
                                {isDepreciationOpen && (
                                    <>
                                        <div className="fixed inset-0 z-40" onClick={() => setIsDepreciationOpen(false)} />
                                        <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-[8px] shadow-lg z-50 p-2"
                                            style={CARD_STYLE}>
                                            {[
                                                { value: "NONE", label: "None" },
                                                { value: "STRAIGHT_LINE", label: "Straight Line" },
                                                { value: "DECLINING_BALANCE", label: "Declining Balance" },
                                            ].map(opt => (
                                                <button key={opt.value} type="button"
                                                    onClick={() => { setNewAsset({ ...newAsset, depreciationMethod: opt.value }); setIsDepreciationOpen(false); }}
                                                    className={cn('w-full text-left px-2.5 py-1.5 rounded-[5px] text-[12.5px] transition-colors',
                                                        newAsset.depreciationMethod === opt.value ? 'bg-indigo-50 text-[#6366F1] font-[500]' : 'text-gray-700 hover:bg-gray-50')}>
                                                    {opt.label}
                                                </button>
                                            ))}
                                        </div>
                                    </>
                                )}
                            </div>

                            {newAsset.depreciationMethod !== "NONE" && (
                                <>
                                    <div>
                                        <label className={LABEL_CLASS}>Useful life (years)</label>
                                        <input type="number" className={INPUT_CLASS} style={INPUT_STYLE} placeholder="e.g. 5"
                                            value={newAsset.usefulLifeYears}
                                            onChange={e => setNewAsset({ ...newAsset, usefulLifeYears: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className={LABEL_CLASS}>Salvage value (KES)</label>
                                        <input type="number" className={INPUT_CLASS} style={INPUT_STYLE} placeholder="0.00"
                                            value={newAsset.salvageValue}
                                            onChange={e => setNewAsset({ ...newAsset, salvageValue: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className={LABEL_CLASS}>Depreciation rate (%)</label>
                                        <input type="number" className={INPUT_CLASS} style={INPUT_STYLE} placeholder="e.g. 20"
                                            value={newAsset.depreciationRate}
                                            onChange={e => setNewAsset({ ...newAsset, depreciationRate: e.target.value })} />
                                    </div>
                                </>
                            )}
                        </div>
                    </div>

                    <div className="h-2" />
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-2.5 px-6 py-4 shrink-0"
                    style={{ borderTop: '1px solid rgba(0,0,0,0.07)' }}>
                    <button onClick={() => setIsAddModalOpen(false)}
                        className="px-4 py-2 rounded-[6px] text-[12.5px] font-[500] text-gray-500 hover:bg-gray-50 transition-colors"
                        style={INPUT_STYLE}>
                        Cancel
                    </button>
                    <button onClick={handleSubmit} disabled={isSubmitting}
                        className="flex items-center gap-2 px-5 py-2 rounded-[6px] text-[12.5px] font-[500] text-white bg-[#6366F1] hover:bg-indigo-600 transition-colors disabled:opacity-60">
                        <PiCheckCircle className="text-[14px]" />
                        {isSubmitting ? 'Saving…' : 'Save Asset'}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    ) : null;

    // ── DISPOSE MODAL ──
    const disposeModal = disposingAssetId && mounted ? createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/30" onClick={() => setDisposingAssetId(null)} />
            <div className="relative bg-white w-full max-w-md rounded-[12px] flex flex-col overflow-hidden"
                style={{ ...CARD_STYLE, boxShadow: '0 8px 40px rgba(0,0,0,0.12)' }}>

                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 shrink-0"
                    style={{ borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-[7px] bg-orange-50 flex items-center justify-center shrink-0">
                            <PiTrash className="text-orange-500 text-[15px]" />
                        </div>
                        <div>
                            <h2 className="text-[14px] font-[600] text-gray-900 leading-none">Dispose Asset</h2>
                            <p className="text-[12px] text-gray-400 mt-0.5">Post a disposal journal entry to GL</p>
                        </div>
                    </div>
                    <button onClick={() => setDisposingAssetId(null)}
                        className="p-1.5 rounded-[6px] text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors">
                        <PiX className="text-[16px]" />
                    </button>
                </div>

                {/* Form */}
                <div className="px-6 py-5 space-y-4">
                    <p className="text-[12.5px] text-gray-500 leading-relaxed">
                        This will remove the asset from the GL. Any gain or loss will be recorded automatically.
                    </p>
                    <div>
                        <label className={LABEL_CLASS}>Disposal date</label>
                        <input type="date" value={disposeForm.disposalDate}
                            onChange={e => setDisposeForm(f => ({ ...f, disposalDate: e.target.value }))}
                            className={INPUT_CLASS} style={INPUT_STYLE} />
                    </div>
                    <div>
                        <label className={LABEL_CLASS}>Proceeds <span className="text-gray-300">(KES — leave blank if none)</span></label>
                        <div>
                            <input type="number" step="0.01" min="0" value={disposeForm.proceeds}
                                onChange={e => setDisposeForm(f => ({ ...f, proceeds: e.target.value }))}
                                placeholder="0.00" className={cn(INPUT_CLASS, 'pl-3 tabular-nums')} style={INPUT_STYLE} />
                        </div>
                    </div>
                    <div>
                        <label className={LABEL_CLASS}>Reason</label>
                        <input type="text" value={disposeForm.reason}
                            onChange={e => setDisposeForm(f => ({ ...f, reason: e.target.value }))}
                            placeholder="e.g. Sold, written off, stolen…"
                            className={INPUT_CLASS} style={INPUT_STYLE} />
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-2.5 px-6 py-4 shrink-0"
                    style={{ borderTop: '1px solid rgba(0,0,0,0.07)' }}>
                    <button onClick={() => setDisposingAssetId(null)}
                        className="px-4 py-2 rounded-[6px] text-[12.5px] font-[500] text-gray-500 hover:bg-gray-50 transition-colors"
                        style={INPUT_STYLE}>
                        Cancel
                    </button>
                    <button onClick={handleDispose} disabled={isDisposing}
                        className="px-5 py-2 rounded-[6px] text-[12.5px] font-[500] text-white bg-orange-600 hover:bg-orange-700 transition-colors disabled:opacity-60">
                        {isDisposing ? 'Processing…' : 'Confirm Disposal'}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    ) : null;

    return (
        <div className="space-y-5">
            {/* Summary chips */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                    { label: 'Total assets',  value: stats.total.toString(),              sub: `${stats.active} active`,         accent: 'text-gray-900' },
                    { label: 'Active',         value: stats.active.toString(),             sub: 'in service',                    accent: 'text-emerald-600' },
                    { label: 'Maintenance',    value: stats.maintenance.toString(),        sub: 'needs attention',               accent: stats.maintenance > 0 ? 'text-amber-600' : 'text-gray-400' },
                    { label: 'Total value',    value: `KES ${Number(stats.totalValue).toLocaleString(undefined, { maximumFractionDigits: 0 })}`, sub: 'active assets', accent: 'text-[#6366F1]' },
                ].map(chip => (
                    <div key={chip.label} className="bg-white rounded-[8px] px-4 py-3" style={CARD_STYLE}>
                        <p className="text-[11px] font-[500] uppercase tracking-[0.07em] text-gray-400">{chip.label}</p>
                        <p className={cn('text-[20px] font-[700] tabular-nums leading-snug mt-0.5', chip.accent)}>{chip.value}</p>
                        <p className="text-[11px] text-gray-400 mt-0.5">{chip.sub}</p>
                    </div>
                ))}
            </div>

            {/* Toolbar */}
            <div className="flex flex-col md:flex-row gap-3 items-center">
                <div className="w-full md:w-80 shrink-0">
                    <input className="w-full pl-3 pr-3 py-[9px] rounded-[6px] text-[12.5px] text-gray-900 placeholder:text-gray-300 outline-none focus:ring-1 focus:ring-[#6366F1] bg-white"
                        style={INPUT_STYLE}
                        placeholder="Search by name, tag or serial…"
                        value={searchQuery} onChange={e => handleSearch(e.target.value)} />
                </div>
                <div className="flex items-center gap-2.5 ml-auto">
                    <button onClick={handleRunDepreciation} disabled={isDepreciating}
                        className="flex items-center gap-2 px-4 py-2 rounded-[6px] text-[12.5px] font-[500] text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
                        style={INPUT_STYLE}>
                        <PiArrowsClockwise className={cn('text-[13px]', isDepreciating && 'animate-spin')} />
                        {isDepreciating ? 'Running…' : 'Run Depreciation'}
                    </button>
                    <button onClick={() => setIsAddModalOpen(true)}
                        className="flex items-center gap-2 px-4 py-2 rounded-[6px] text-[12.5px] font-[500] bg-[#6366F1] text-white hover:bg-indigo-600 transition-colors">
                        <PiPlus className="text-[14px]" />
                        Add Asset
                    </button>
                </div>
            </div>

            {/* Asset Table */}
            <div className="bg-white rounded-[8px] overflow-hidden" style={CARD_STYLE}>
                {assets.length === 0 ? (
                    <div className="py-20 flex flex-col items-center">
                        <div className="w-10 h-10 rounded-[8px] bg-gray-50 flex items-center justify-center mb-3"
                            style={{ border: '1px solid rgba(0,0,0,0.07)' }}>
                            <PiPackage className="text-gray-300 text-xl" />
                        </div>
                        <p className="text-[13px] font-[500] text-gray-700">No assets found</p>
                        <p className="text-[12px] text-gray-400 mt-0.5">Create your first asset to get started.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="bg-gray-50/60" style={{ borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
                                    {['Asset Details', 'Status', 'Location', 'Value (KES)', 'Purchase Date', 'Actions'].map((h, i) => (
                                        <th key={h} className={cn(
                                            'px-5 py-2.5 text-[10.5px] font-[500] uppercase tracking-[0.08em] text-gray-400',
                                            i === 5 ? 'text-right' : 'text-left'
                                        )}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {assets.map((asset, idx) => {
                                    const sm = STATUS_META[asset.status] ?? STATUS_META.RETIRED;
                                    return (
                                        <tr key={asset.id} className="hover:bg-gray-50/60 transition-colors"
                                            style={idx < assets.length - 1 ? ROW_BORDER : {}}>
                                            <td className="px-5 py-3.5">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-[7px] bg-indigo-50 flex items-center justify-center shrink-0">
                                                        <PiPackage className="text-[#6366F1] text-[14px]" />
                                                    </div>
                                                    <div>
                                                        <p className="text-[13px] font-[500] text-gray-900">{asset.name}</p>
                                                        <p className="text-[11px] text-gray-400 flex items-center gap-1 mt-0.5">
                                                            <PiTag className="text-[10px]" />
                                                            {asset.assetTag || asset.serialNumber || 'No tag'}
                                                        </p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-5 py-3.5">
                                                <span className={cn('text-[10.5px] font-[500] px-2 py-0.5 rounded-[4px]', sm.cls)}
                                                    style={{ border: `1px solid ${sm.border}` }}>
                                                    {sm.label}
                                                </span>
                                            </td>
                                            <td className="px-5 py-3.5">
                                                <p className="text-[12.5px] text-gray-600">{asset.location}</p>
                                                {asset.assignedTo && (
                                                    <p className="text-[11px] text-gray-400 flex items-center gap-1 mt-0.5">
                                                        <PiUser className="text-[10px]" /> {asset.assignedTo.name}
                                                    </p>
                                                )}
                                            </td>
                                            <td className="px-5 py-3.5 font-mono text-[13px] text-gray-900 tabular-nums">
                                                {Number(asset.purchasePrice).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                            </td>
                                            <td className="px-5 py-3.5 text-[12.5px] text-gray-400">
                                                {new Date(asset.purchaseDate).toLocaleDateString()}
                                            </td>
                                            <td className="px-5 py-3.5">
                                                <div className="flex items-center justify-end gap-1.5">
                                                    {asset.status === 'ACTIVE' && (
                                                        <button
                                                            onClick={() => { setDisposingAssetId(asset.id); setDisposeForm({ proceeds: '', disposalDate: new Date().toISOString().slice(0, 10), reason: '' }); }}
                                                            className="px-2.5 py-1.5 rounded-[5px] text-[11.5px] font-[500] text-orange-600 hover:bg-orange-50 transition-colors"
                                                            style={{ border: '1px solid rgba(234,88,12,0.2)' }}>
                                                            Dispose
                                                        </button>
                                                    )}
                                                    <button onClick={() => handleDelete(asset.id)}
                                                        className="p-1.5 text-gray-300 hover:text-rose-500 hover:bg-rose-50 rounded-[5px] transition-colors">
                                                        <PiTrash className="text-[14px]" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {addModal}
            {disposeModal}
        </div>
    );
}
