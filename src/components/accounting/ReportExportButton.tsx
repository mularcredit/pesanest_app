"use client";

import { useState } from "react";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { PiDownloadSimple, PiFileCsv, PiFilePdf, PiPrinter, PiCaretDown, PiX } from "react-icons/pi";
import { OUTFIT_REGULAR_BASE64, OUTFIT_BOLD_BASE64 } from "@/lib/pdf-fonts/outfit-font";
import { fmtMoney, csvEsc, loadImageForPdf } from "@/lib/pdf-report-utils";

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
    note?: boolean;     // text-only row (e.g. a scope sentence or a recommendation bullet) — no amount column
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
    logoUrl?: string;        // optional brand mark, top-left of the PDF header band
    watermarkUrl?: string;   // optional low-opacity image centered behind the whole page
}

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
            const H = doc.internal.pageSize.getHeight();

            // Outfit — jsPDF only ships Helvetica/Times/Courier; register the
            // app's actual brand font from the base64 TTFs fetched at build time
            // (see src/lib/pdf-fonts/outfit-font.ts) so exported PDFs read as
            // Pesanest documents, not generic Helvetica ones.
            doc.addFileToVFS("Outfit-Regular.ttf", OUTFIT_REGULAR_BASE64);
            doc.addFont("Outfit-Regular.ttf", "Outfit", "normal");
            doc.addFileToVFS("Outfit-Bold.ttf", OUTFIT_BOLD_BASE64);
            doc.addFont("Outfit-Bold.ttf", "Outfit", "bold");
            doc.setFont("Outfit", "normal");

            const logo = data.logoUrl ? await loadImageForPdf(data.logoUrl) : null;
            const companyLogo = data.watermarkUrl ? await loadImageForPdf(data.watermarkUrl) : null;

            // Chrome (watermark + footer) is redrawn on whatever page is
            // currently active — called once per page (letterhead, TOC, and
            // every page each section's autoTable produces) so both persist
            // across the whole document instead of just page 1. Guarded by
            // page number so a manual pre-emptive page break followed by
            // autoTable's own didDrawPage on that same fresh page can't
            // double-composite the watermark/footer.
            const chromedPages = new Set<number>();
            function drawChrome() {
                const currentPage = doc.getCurrentPageInfo().pageNumber;
                if (chromedPages.has(currentPage)) return;
                chromedPages.add(currentPage);

                if (companyLogo) {
                    const maxSize = 120;
                    const scale = Math.min(maxSize / companyLogo.width, maxSize / companyLogo.height);
                    const w = companyLogo.width * scale, h = companyLogo.height * scale;
                    doc.setGState(new (doc as any).GState({ opacity: 0.06 }));
                    doc.addImage(companyLogo.dataUri, companyLogo.format, (W - w) / 2, (H - h) / 2, w, h);
                    doc.setGState(new (doc as any).GState({ opacity: 1 }));
                }

                const pg = currentPage;
                const footY = H - 16;
                doc.setDrawColor(220, 220, 220);
                doc.line(8, footY, W - 8, footY);

                if (logo) {
                    const iconH = 6;
                    const iconW = (logo.width / logo.height) * iconH;
                    doc.addImage(logo.dataUri, logo.format, 8, footY + 4, iconW, iconH);
                }

                doc.setFontSize(7); doc.setFont("Outfit", "normal"); doc.setTextColor(140, 140, 140);
                doc.text(`Prepared by ${data.company} · Powered by Pesanest`, logo ? 20 : 8, footY + 8.5);
                doc.text(`Page ${pg}`, W - 20, footY + 8.5);
            }

            // ── Letterhead (page 1) ────────────────────────────────────────
            // Logo row: brand mark (left), company name (center), the
            // company's own uploaded logo (right, same image as the watermark).
            if (logo) {
                const boxH = 14;
                const w = (logo.width / logo.height) * boxH;
                doc.addImage(logo.dataUri, logo.format, 14, 6, w, boxH);
            }
            if (companyLogo) {
                const boxH = 14;
                const w = (companyLogo.width / companyLogo.height) * boxH;
                doc.addImage(companyLogo.dataUri, companyLogo.format, W - 14 - w, 6, w, boxH);
            }
            doc.setTextColor(30, 30, 30);
            doc.setFontSize(12); doc.setFont("Outfit", "bold");
            doc.text(data.company, W / 2, 14, { align: "center" });

            // Thin rule under the logo row
            doc.setDrawColor(220, 220, 220);
            doc.line(8, 24, W - 8, 24);

            // Metadata strip: three equal columns, small gray label over a
            // black value — the same pattern this app's other letterheaded
            // documents (Customer Statement, Payment Receipt) already use.
            const metaY = 30;
            const colW = (W - 16) / 3;
            const metaCols: [string, string][] = [
                ["Period", data.subtitle],
                ["Generated", new Date().toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" })],
                ["Currency", currency],
            ];
            metaCols.forEach(([label, value], i) => {
                const x = 8 + i * colW;
                doc.setFontSize(7); doc.setFont("Outfit", "bold"); doc.setTextColor(150, 150, 150);
                doc.text(label.toUpperCase(), x, metaY);
                doc.setFontSize(9.5); doc.setFont("Outfit", "normal"); doc.setTextColor(30, 30, 30);
                doc.text(value, x, metaY + 5.5, { maxWidth: colW - 4 });
            });

            // Title band
            doc.setFillColor(5, 150, 105);
            doc.rect(0, 40, W, 12, "F");
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(13); doc.setFont("Outfit", "bold");
            doc.text(data.title.toUpperCase(), W / 2, 48, { align: "center" });

            drawChrome(); // page 1 (letterhead) chrome

            // Reserve page 2 for the Table of Contents — content is filled in
            // once every section's real starting page is known.
            doc.addPage();
            const tocPage = doc.getCurrentPageInfo().pageNumber;
            drawChrome();

            doc.addPage();

            const colHeader = data.showPrior
                ? ["Description / Account", "", "Prior Period", `${currency}`]
                : ["Description / Account", "", `${currency}`];

            const columnStyles: any = data.showPrior
                ? { 0: { cellWidth: 100 }, 1: { cellWidth: 5 }, 2: { cellWidth: 35, halign: "right" as const }, 3: { cellWidth: 42, halign: "right" as const } }
                : { 0: { cellWidth: 130 }, 1: { cellWidth: 5 }, 2: { cellWidth: 50, halign: "right" as const } };

            let cursorY = 16;
            const toc: { title: string; page: number }[] = [];

            for (const section of data.sections) {
                if (cursorY > H - 40) { doc.addPage(); drawChrome(); cursorY = 16; }
                toc.push({ title: section.title, page: doc.getCurrentPageInfo().pageNumber });

                const rows: (string | { content: string; styles: object; colSpan?: number })[][] = [];

                // Section header row
                rows.push([
                    { content: section.title.toUpperCase(), styles: { fillColor: [236, 253, 245], textColor: [5, 150, 105], fontStyle: "bold", fontSize: 7.5 } },
                    { content: "", styles: { fillColor: [236, 253, 245] } },
                    ...(data.showPrior ? [{ content: "", styles: { fillColor: [236, 253, 245] } }] : []),
                    { content: "", styles: { fillColor: [236, 253, 245] } },
                ]);

                for (const line of section.lines) {
                    if (line.spacer) { rows.push(["", "", ...(data.showPrior ? [""] : []), ""]); continue; }

                    if (line.note) {
                        rows.push([
                            { content: line.name, colSpan: data.showPrior ? 4 : 3, styles: { fontStyle: line.isBold ? "bold" : "normal", textColor: [70, 70, 70] } },
                        ]);
                        continue;
                    }

                    const nameStyle: any = {};
                    const amtStyle: any = { halign: "right" };
                    const priorStyle: any = { halign: "right", textColor: [180, 180, 180] };

                    if (line.isGrandTotal) {
                        nameStyle.fillColor = [236, 253, 245]; nameStyle.fontStyle = "bold"; nameStyle.fontSize = 9;
                        amtStyle.fillColor = [236, 253, 245]; amtStyle.fontStyle = "bold"; amtStyle.fontSize = 9;
                        priorStyle.fillColor = [236, 253, 245];
                    } else if (line.isSubtotal || line.isBold) {
                        nameStyle.fontStyle = "bold"; amtStyle.fontStyle = "bold";
                    }

                    const prefix = line.indent ? "    " : "";
                    const name = `${prefix}${line.code ? `[${line.code}]  ` : ""}${line.name}`;
                    const amount = line.isNegative ? `(${fmtMoney(line.current)})` : fmtMoney(line.current);
                    const prior = line.prior !== undefined ? (line.isNegative ? `(${fmtMoney(line.prior)})` : fmtMoney(line.prior)) : "—";

                    rows.push([
                        { content: name, styles: nameStyle },
                        { content: "", styles: {} },
                        ...(data.showPrior ? [{ content: prior, styles: priorStyle }] : []),
                        { content: amount, styles: amtStyle },
                    ]);
                }

                autoTable(doc, {
                    startY: cursorY,
                    head: [colHeader],
                    body: rows as any,
                    theme: "plain",
                    headStyles: { fillColor: [5, 150, 105], textColor: [255, 255, 255], fontSize: 8, fontStyle: "bold", font: "Outfit" },
                    bodyStyles: { fontSize: 8, minCellHeight: 5.5, font: "Outfit" },
                    columnStyles,
                    margin: { left: 8, right: 8, bottom: 22 },
                    styles: { overflow: "linebreak", font: "Outfit" },
                    // Redraws the watermark + footer on every page this section's
                    // table spans, matching the on-screen report's footer.
                    didDrawPage: () => drawChrome(),
                });

                cursorY = (doc as any).lastAutoTable.finalY + 10;
            }

            // ── Fill in the reserved Table of Contents page ──────────────────
            doc.setPage(tocPage);
            let tocY = 20;
            doc.setFontSize(14); doc.setFont("Outfit", "bold"); doc.setTextColor(30, 30, 30);
            doc.text("TABLE OF CONTENTS", W / 2, tocY, { align: "center" });
            tocY += 14;
            for (const entry of toc) {
                doc.setFontSize(10); doc.setFont("Outfit", "normal"); doc.setTextColor(30, 30, 30);
                doc.text(entry.title, 14, tocY);
                const pageStr = String(entry.page);
                doc.text(pageStr, W - 14, tocY, { align: "right" });

                const titleW = doc.getTextWidth(entry.title);
                const pageW = doc.getTextWidth(pageStr);
                const dotsStart = 14 + titleW + 2;
                const dotsEnd = W - 14 - pageW - 2;
                if (dotsEnd > dotsStart) {
                    doc.setTextColor(190, 190, 190);
                    const dotW = doc.getTextWidth(". ");
                    doc.text(". ".repeat(Math.max(0, Math.floor((dotsEnd - dotsStart) / dotW))), dotsStart, tocY);
                }
                tocY += 8;
            }

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
                    if (line.note) {
                        rows.push(data.showPrior
                            ? [csvEsc(section.title), "", csvEsc(line.name), "", ""]
                            : [csvEsc(section.title), "", csvEsc(line.name), ""]);
                        continue;
                    }
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
