"use client";

import { useState } from "react";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { PiDownloadSimple, PiFileCsv, PiFilePdf, PiPrinter, PiCaretDown, PiX } from "react-icons/pi";
import { OUTFIT_REGULAR_BASE64, OUTFIT_BOLD_BASE64 } from "@/lib/pdf-fonts/outfit-font";

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
    logoUrl?: string;        // optional brand mark, top-left of the PDF header band
    watermarkUrl?: string;   // optional low-opacity image centered behind the whole page
}

// ── helpers ───────────────────────────────────────────────────────────────────
function fmt(n: number, neg = false): string {
    const abs = Math.abs(n).toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return (neg || n < 0) ? `(${abs})` : abs;
}

function csvEsc(v: string) { return `"${v.replace(/"/g, '""')}"`; }

// Fetches a same-origin image URL and returns it as a data URI plus its
// natural dimensions/format, ready for jsPDF's addImage — which needs raw
// image data, not a URL. Same-origin fetch carries the session cookie
// automatically, so this works for both public files and auth-gated
// uploaded logos. Returns null on any failure so a broken/missing image
// never breaks the rest of the export.
async function loadImageForPdf(url: string): Promise<{ dataUri: string; width: number; height: number; format: string } | null> {
    try {
        const res = await fetch(url);
        if (!res.ok) return null;
        const blob = await res.blob();
        const dataUri = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
        const { width, height } = await new Promise<{ width: number; height: number }>((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
            img.onerror = reject;
            img.src = dataUri;
        });
        if (!width || !height) return null;
        const mime = dataUri.match(/^data:image\/(\w+);/)?.[1]?.toUpperCase() ?? 'PNG';
        return { dataUri, width, height, format: mime === 'JPG' ? 'JPEG' : mime };
    } catch {
        return null;
    }
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

            // Watermark — drawn first, before anything else, so it sits behind
            // everything else on the page.
            if (data.watermarkUrl) {
                const wm = await loadImageForPdf(data.watermarkUrl);
                if (wm) {
                    const maxSize = 120;
                    const scale = Math.min(maxSize / wm.width, maxSize / wm.height);
                    const w = wm.width * scale, h = wm.height * scale;
                    doc.setGState(new (doc as any).GState({ opacity: 0.06 }));
                    doc.addImage(wm.dataUri, wm.format, (W - w) / 2, (H - h) / 2, w, h);
                    doc.setGState(new (doc as any).GState({ opacity: 1 }));
                }
            }

            // ── Letterhead ──────────────────────────────────────────────────
            // Logo row: brand mark (left), company name (center), the
            // company's own uploaded logo (right, same image as the watermark).
            const logo = data.logoUrl ? await loadImageForPdf(data.logoUrl) : null;
            if (logo) {
                const boxH = 14;
                const w = (logo.width / logo.height) * boxH;
                doc.addImage(logo.dataUri, logo.format, 14, 6, w, boxH);
            }
            const companyLogo = data.watermarkUrl ? await loadImageForPdf(data.watermarkUrl) : null;
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

            const rows: (string | { content: string; styles: object })[][] = [];

            for (const section of data.sections) {
                // Section header row
                rows.push([
                    { content: section.title.toUpperCase(), styles: { fillColor: [236, 253, 245], textColor: [5, 150, 105], fontStyle: "bold", fontSize: 7.5 } },
                    { content: "", styles: { fillColor: [236, 253, 245] } },
                    ...(data.showPrior ? [{ content: "", styles: { fillColor: [236, 253, 245] } }] : []),
                    { content: "", styles: { fillColor: [236, 253, 245] } },
                ]);

                for (const line of section.lines) {
                    if (line.spacer) { rows.push(["", "", ...(data.showPrior ? [""] : []), ""]); continue; }

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
                startY: 58,
                head: [colHeader],
                body: rows as any,
                theme: "plain",
                headStyles: { fillColor: [5, 150, 105], textColor: [255, 255, 255], fontSize: 8, fontStyle: "bold", font: "Outfit" },
                bodyStyles: { fontSize: 8, minCellHeight: 5.5, font: "Outfit" },
                columnStyles: data.showPrior
                    ? { 0: { cellWidth: 100 }, 1: { cellWidth: 5 }, 2: { cellWidth: 35, halign: "right" }, 3: { cellWidth: 42, halign: "right" } }
                    : { 0: { cellWidth: 130 }, 1: { cellWidth: 5 }, 2: { cellWidth: 50, halign: "right" } },
                margin: { left: 8, right: 8, bottom: 22 },
                styles: { overflow: "linebreak", font: "Outfit" },
                didDrawPage: () => {
                    // ── Footer: hairline rule, brand note, small brand mark, page number —
                    // drawn on every page, matching the on-screen report's footer.
                    const pg = doc.getNumberOfPages();
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
