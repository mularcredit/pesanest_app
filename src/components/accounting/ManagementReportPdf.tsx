"use client";

import { useState } from "react";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { PiDownloadSimple, PiFileCsv, PiFilePdf, PiPrinter, PiCaretDown } from "react-icons/pi";
import { OUTFIT_REGULAR_BASE64, OUTFIT_BOLD_BASE64 } from "@/lib/pdf-fonts/outfit-font";
import { fmtMoney, csvEsc, loadImageForPdf } from "@/lib/pdf-report-utils";

// ── data model ─────────────────────────────────────────────────────────────
// Purpose-built for the Management Report's executive layout (KPI dashboard,
// narrative highlights, pipeline diagram, risk/action trackers) — distinct
// from ReportExportButton's generic accounting-table ReportSection/ReportLine
// shape, which the other 4 report pages (Income Statement, Balance Sheet,
// Cash Flow, Trial Balance) still use unchanged.
export interface MgmtLineItem {
    code?: string;
    name: string;
    amount: number;
}

export interface ManagementReportData {
    meta: {
        companyName: string;
        logoUrl?: string;       // Pesanest/Prudence brand mark
        watermarkUrl?: string;  // the company's own uploaded logo
        periodLabel: string;
        monthLabel: string;
        currency: string;
        generatedLabel: string;
    };
    kpis: { label: string; value: string; sub: string }[];
    executiveSummary: string;
    highlights: string[];
    risks: { severity: "high" | "medium" | "low"; title: string; amount: number; status: string }[];
    actions: { action: string; owner?: string; dueDate?: string; status?: string }[];
    incomeStatement: { revenue: MgmtLineItem[]; expenses: MgmtLineItem[]; netIncome: number };
    balanceSheet: { totalAssets: number; totalLiabilities: number; totalEquity: number };
    cashFlow: {
        operating: { items: MgmtLineItem[]; total: number };
        investing: { items: MgmtLineItem[]; total: number };
        financing: { items: MgmtLineItem[]; total: number };
        netChange: number;
    };
    cashPosition: number;
    spendingCategories: { category: string; amount: number; pct: number; count: number }[];
    pipeline: { label: string; count: number; amount: number }[];
    transactions: { date: string; description: string; category: string; requestedBy: string; status: string; amount: number }[];
}

// ── palette ────────────────────────────────────────────────────────────────
const GREEN: [number, number, number] = [5, 150, 105];
const GREEN_SOFT: [number, number, number] = [110, 195, 165];
const DARK: [number, number, number] = [30, 30, 30];
const MID: [number, number, number] = [90, 90, 90];
const GRAY: [number, number, number] = [140, 140, 140];
const FAINT: [number, number, number] = [180, 180, 180];
const HAIRLINE: [number, number, number] = [228, 228, 228];
const TRACK: [number, number, number] = [243, 244, 246];
const SEV_COLOR: Record<string, [number, number, number]> = {
    high: [220, 38, 38],
    medium: [217, 119, 6],
    low: [5, 150, 105],
};
const STATUS_COLOR: Record<string, [number, number, number]> = {
    "open": [217, 119, 6],
    "flagged": [220, 38, 38],
    "resolved": [5, 150, 105],
    "monitor": [90, 90, 90],
};

function compact(n: number): string {
    const abs = Math.abs(n);
    if (abs >= 1_000_000) return `${n < 0 ? "-" : ""}KES ${(abs / 1_000_000).toFixed(2)}M`;
    if (abs >= 10_000) return `${n < 0 ? "-" : ""}KES ${(abs / 1000).toFixed(1)}K`;
    return `KES ${fmtMoney(n)}`;
}

const TOC_LAYERS = ["01  EXECUTIVE OVERVIEW", "02  FINANCIAL PERFORMANCE", "03  OPERATIONS & CONTROLS", "04  APPENDICES"];

