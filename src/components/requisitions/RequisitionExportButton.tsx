"use client";

import { useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import {
    PiDownloadSimple, PiFileCsv, PiFilePdf,
    PiSpinner, PiX, PiFunnel, PiCheckSquare, PiSquare
} from "react-icons/pi";
import { useToast } from "@/components/ui/ToastProvider";
import { CustomSelect } from "@/components/ui/CustomSelect";

interface RequisitionExportButtonProps {
    requisitions: any[];
    monthlyBudgets?: any[];
    iconOnly?: boolean;
}

const ALL_STATUSES = ["PENDING", "APPROVED", "REJECTED", "FULFILLED", "COMPLETED", "PAID"];
const ALL_TYPES = ["STANDARD", "MONTHLY"];

export function RequisitionExportButton({ requisitions, monthlyBudgets = [], iconOnly = false }: RequisitionExportButtonProps) {
    const { showToast } = useToast();
    const [modalOpen, setModalOpen] = useState(false);
    const [loading, setLoading] = useState<"pdf" | "csv" | null>(null);

    const formatCurrency = (amount: number, currencyCode: string = 'KES') => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: currencyCode,
        }).format(amount);
    };

    // ── Filters ──────────────────────────────────────────────────────────────
    const [selStatuses, setSelStatuses] = useState<string[]>([...ALL_STATUSES]);
    const [selTypes, setSelTypes] = useState<string[]>([...ALL_TYPES]);
    const [selCategory, setSelCategory] = useState("all");
    const [selDept, setSelDept] = useState("all");
    const [selBranch, setSelBranch] = useState("all");
    const [dateFrom, setDateFrom] = useState("");
    const [dateTo, setDateTo] = useState("");

    // ── Source data ──────────────────────────────────────────────────────────
    const allItems = useMemo(() => [
        ...requisitions.map(r => ({ ...r, listType: "STANDARD" })),
        ...monthlyBudgets.map(b => ({
            ...b,
            listType: "MONTHLY",
            title: `Budget: ${new Date(2024, b.month - 1).toLocaleString("default", { month: "long" })} ${b.year}`,
            amount: b.totalAmount,
            category: b.category || "General",
        })),
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()), [requisitions, monthlyBudgets]);

    // ── Derived option lists ─────────────────────────────────────────────────
    const categories = useMemo(() => ["all", ...Array.from(new Set(allItems.map(r => r.category || "General").filter(Boolean)))], [allItems]);
    const departments = useMemo(() => ["all", ...Array.from(new Set(allItems.map(r => r.department).filter(Boolean)))], [allItems]);
    const branches = useMemo(() => ["all", ...Array.from(new Set(allItems.map(r => r.branch).filter(Boolean)))], [allItems]);

    // ── Filtered preview ─────────────────────────────────────────────────────
    const filtered = useMemo(() => allItems.filter(r => {
        if (!selStatuses.includes(r.status)) return false;
        if (!selTypes.includes(r.listType)) return false;
        if (selCategory !== "all" && (r.category || "General") !== selCategory) return false;
        if (selDept !== "all" && r.department !== selDept) return false;
        if (selBranch !== "all" && r.branch !== selBranch) return false;
        if (dateFrom) {
            const from = new Date(dateFrom); from.setHours(0, 0, 0, 0);
            if (new Date(r.createdAt) < from) return false;
        }
        if (dateTo) {
            const to = new Date(dateTo); to.setHours(23, 59, 59, 999);
            if (new Date(r.createdAt) > to) return false;
        }
        return true;
    }), [allItems, selStatuses, selTypes, selCategory, selDept, selBranch, dateFrom, dateTo]);

    // ── Helpers ──────────────────────────────────────────────────────────────
    const toggle = (arr: string[], setArr: (v: string[]) => void, val: string) => {
        setArr(arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val]);
    };

    const resetFilters = () => {
        setSelStatuses([...ALL_STATUSES]);
        setSelTypes([...ALL_TYPES]);
        setSelCategory("all");
        setSelDept("all");
        setSelBranch("all");
        setDateFrom("");
        setDateTo("");
    };

    const activeFilterCount = [
        selStatuses.length < ALL_STATUSES.length,
        selTypes.length < ALL_TYPES.length,
        selCategory !== "all",
        selDept !== "all",
        selBranch !== "all",
        !!dateFrom,
        !!dateTo,
    ].filter(Boolean).length;

    // ── Export logic ─────────────────────────────────────────────────────────
    const filterLabel = () => {
        const parts: string[] = [];
        if (selStatuses.length < ALL_STATUSES.length) parts.push(selStatuses.join("+"));
        if (selTypes.length < ALL_TYPES.length) parts.push(selTypes.join("+"));
        if (selCategory !== "all") parts.push(selCategory);
        if (selDept !== "all") parts.push(selDept);
        if (selBranch !== "all") parts.push(selBranch);
        if (dateFrom || dateTo) parts.push(`${dateFrom || "start"}–${dateTo || "end"}`);
        return parts.length ? `(${parts.join(", ")})` : "(All)";
    };

    const handlePDF = () => {
        if (!filtered.length) { showToast("No records match the current filters", "error"); return; }
        setLoading("pdf");
        setModalOpen(false);
        try {
            const doc = new jsPDF();
            const label = filterLabel();

            doc.setFontSize(18); doc.setTextColor(41, 37, 141);
            doc.text("Expenses Report", 14, 18);
            doc.setFontSize(8); doc.setTextColor(120);
            doc.text(`Filters: ${label}`, 14, 25);
            doc.text(`Generated: ${new Date().toLocaleString()}   •   Records: ${filtered.length}`, 14, 30);

            const total = filtered.reduce((s, r) => s + (r.amount || 0), 0);
            const approved = filtered.filter(r => ["APPROVED", "FULFILLED", "COMPLETED", "PAID"].includes(r.status)).length;
            const pending = filtered.filter(r => r.status === "PENDING").length;

            doc.setFontSize(10);
            doc.setTextColor(41, 37, 141); doc.text(`Total Value: ${formatCurrency(total, filtered[0]?.currency || 'KES')}`, 14, 39);
            doc.setTextColor(16, 185, 129); doc.text(`Approved: ${approved}`, 110, 39);
            doc.setTextColor(245, 158, 11); doc.text(`Pending: ${pending}`, 155, 39);

            const rows = filtered.map(r => [
                r.id?.slice(0, 8).toUpperCase() || "-",
                r.title || "-",
                r.listType,
                r.category || "General",
                r.branch || "Global",
                r.department || "-",
                new Date(r.createdAt).toLocaleDateString(),
                formatCurrency(r.amount || 0, r.currency),
                r.status,
            ]);

            autoTable(doc, {
                startY: 46,
                head: [["ID", "Title", "Type", "Category", "Branch", "Dept.", "Date", "Amount", "Status"]],
                body: rows,
                theme: "striped",
                headStyles: { fillColor: [41, 37, 141], fontSize: 8, fontStyle: "bold" },
                bodyStyles: { fontSize: 7.5 },
                alternateRowStyles: { fillColor: [248, 248, 252] },
                columnStyles: { 7: { halign: "right", fontStyle: "bold" } },
                didParseCell: (data) => {
                    if (data.column.index === 8 && data.section === "body") {
                        const s = String(data.cell.raw || "").toUpperCase();
                        data.cell.styles.textColor =
                            ["APPROVED", "FULFILLED", "COMPLETED", "PAID"].includes(s) ? [16, 185, 129] :
                                s === "REJECTED" ? [239, 68, 68] : [107, 114, 128];
                        data.cell.styles.fontStyle = "bold";
                    }
                },
            });

            doc.save(`Expenses_${new Date().toISOString().slice(0, 10)}.pdf`);
            showToast(`PDF exported — ${filtered.length} records`, "success");
        } catch (err: any) {
            showToast(err.message || "Failed to export PDF", "error");
        } finally { setLoading(null); }
    };

    const handleCSV = () => {
        if (!filtered.length) { showToast("No records match the current filters", "error"); return; }
        setLoading("csv");
        setModalOpen(false);
        try {
            const headers = ["ID", "Title", "Type", "Category", "Branch", "Department", "Date", "Amount", "Status", "Description"];
            const rows = filtered.map(r => [
                r.id?.slice(0, 8).toUpperCase() || "-",
                `"${(r.title || "").replace(/"/g, '""')}"`,
                r.listType,
                r.category || "General",
                r.branch || "Global",
                r.department || "-",
                new Date(r.createdAt).toLocaleDateString(),
                (r.amount || 0).toFixed(2),
                r.status,
                `"${(r.description || r.businessJustification || "").replace(/"/g, '""')}"`,
            ]);
            const csv = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
            const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url; a.download = `Expenses_${new Date().toISOString().slice(0, 10)}.csv`;
            a.click(); URL.revokeObjectURL(url);
            showToast(`CSV exported — ${filtered.length} records`, "success");
        } catch (err: any) {
            showToast(err.message || "Failed to export CSV", "error");
        } finally { setLoading(null); }
    };

    // ── Render ───────────────────────────────────────────────────────────────
    return (
        <>
            <button
                id="req-export-btn"
                onClick={() => setModalOpen(true)}
                disabled={!!loading}
                title="Export Report"
                className={`relative flex items-center gap-2 text-xs font-semibold text-gray-700 border border-gray-200 rounded-md hover:bg-gray-50 transition-all shadow-none disabled:opacity-60 ${iconOnly ? "w-9 h-9 justify-center" : "px-4 py-2.5"}`}
            >
                {loading ? <PiSpinner className="text-base animate-spin" /> : <PiDownloadSimple className="text-base" />}
                {!iconOnly && (loading ? "Exporting..." : "Export Report")}
                {activeFilterCount > 0 && !loading && (
                    <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-[#6366F1] text-white text-[9px] font-semibold rounded-full flex items-center justify-center">
                        {activeFilterCount}
                    </span>
                )}
            </button>

            {/* ── Filter Modal ── */}
            {modalOpen && typeof window !== "undefined" && createPortal(
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden animate-scale-in max-h-[90vh]">

                        {/* Header */}
                        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
                            <div>
                                <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                                    <PiFunnel className="text-[#6366F1]" /> Export Expenses
                                </h2>
                                <p className="text-[11px] text-gray-400 mt-0.5">Apply filters then choose your format</p>
                            </div>
                            <button onClick={() => setModalOpen(false)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors">
                                <PiX className="text-lg" />
                            </button>
                        </div>

                        {/* Body */}
                        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

                            {/* Status */}
                            <div>
                                <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-2">Status</label>
                                <div className="flex flex-wrap gap-2">
                                    {ALL_STATUSES.map(s => {
                                        const on = selStatuses.includes(s);
                                        return (
                                            <button
                                                key={s}
                                                onClick={() => toggle(selStatuses, setSelStatuses, s)}
                                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold border transition-all ${on
                                                    ? "bg-[#6366F1] text-white border-[#6366F1]"
                                                    : "bg-gray-50 text-gray-500 border-gray-200 hover:border-gray-400"}`}
                                            >
                                                {on ? <PiCheckSquare className="text-sm" /> : <PiSquare className="text-sm" />}
                                                {s}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Type */}
                            <div>
                                <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-2">Type</label>
                                <div className="flex gap-2">
                                    {ALL_TYPES.map(t => {
                                        const on = selTypes.includes(t);
                                        return (
                                            <button key={t} onClick={() => toggle(selTypes, setSelTypes, t)}
                                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold border transition-all ${on
                                                    ? "bg-[#6366F1] text-white border-[#6366F1]"
                                                    : "bg-gray-50 text-gray-500 border-gray-200 hover:border-gray-400"}`}>
                                                {t === "STANDARD" ? "Operational (Standard)" : "Monthly Budget Plan"}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Category / Dept / Branch */}
                            <div className="grid grid-cols-3 gap-3">
                                <div>
                                    <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-1.5">Category</label>
                                    <CustomSelect
                                        value={selCategory}
                                        onChange={val => setSelCategory(val)}
                                        options={categories.map(c => ({ value: c, label: c === "all" ? "All Categories" : c }))}
                                        className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#6366F1]/30"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-1.5">Department</label>
                                    <CustomSelect
                                        value={selDept}
                                        onChange={val => setSelDept(val)}
                                        options={departments.map(d => ({ value: d, label: d === "all" ? "All Depts." : d }))}
                                        className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#6366F1]/30"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-1.5">Branch</label>
                                    <CustomSelect
                                        value={selBranch}
                                        onChange={val => setSelBranch(val)}
                                        options={branches.map(b => ({ value: b, label: b === "all" ? "All Branches" : b }))}
                                        className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#6366F1]/30"
                                    />
                                </div>
                            </div>

                            {/* Date range */}
                            <div>
                                <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-1.5">Date Range (Created At)</label>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <span className="text-[10px] text-gray-400 font-medium block mb-1">From</span>
                                        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                                            className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#6366F1]/30" />
                                    </div>
                                    <div>
                                        <span className="text-[10px] text-gray-400 font-medium block mb-1">To</span>
                                        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                                            className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#6366F1]/30" />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/50 flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                                <div className="text-sm font-semibold text-gray-900">
                                    <span className="text-[#6366F1] text-lg">{filtered.length}</span>
                                    <span className="text-gray-400 text-xs font-medium ml-1">/ {allItems.length} records</span>
                                </div>
                                {activeFilterCount > 0 && (
                                    <button onClick={resetFilters} className="text-[10px] font-semibold text-gray-400 hover:text-gray-700 underline underline-offset-2 transition-colors">
                                        Reset filters
                                    </button>
                                )}
                            </div>

                            <div className="flex items-center gap-2">
                                <button onClick={handleCSV} disabled={!filtered.length}
                                    className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-semibold text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 transition-all disabled:opacity-40">
                                    <PiFileCsv className="text-base text-emerald-500" /> CSV
                                </button>
                                <button onClick={handlePDF} disabled={!filtered.length}
                                    className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-semibold text-white bg-[#6366F1] hover:bg-[#6366F1]/90 transition-all shadow-sm shadow-[#6366F1]/20 disabled:opacity-40">
                                    <PiFilePdf className="text-base" /> Download PDF
                                </button>
                            </div>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </>
    );
}
