"use client";

import { useState } from "react";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { PiDownloadSimple, PiFileCsv, PiFilePdf, PiPrinter, PiCaretDown, PiX } from "react-icons/pi";

// ── shared data model ─────────────────────────────────────────────────────────
export interface ReportLine {
    code?: string;
    name: string;
    current: number;
    prior?: number;     // comparative column; omit if not showing
    indent?: boolean;   // cosmetic indent in PDF
    isNegative?: boolean; // wrap in parens
    isBold?: boolean;
    isSubtotal?: boolean;
    isGrandTotal?: boolean;
    spacer?: boolean;   // blank separator row
}

export interface ReportSection {
    title: string;
    lines: ReportLine[];
}

export interface ReportExportData {
    title: string;           // e.g. "Income Statement"
    subtitle: string;        // e.g. "Profit & Loss · January 2025"
    company: string;
    sections: ReportSection[];
    showPrior?: boolean;
    currency?: string;       // default "KES"
}

// ── helpers ───────────────────────────────────────────────────────────────────
function fmt(n: number, neg = false): string {
    const abs = Math.abs(n).toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return (neg || n < 0) ? `(${abs})` : abs;
}

function csvEsc(v: string) { return `"${v.replace(/"/g, '""')}"`; }

// ── component ─────────────────────────────────────────────────────────────────
export function ReportExportButton({ data }: { data: ReportExportData }) {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState<"pdf" | "csv" | null>(null);
    const currency = data.currency ?? "KES";

    // ── PDF ────────────────────────────────────────────────────────────────────
    async function handlePDF() {
        setLoading("pdf"); setOpen(false);
        try {
            const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
            const W = doc.internal.pageSize.getWidth();

            // Header
            doc.setFillColor(99, 102, 241);
            doc.rect(0, 0, W, 28, "F");
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(16); doc.setFont("helvetica", "bold");
            doc.text(data.title, 14, 12);
            doc.setFontSize(8); doc.setFont("helvetica", "normal");
            doc.text(data.subtitle, 14, 19);
            doc.text(`${data.company} · Generated ${new Date().toLocaleString("en-KE")}`, 14, 24);

            const rows: (string | { content: string; styles: object })[][] = [];

            for (const section of data.sections) {
                // Section header row
                rows.push([
                    { content: section.title.toUpperCase(), styles: { fillColor: [240, 240, 255], textColor: [99, 102, 241], fontStyle: "bold", fontSize: 7.5 } },
                    { content: "", styles: { fillColor: [240, 240, 255] } },
                    ...(data.showPrior ? [{ content: "", styles: { fillColor: [240, 240, 255] } }] : []),
                    { content: "", styles: { fillColor: [240, 240, 255] } },
                ]);

                for (const line of section.lines) {
                    if (line.spacer) { rows.push(["", "", ...(data.showPrior ? [""] : []), ""]); continue; }

                    const nameStyle: any = {};
                    const amtStyle: any = { halign: "right" };
                    const priorStyle: any = { halign: "right", textColor: [180, 180, 180] };

                    if (line.isGrandTotal) {
                        nameStyle.fillColor = [245, 245, 255]; nameStyle.fontStyle = "bold"; nameStyle.fontSize = 9;
                        amtStyle.fillColor = [245, 245, 255]; amtStyle.fontStyle = "bold"; amtStyle.fontSize = 9;
                        priorStyle.fillColor = [245, 245, 255];
                    } else if (line.isSubtotal || line.isBold) {
                        nameStyle.fontStyle = "bold"; amtStyle.fontStyle = "bold";
                    }

                    const prefix = line.indent ? "    " : "";
                    const name = `${prefix}${line.code ? `[${line.code}]  ` : ""}${line.name}`;
                    const amount = line.isNegative ? `(${fmt(line.current)})` : fmt(line.current);
                    const prior = line.prior !== undefined ? (line.isNegative ? `(${fmt(line.prior)})` : fmt(line.prior)) : "—";

                    rows.push([
                        { content: name, styles: nameStyle },
                        { content: "", styles: {} },
                        ...(data.showPrior ? [{ content: prior, styles: priorStyle }] : []),
                        { content: amount, styles: amtStyle },
                    ]);
                }
            }

            const colHeader = data.showPrior
                ? ["Description / Account", "", "Prior Period", `${currency}`]
                : ["Description / Account", "", `${currency}`];

            autoTable(doc, {
                startY: 32,
                head: [colHeader],
                body: rows as any,
                theme: "plain",
                headStyles: { fillColor: [99, 102, 241], textColor: [255, 255, 255], fontSize: 8, fontStyle: "bold" },
                bodyStyles: { fontSize: 8, minCellHeight: 5.5 },
                columnStyles: data.showPrior
                    ? { 0: { cellWidth: 100 }, 1: { cellWidth: 5 }, 2: { cellWidth: 35, halign: "right" }, 3: { cellWidth: 42, halign: "right" } }
                    : { 0: { cellWidth: 130 }, 1: { cellWidth: 5 }, 2: { cellWidth: 50, halign: "right" } },
                margin: { left: 8, right: 8 },
                styles: { overflow: "linebreak" },
                didDrawPage: (d: any) => {
                    const pg = doc.getNumberOfPages();
                    doc.setFontSize(7); doc.setTextColor(160);
                    doc.text(`Page ${pg}`, W - 20, doc.internal.pageSize.getHeight() - 8);
                    doc.text("Prepared in accordance with IFRS", 14, doc.internal.pageSize.getHeight() - 8);
                },
            });

            doc.save(`${data.title.replace(/\s+/g, "_")}_${new Date().toISOString().slice(0, 10)}.pdf`);
        } catch (e: any) {
            alert("PDF export failed: " + e.message);
        } finally { setLoading(null); }
    }

    // ── CSV ────────────────────────────────────────────────────────────────────
    function handleCSV() {
        setLoading("csv"); setOpen(false);
        try {
            const headers = data.showPrior
                ? ["Section", "Account Code", "Account Name", "Current", "Prior"]
                : ["Section", "Account Code", "Account Name", `Amount (${currency})`];

            const rows: string[][] = [headers];
            for (const section of data.sections) {
                for (const line of section.lines) {
                    if (line.spacer) continue;
                    const sign = line.isNegative ? -1 : 1;
                    const row = data.showPrior
                        ? [csvEsc(section.title), line.code ?? "", csvEsc(line.name), (sign * line.current).toFixed(2), line.prior !== undefined ? (sign * line.prior).toFixed(2) : ""]
                        : [csvEsc(section.title), line.code ?? "", csvEsc(line.name), (sign * line.current).toFixed(2)];
                    rows.push(row);
                }
            }

            const csv = rows.map(r => r.join(",")).join("\n");
            const blob = new Blob(["﻿" + csv, { type: "text/csv;charset=utf-8;" }] as any);
            const a = document.createElement("a");
            a.href = URL.createObjectURL(blob);
            a.download = `${data.title.replace(/\s+/g, "_")}_${new Date().toISOString().slice(0, 10)}.csv`;
            a.click();
        } catch (e: any) {
            alert("CSV export failed: " + e.message);
        } finally { setLoading(null); }
    }

    // ── Print ──────────────────────────────────────────────────────────────────
    function handlePrint() {
        setOpen(false);
        window.print();
    }

    const busy = !!loading;

    return (
        <div className="relative">
            <button
                onClick={() => setOpen(v => !v)}
                disabled={busy}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-[6px] text-[12px] font-[500] text-gray-600 bg-white hover:bg-gray-50 transition-colors disabled:opacity-50"
                style={{ border: "1px solid rgba(0,0,0,0.08)" }}
            >
                {busy
                    ? <><PiDownloadSimple className="text-[14px] animate-bounce" /> Exporting…</>
                    : <><PiDownloadSimple className="text-[14px]" /> Export <PiCaretDown className="text-[11px] ml-0.5" /></>
                }
            </button>

            {open && (
                <>
                    <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
                    <div className="absolute right-0 top-full mt-1 w-[180px] bg-white rounded-[8px] shadow-lg border border-gray-100 z-40 overflow-hidden">
                        <button onClick={handlePDF}
                            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[12.5px] text-gray-700 hover:bg-gray-50 transition-colors">
                            <PiFilePdf className="text-[15px] text-red-500" /> Download PDF
                        </button>
                        <button onClick={handleCSV}
                            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[12.5px] text-gray-700 hover:bg-gray-50 transition-colors">
                            <PiFileCsv className="text-[15px] text-emerald-500" /> Download CSV
                        </button>
                        <div style={{ borderTop: "1px solid rgba(0,0,0,0.06)" }}>
                            <button onClick={handlePrint}
                                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[12.5px] text-gray-700 hover:bg-gray-50 transition-colors">
                                <PiPrinter className="text-[15px] text-gray-400" /> Print
                            </button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