export function ManagementReportPdf({ data }: { data: ManagementReportData }) {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState<"pdf" | "csv" | null>(null);
    const currency = data.meta.currency;

    // ── PDF ────────────────────────────────────────────────────────────────
    async function handlePDF() {
        setLoading("pdf"); setOpen(false);
        try {
            const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
            const W = doc.internal.pageSize.getWidth();
            const H = doc.internal.pageSize.getHeight();

            doc.addFileToVFS("Outfit-Regular.ttf", OUTFIT_REGULAR_BASE64);
            doc.addFont("Outfit-Regular.ttf", "Outfit", "normal");
            doc.addFileToVFS("Outfit-Bold.ttf", OUTFIT_BOLD_BASE64);
            doc.addFont("Outfit-Bold.ttf", "Outfit", "bold");
            doc.setFont("Outfit", "normal");

            const logo = data.meta.logoUrl ? await loadImageForPdf(data.meta.logoUrl) : null;
            const companyLogo = data.meta.watermarkUrl ? await loadImageForPdf(data.meta.watermarkUrl) : null;

            const M = 8, TOP = 26, BOTTOM = H - 22;
            let cursorY = TOP;

            type Style = { weight?: "normal" | "bold"; size: number; color: [number, number, number] };
            function apply(s: Style) {
                doc.setFont("Outfit", s.weight ?? "normal");
                doc.setFontSize(s.size);
                doc.setTextColor(s.color[0], s.color[1], s.color[2]);
            }

            function drawWatermark() {
                if (!companyLogo) return;
                const maxSize = 110;
                const scale = Math.min(maxSize / companyLogo.width, maxSize / companyLogo.height);
                const w = companyLogo.width * scale, h = companyLogo.height * scale;
                doc.setGState(new (doc as any).GState({ opacity: 0.05 }));
                doc.addImage(companyLogo.dataUri, companyLogo.format, (W - w) / 2, (H - h) / 2, w, h);
                doc.setGState(new (doc as any).GState({ opacity: 1 }));
            }

            // Running header + footer + watermark, drawn on every page from the
            // Table of Contents onward (the cover is a standalone page — see
            // drawCover). Idempotent per page number so a manual pre-emptive
            // page break followed by autoTable's own didDrawPage on that same
            // fresh page can't double-composite the watermark/footer.
            const chromedPages = new Set<number>();
            function drawChrome() {
                const pg = doc.getCurrentPageInfo().pageNumber;
                if (chromedPages.has(pg)) return;
                chromedPages.add(pg);

                drawWatermark();

                apply({ weight: "bold", size: 8, color: GRAY });
                doc.text(data.meta.companyName.toUpperCase(), M, 12);
                doc.text("MANAGEMENT REPORT", W - M, 12, { align: "right" });
                apply({ size: 7, color: FAINT });
                doc.text(data.meta.monthLabel, M, 16.5);
                doc.setDrawColor(...HAIRLINE); doc.setLineWidth(0.2);
                doc.line(M, 19, W - M, 19);

                const footY = H - 16;
                doc.line(M, footY, W - M, footY);
                apply({ size: 7, color: GRAY });
                doc.text(`${data.meta.companyName} · CONFIDENTIAL`, M, footY + 6);
                apply({ size: 6, color: FAINT });
                doc.text("Powered by Pesanest", M, footY + 10);
                apply({ size: 7, color: GRAY });
                doc.text(`Page ${pg}`, W - M, footY + 6, { align: "right" });
            }

            function newPage() { doc.addPage(); drawChrome(); cursorY = TOP; }
            function ensureSpace(h: number) {
                if (cursorY + h <= BOTTOM) return;
                if (cursorY === TOP) return; // a single block taller than a page — draw anyway, don't loop
                newPage();
            }

            // ── Cover page ──────────────────────────────────────────────────
            drawWatermark();
            doc.setDrawColor(...GREEN); doc.setLineWidth(0.9);
            doc.line(16, 36, 16, H - 36);

            if (logo) {
                const boxH = 11, w = (logo.width / logo.height) * boxH;
                doc.addImage(logo.dataUri, logo.format, (W - w) / 2, 58, w, boxH);
            }

            apply({ weight: "bold", size: 27, color: DARK });
            doc.text("MANAGEMENT REPORT", W / 2, 112, { align: "center" });
            apply({ size: 13, color: MID });
            doc.text(data.meta.monthLabel, W / 2, 123, { align: "center" });
            apply({ size: 10, color: GRAY });
            doc.text("Financial & Operational Performance", W / 2, 133, { align: "center" });
            apply({ size: 9.5, color: FAINT });
            doc.text("For Management Review", W / 2, 140.5, { align: "center" });

            if (companyLogo) {
                const boxH = 17, w = (companyLogo.width / companyLogo.height) * boxH;
                doc.addImage(companyLogo.dataUri, companyLogo.format, (W - w) / 2, 168, w, boxH);
            } else {
                apply({ weight: "bold", size: 14, color: DARK });
                doc.text(data.meta.companyName, W / 2, 180, { align: "center" });
            }

            const metaRows: [string, string][] = [
                ["Reporting Period", data.meta.periodLabel],
                ["Currency", data.meta.currency],
                ["Generated", data.meta.generatedLabel],
            ];
            let coverMetaY = 208;
            metaRows.forEach(([label, value]) => {
                apply({ weight: "bold", size: 7.5, color: GRAY });
                doc.text(label.toUpperCase(), W / 2 - 42, coverMetaY);
                apply({ size: 9.5, color: DARK });
                doc.text(value, W / 2 + 42, coverMetaY, { align: "right" });
                doc.setDrawColor(238, 238, 238); doc.setLineWidth(0.15);
                doc.line(W / 2 - 42, coverMetaY + 2.3, W / 2 + 42, coverMetaY + 2.3);
                coverMetaY += 9;
            });

            apply({ weight: "bold", size: 7.5, color: FAINT });
            doc.text("CONFIDENTIAL — INTERNAL MANAGEMENT USE", W / 2, 252, { align: "center" });

            // ── Table of Contents (reserved page 2; content filled at the end) ──
            doc.addPage();
            const tocPage = doc.getCurrentPageInfo().pageNumber;
            drawChrome();

            newPage();

            // ── Section registry ────────────────────────────────────────────
            const toc: { layer: number; title: string; page: number }[] = [];

            // `reserve` is the height of whatever immediately follows the
            // heading (a KPI grid, a chart, a table's first rows, …) — folding
            // it into the same space check keeps the heading from ever landing
            // alone at the bottom of a page with its content pushed to the next.
            function heading(title: string, layer: number, reserve = 0) {
                ensureSpace(14 + reserve);
                toc.push({ layer, title, page: doc.getCurrentPageInfo().pageNumber });
                apply({ weight: "bold", size: 7.5, color: GREEN });
                doc.text(`${String(layer + 1).padStart(2, "0")}`, M, cursorY);
                apply({ weight: "bold", size: 12, color: DARK });
                doc.text(title, M + 9, cursorY);
                doc.setDrawColor(...HAIRLINE); doc.setLineWidth(0.2);
                doc.line(M, cursorY + 3, W - M, cursorY + 3);
                cursorY += 10;
            }

            function subheading(title: string) {
                ensureSpace(8);
                apply({ weight: "bold", size: 9, color: DARK });
                doc.text(title.toUpperCase(), M, cursorY);
                cursorY += 6;
            }

            function paragraph(text: string, s: Style = { size: 9, color: MID }, lineH = 4.6) {
                apply(s);
                const lines = doc.splitTextToSize(text, W - 2 * M) as string[];
                ensureSpace(Math.min(2, lines.length) * lineH);
                for (const ln of lines) {
                    if (cursorY + lineH > BOTTOM) { newPage(); apply(s); }
                    doc.text(ln, M, cursorY);
                    cursorY += lineH;
                }
                cursorY += 2;
            }

            function bullets(items: string[]) {
                const s: Style = { size: 8.8, color: MID };
                for (const it of items) {
                    apply(s);
                    const lines = doc.splitTextToSize(it, W - 2 * M - 6) as string[];
                    ensureSpace(lines.length * 4.6 + 1.5);
                    doc.setFillColor(...GREEN);
                    doc.circle(M + 1.1, cursorY - 1.3, 0.7, "F");
                    apply(s);
                    lines.forEach((ln, i) => doc.text(ln, M + 5, cursorY + i * 4.6));
                    cursorY += lines.length * 4.6 + 2.5;
                }
            }

            // ── deterministic blocks ────────────────────────────────────────
            // Drawn as one continuous bordered band per row with internal
            // divider lines between cells (rather than separate boxes with
            // gaps) — a single unified strip reads more like a printed report
            // metric line and less like a stack of dashboard widgets.
            function blockGrid(items: { label: string; value: string; sub: string }[]) {
                const rowsOf = items.length > 3 ? [3, items.length - 3] : [items.length];
                const bh = 22, rowGap = 6;
                const totalH = rowsOf.length * bh + (rowsOf.length - 1) * rowGap;
                ensureSpace(totalH);
                let idx = 0, y = cursorY;
                for (const n of rowsOf) {
                    const bw = (W - 2 * M) / n;
                    doc.setDrawColor(...HAIRLINE); doc.setLineWidth(0.2);
                    doc.rect(M, y, W - 2 * M, bh);
                    doc.setFillColor(...GREEN);
                    doc.rect(M, y, W - 2 * M, 0.8, "F");

                    for (let i = 0; i < n; i++) {
                        const x = M + i * bw;
                        if (i > 0) doc.line(x, y, x, y + bh);
                        const k = items[idx++];

                        apply({ weight: "bold", size: 6.5, color: GRAY });
                        doc.text(k.label.toUpperCase(), x + 4, y + 6);

                        let fs = 13.5;
                        doc.setFont("Outfit", "bold"); doc.setFontSize(fs);
                        while (doc.getTextWidth(k.value) > bw - 8 && fs > 8) { fs -= 0.5; doc.setFontSize(fs); }
                        doc.setTextColor(...DARK);
                        doc.text(k.value, x + 4, y + 14.5);

                        apply({ size: 6.5, color: GRAY });
                        doc.text(k.sub, x + 4, y + 19, { maxWidth: bw - 8 });
                    }
                    y += bh + rowGap;
                }
                cursorY += totalH + 8;
            }

            function barChart(items: { category: string; amount: number; pct: number }[]) {
                const RH = 11, BAR_H = 4, GUTTER = 44;
                const trackW = (W - 2 * M) - GUTTER - 4;
                const maxAmt = Math.max(...items.map(i => i.amount), 1);
                const totalH = items.length * RH + 4;
                ensureSpace(totalH);
                const top = cursorY;
                items.forEach((it, i) => {
                    const ry = top + i * RH;
                    apply({ size: 8, color: MID });
                    const labelLines = doc.splitTextToSize(it.category, trackW * 0.55) as string[];
                    doc.text(labelLines[0], M, ry + 3);

                    apply({ weight: "bold", size: 8, color: DARK });
                    doc.text(fmtMoney(it.amount), W - M, ry + 3, { align: "right" });
                    apply({ size: 7, color: FAINT });
                    doc.text(`${it.pct.toFixed(1)}%`, W - M - GUTTER + 10, ry + 3, { align: "right" });

                    doc.setFillColor(...TRACK);
                    doc.rect(M, ry + 5, trackW, BAR_H, "F");
                    const bw = Math.max(0.8, (Math.max(0, it.amount) / maxAmt) * trackW);
                    doc.setFillColor(...(i === 0 ? GREEN : GREEN_SOFT));
                    doc.rect(M, ry + 5, bw, BAR_H, "F");
                });
                cursorY = top + totalH + 8;
            }

            function pipelineDiagram(stages: { label: string; count: number; amount: number }[]) {
                const N = stages.length, ARROW_W = 8, boxH = 22;
                const boxW = ((W - 2 * M) - (N - 1) * ARROW_W) / N;
                ensureSpace(boxH + 6);
                const y = cursorY;
                stages.forEach((s, i) => {
                    const x = M + i * (boxW + ARROW_W);
                    doc.setDrawColor(...HAIRLINE); doc.setLineWidth(0.2);
                    doc.rect(x, y, boxW, boxH);
                    doc.setFillColor(...GREEN);
                    doc.rect(x, y, boxW, 1, "F");

                    const cx = x + boxW / 2;
                    apply({ weight: "bold", size: 7, color: GRAY });
                    doc.text(s.label.toUpperCase(), cx, y + 7, { align: "center" });
                    apply({ weight: "bold", size: 13, color: DARK });
                    doc.text(String(s.count), cx, y + 14, { align: "center" });
                    apply({ size: 7, color: MID });
                    doc.text(compact(s.amount), cx, y + 19, { align: "center", maxWidth: boxW - 4 });

                    if (i < stages.length - 1) {
                        const x1 = x + boxW + 1.5, x2 = x + boxW + ARROW_W - 1.5, ay = y + boxH / 2;
                        doc.setDrawColor(...FAINT); doc.setLineWidth(0.35);
                        doc.line(x1, ay, x2 - 1.6, ay);
                        doc.setFillColor(...FAINT);
                        doc.triangle(x2 - 1.6, ay - 1.1, x2 - 1.6, ay + 1.1, x2, ay, "F");
                    }
                });
                cursorY = y + boxH + 8;
            }

            function metricRow(items: { label: string; value: string }[]) {
                blockGrid(items.map(i => ({ label: i.label, value: i.value, sub: "" })));
            }

            // ── 01 · Executive Overview ─────────────────────────────────────
            const kpiRows = data.kpis.length > 3 ? 2 : 1;
            heading("Key Financial Metrics", 0, kpiRows * 22 + (kpiRows - 1) * 6);
            blockGrid(data.kpis);

            heading("Executive Summary", 0, 14);
            paragraph(data.executiveSummary);

            heading("Highlights & Exceptions", 0, 14);
            subheading("Performance Highlights");
            bullets(data.highlights.length ? data.highlights : ["No notable performance highlights for this period."]);
            subheading("Key Risks & Exceptions");
            bullets(
                data.risks.length
                    ? data.risks.slice(0, 3).map(r => `${r.title} — ${fmtMoney(r.amount)} ${currency} (${r.severity} severity)`)
                    : ["No exceptions flagged for this period."]
            );
            subheading("Management Attention");
            bullets(data.actions.length ? data.actions.map(a => a.action) : ["No outstanding actions for this period."]);

            // ── 02 · Financial Performance ──────────────────────────────────
            heading("Income Statement", 1, 22);
            {
                const rows: any[] = [];
                rows.push([{ content: "REVENUE", styles: { fontStyle: "bold", fontSize: 7.5, textColor: GRAY } }, ""]);
                for (const r of data.incomeStatement.revenue) {
                    rows.push([`${r.code ? `${r.code} · ` : ""}${r.name}`, { content: fmtMoney(r.amount), styles: { halign: "right" } }]);
                }
                rows.push(["", ""]);
                rows.push([{ content: "OPERATING EXPENSES", styles: { fontStyle: "bold", fontSize: 7.5, textColor: GRAY } }, ""]);
                for (const e of data.incomeStatement.expenses) {
                    rows.push([`    ${e.code ? `${e.code} · ` : ""}${e.name}`, { content: `(${fmtMoney(e.amount)})`, styles: { halign: "right" } }]);
                }
                ensureSpace(20);
                autoTable(doc, {
                    startY: cursorY,
                    head: [["Description / Account", currency]],
                    body: rows,
                    theme: "plain",
                    styles: { font: "Outfit", fontSize: 8.5, textColor: DARK },
                    headStyles: { fontStyle: "bold", fontSize: 7, textColor: FAINT },
                    columnStyles: { 0: { cellWidth: W - 2 * M - 45 }, 1: { cellWidth: 45, halign: "right" } },
                    margin: { top: TOP, left: M, right: M, bottom: 22 },
                    rowPageBreak: "avoid",
                    showHead: "everyPage",
                    didDrawPage: () => drawChrome(),
                });
                cursorY = (doc as any).lastAutoTable.finalY + 3;
                ensureSpace(9);
                doc.setDrawColor(...DARK); doc.setLineWidth(0.4);
                doc.line(M, cursorY, W - M, cursorY);
                cursorY += 5;
                apply({ weight: "bold", size: 10, color: DARK });
                doc.text("NET INCOME", M, cursorY);
                doc.text(fmtMoney(data.incomeStatement.netIncome), W - M, cursorY, { align: "right" });
                cursorY += 11;
            }

            heading("Balance Sheet", 1, 22);
            metricRow([
                { label: "Total Assets", value: fmtMoney(data.balanceSheet.totalAssets) },
                { label: "Total Liabilities", value: fmtMoney(data.balanceSheet.totalLiabilities) },
                { label: "Total Equity", value: fmtMoney(data.balanceSheet.totalEquity) },
            ]);

            heading("Cash Flow Statement", 1, 22);
            {
                const cf = data.cashFlow;
                const cfRows: any[] = [];
                const group = (label: string, g: { items: MgmtLineItem[]; total: number }) => {
                    cfRows.push([{ content: label, styles: { fontStyle: "bold", fontSize: 7.5, textColor: GRAY } }, ""]);
                    for (const it of g.items) {
                        cfRows.push([`  ${it.name}`, { content: fmtMoney(it.amount), styles: { halign: "right" } }]);
                    }
                    cfRows.push([
                        { content: `Net Cash from ${label}`, styles: { fontStyle: "bold" } },
                        { content: fmtMoney(g.total), styles: { halign: "right", fontStyle: "bold" } },
                    ]);
                    cfRows.push(["", ""]);
                };
                group("Operating Activities", cf.operating);
                group("Investing Activities", cf.investing);
                group("Financing Activities", cf.financing);
                cfRows.pop(); // drop the trailing spacer row

                ensureSpace(20);
                autoTable(doc, {
                    startY: cursorY,
                    head: [["Description", currency]],
                    body: cfRows,
                    theme: "plain",
                    styles: { font: "Outfit", fontSize: 8.5, textColor: DARK },
                    headStyles: { fontStyle: "bold", fontSize: 7, textColor: FAINT },
                    columnStyles: { 0: { cellWidth: W - 2 * M - 45 }, 1: { cellWidth: 45, halign: "right" } },
                    margin: { top: TOP, left: M, right: M, bottom: 22 },
                    rowPageBreak: "avoid",
                    showHead: "everyPage",
                    didDrawPage: () => drawChrome(),
                });
                cursorY = (doc as any).lastAutoTable.finalY + 3;
                ensureSpace(9);
                doc.setDrawColor(...DARK); doc.setLineWidth(0.4);
                doc.line(M, cursorY, W - M, cursorY);
                cursorY += 5;
                apply({ weight: "bold", size: 10, color: DARK });
                doc.text("Net Increase / (Decrease) in Cash", M, cursorY);
                doc.text(fmtMoney(cf.netChange), W - M, cursorY, { align: "right" });
                cursorY += 6;
                apply({ size: 8, color: GRAY });
                doc.text("Cash Balance on Books", M, cursorY);
                doc.text(fmtMoney(data.cashPosition), W - M, cursorY, { align: "right" });
                cursorY += 11;
            }

            heading("Spending Analysis", 1, data.spendingCategories.length > 0 ? Math.min(8, data.spendingCategories.length) * 11 + 4 : 14);
            if (data.spendingCategories.length > 0) {
                barChart(data.spendingCategories.slice(0, 8).map(c => ({ category: c.category, amount: c.amount, pct: c.pct })));
                ensureSpace(12);
                autoTable(doc, {
                    startY: cursorY,
                    head: [["Category", "Items", "Share", currency]],
                    body: data.spendingCategories.map(c => [c.category, String(c.count), `${c.pct.toFixed(1)}%`, fmtMoney(c.amount)]),
                    theme: "plain",
                    styles: { font: "Outfit", fontSize: 8, textColor: MID },
                    headStyles: { fontStyle: "bold", fontSize: 7, textColor: FAINT },
                    columnStyles: { 0: { cellWidth: W - 2 * M - 90 }, 1: { cellWidth: 20, halign: "right" }, 2: { cellWidth: 25, halign: "right" }, 3: { cellWidth: 45, halign: "right" } },
                    margin: { top: TOP, left: M, right: M, bottom: 22 },
                    rowPageBreak: "avoid",
                    showHead: "everyPage",
                    didDrawPage: () => drawChrome(),
                });
                cursorY = (doc as any).lastAutoTable.finalY + 10;
            } else {
                paragraph("No spending recorded for this period.");
            }

            // ── 03 · Operations & Controls ──────────────────────────────────
            heading("Requisition Pipeline", 2, 28);
            pipelineDiagram(data.pipeline);

            heading("Risks & Spending Alerts", 2, data.risks.length > 0 ? 22 : 14);
            if (data.risks.length > 0) {
                ensureSpace(14);
                autoTable(doc, {
                    startY: cursorY,
                    head: [["", "Exception", "Amount", "Status / Action"]],
                    body: data.risks.map(r => ["", r.title, fmtMoney(r.amount), r.status]),
                    theme: "plain",
                    styles: { font: "Outfit", fontSize: 8, textColor: MID, valign: "top" },
                    headStyles: { fillColor: GREEN, textColor: 255, fontStyle: "bold", fontSize: 7.5 },
                    columnStyles: { 0: { cellWidth: 7 }, 1: { cellWidth: W - 2 * M - 7 - 35 - 45 }, 2: { cellWidth: 35, halign: "right" }, 3: { cellWidth: 45 } },
                    margin: { top: TOP, left: M, right: M, bottom: 22 },
                    rowPageBreak: "avoid",
                    showHead: "everyPage",
                    didDrawCell: (d) => {
                        if (d.section !== "body" || d.column.index !== 0) return;
                        const color = SEV_COLOR[data.risks[d.row.index]?.severity] ?? GRAY;
                        doc.setFillColor(...color);
                        doc.circle(d.cell.x + d.cell.width / 2, d.cell.y + 3.6, 1.1, "F");
                    },
                    didDrawPage: () => drawChrome(),
                });
                cursorY = (doc as any).lastAutoTable.finalY + 10;
            } else {
                paragraph("No spending alerts identified for this period.");
            }

            heading("Management Actions", 2, data.actions.length > 0 ? 22 : 14);
            if (data.actions.length > 0) {
                ensureSpace(14);
                autoTable(doc, {
                    startY: cursorY,
                    head: [["Action", "Owner", "Due Date", "Status"]],
                    body: data.actions.map(a => [a.action, a.owner || "—", a.dueDate || "—", a.status || "Open"]),
                    theme: "plain",
                    styles: { font: "Outfit", fontSize: 8, textColor: MID, valign: "top" },
                    headStyles: { fillColor: GREEN, textColor: 255, fontStyle: "bold", fontSize: 7.5 },
                    columnStyles: { 0: { cellWidth: W - 2 * M - 30 - 28 - 28 }, 1: { cellWidth: 30 }, 2: { cellWidth: 28 }, 3: { cellWidth: 28 } },
                    margin: { top: TOP, left: M, right: M, bottom: 22 },
                    rowPageBreak: "avoid",
                    showHead: "everyPage",
                    didParseCell: (d) => {
                        if (d.section !== "body" || d.column.index !== 3) return;
                        const key = String(d.cell.raw).toLowerCase();
                        d.cell.styles.textColor = STATUS_COLOR[key] ?? MID;
                        d.cell.styles.fontStyle = "bold";
                    },
                    didDrawPage: () => drawChrome(),
                });
                cursorY = (doc as any).lastAutoTable.finalY + 10;
            } else {
                paragraph("No outstanding actions for this period.");
            }

            // ── 04 · Appendices ──────────────────────────────────────────────
            newPage();
            apply({ weight: "bold", size: 8, color: GREEN });
            doc.text("APPENDICES", M, 90);
            apply({ weight: "bold", size: 20, color: DARK });
            doc.text(`A — Detailed Transactions (${data.transactions.length})`, M, 102);
            doc.setDrawColor(...HAIRLINE); doc.setLineWidth(0.2);
            doc.line(M, 108, W - M, 108);
            apply({ size: 9, color: GRAY });
            doc.text("Full itemized listing of every requisition recorded in the reporting period, for reference.", M, 116);
            toc.push({ layer: 3, title: "Detailed Transactions", page: doc.getCurrentPageInfo().pageNumber });
            newPage();

            if (data.transactions.length > 0) {
                autoTable(doc, {
                    startY: cursorY,
                    head: [["Date", "Description", "Category", "Requested By", "Status", currency]],
                    body: data.transactions.map(t => [t.date, t.description, t.category, t.requestedBy, t.status, fmtMoney(t.amount)]),
                    theme: "striped",
                    styles: { font: "Outfit", fontSize: 7.5, textColor: MID, overflow: "linebreak" },
                    headStyles: { fillColor: GREEN, textColor: 255, fontStyle: "bold", fontSize: 7.5 },
                    alternateRowStyles: { fillColor: [250, 250, 250] },
                    columnStyles: {
                        0: { cellWidth: 20 },
                        1: { cellWidth: "auto" },
                        2: { cellWidth: 30 },
                        3: { cellWidth: 28 },
                        4: { cellWidth: 20 },
                        5: { cellWidth: 26, halign: "right" },
                    },
                    margin: { top: TOP, left: M, right: M, bottom: 22 },
                    rowPageBreak: "avoid",
                    showHead: "everyPage",
                    didDrawPage: () => drawChrome(),
                });
            } else {
                apply({ size: 9, color: GRAY });
                doc.text("No requisitions recorded in this period.", M, cursorY);
            }

            // ── Fill in the reserved Table of Contents ──────────────────────
            doc.setPage(tocPage);
            let y = 34, lastLayer = -1;
            const LEFT = 16, RIGHT = W - 16, INDENT = 8;
            function leaderRow(xL: number, xR: number, yy: number, title: string, pageStr: string) {
                apply({ size: 9.5, color: [45, 45, 45] });
                doc.text(title, xL, yy);
                doc.text(pageStr, xR, yy, { align: "right" });
                const dotsStart = xL + doc.getTextWidth(title) + 2;
                const dotsEnd = xR - doc.getTextWidth(pageStr) - 2;
                if (dotsEnd > dotsStart) {
                    doc.setTextColor(200, 200, 200);
                    const dotW = doc.getTextWidth(". ");
                    const n = Math.floor((dotsEnd - dotsStart) / dotW);
                    doc.text(". ".repeat(Math.max(0, n)), dotsEnd, yy, { align: "right" });
                }
            }
            apply({ weight: "bold", size: 15, color: DARK });
            doc.text("TABLE OF CONTENTS", W / 2, 24, { align: "center" });
            for (const entry of toc) {
                if (entry.layer !== lastLayer) {
                    if (lastLayer !== -1) y += 6;
                    apply({ weight: "bold", size: 8, color: GREEN });
                    doc.text(TOC_LAYERS[entry.layer], LEFT, y);
                    doc.setDrawColor(232, 232, 232); doc.setLineWidth(0.2);
                    doc.line(LEFT, y + 1.8, RIGHT, y + 1.8);
                    y += 8;
                    lastLayer = entry.layer;
                }
                leaderRow(LEFT + INDENT, RIGHT, y, entry.title, String(entry.page));
                y += 6.5;
            }

            doc.save(`Management_Report_${new Date().toISOString().slice(0, 10)}.pdf`);
        } catch (e: any) {
            alert("PDF export failed: " + e.message);
        } finally { setLoading(null); }
    }

    // ── CSV ────────────────────────────────────────────────────────────────
    function handleCSV() {
        setLoading("csv"); setOpen(false);
        try {
            const rows: string[][] = [["Section", "Item", "Detail", `Amount (${currency})`]];
            for (const k of data.kpis) rows.push([csvEsc("Key Financial Metrics"), csvEsc(k.label), csvEsc(k.sub), k.value.replace(/[^0-9.-]/g, "")]);
            rows.push([csvEsc("Executive Summary"), csvEsc(data.executiveSummary), "", ""]);
            for (const h of data.highlights) rows.push([csvEsc("Performance Highlights"), csvEsc(h), "", ""]);
            for (const r of data.incomeStatement.revenue) rows.push([csvEsc("Income Statement — Revenue"), csvEsc(r.name), r.code ?? "", r.amount.toFixed(2)]);
            for (const e of data.incomeStatement.expenses) rows.push([csvEsc("Income Statement — Expenses"), csvEsc(e.name), e.code ?? "", (-e.amount).toFixed(2)]);
            rows.push([csvEsc("Income Statement"), csvEsc("Net Income"), "", data.incomeStatement.netIncome.toFixed(2)]);
            rows.push([csvEsc("Balance Sheet"), csvEsc("Total Assets"), "", data.balanceSheet.totalAssets.toFixed(2)]);
            rows.push([csvEsc("Balance Sheet"), csvEsc("Total Liabilities"), "", data.balanceSheet.totalLiabilities.toFixed(2)]);
            rows.push([csvEsc("Balance Sheet"), csvEsc("Total Equity"), "", data.balanceSheet.totalEquity.toFixed(2)]);
            for (const it of data.cashFlow.operating.items) rows.push([csvEsc("Cash Flow — Operating Activities"), csvEsc(it.name), "", it.amount.toFixed(2)]);
            rows.push([csvEsc("Cash Flow Statement"), csvEsc("Net Cash from Operating Activities"), "", data.cashFlow.operating.total.toFixed(2)]);
            for (const it of data.cashFlow.investing.items) rows.push([csvEsc("Cash Flow — Investing Activities"), csvEsc(it.name), "", it.amount.toFixed(2)]);
            rows.push([csvEsc("Cash Flow Statement"), csvEsc("Net Cash from Investing Activities"), "", data.cashFlow.investing.total.toFixed(2)]);
            for (const it of data.cashFlow.financing.items) rows.push([csvEsc("Cash Flow — Financing Activities"), csvEsc(it.name), "", it.amount.toFixed(2)]);
            rows.push([csvEsc("Cash Flow Statement"), csvEsc("Net Cash from Financing Activities"), "", data.cashFlow.financing.total.toFixed(2)]);
            rows.push([csvEsc("Cash Flow Statement"), csvEsc("Net Increase / (Decrease) in Cash"), "", data.cashFlow.netChange.toFixed(2)]);
            for (const c of data.spendingCategories) rows.push([csvEsc("Spending by Category"), csvEsc(c.category), `${c.count} items`, c.amount.toFixed(2)]);
            for (const p of data.pipeline) rows.push([csvEsc("Requisition Pipeline"), csvEsc(p.label), `${p.count} items`, p.amount.toFixed(2)]);
            for (const r of data.risks) rows.push([csvEsc("Risks & Spending Alerts"), csvEsc(r.title), csvEsc(`${r.severity} · ${r.status}`), r.amount.toFixed(2)]);
            for (const a of data.actions) rows.push([csvEsc("Management Actions"), csvEsc(a.action), csvEsc(a.status || "Open"), ""]);
            for (const t of data.transactions) rows.push([csvEsc("Detailed Transactions"), csvEsc(t.description), csvEsc(`${t.date} · ${t.category} · ${t.requestedBy} · ${t.status}`), t.amount.toFixed(2)]);

            const csv = rows.map(r => r.join(",")).join("\n");
            const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
            const a = document.createElement("a");
            a.href = URL.createObjectURL(blob);
            a.download = `Management_Report_${new Date().toISOString().slice(0, 10)}.csv`;
            a.click();
        } catch (e: any) {
            alert("CSV export failed: " + e.message);
        } finally { setLoading(null); }
    }

    // ── Print ──────────────────────────────────────────────────────────────
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
