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
    balanceSheet: {
        assets: MgmtLineItem[]; totalAssets: number;
        liabilities: MgmtLineItem[]; totalLiabilities: number;
        equity: MgmtLineItem[]; totalEquity: number;
    };
    cashFlow: {
        operating: { items: MgmtLineItem[]; total: number };
        investing: { items: MgmtLineItem[]; total: number };
        financing: { items: MgmtLineItem[]; total: number };
        netChange: number;
    };
    cashPosition: number;
    spendingCategories: { category: string; amount: number; pct: number; count: number }[];
    pipeline: { label: string; count: number; amount: number }[]; // Draft, Pending, Approved, Paid, Rejected
    transactions: { date: string; description: string; category: string; requestedBy: string; status: string; amount: number }[];
}

// ── palette ────────────────────────────────────────────────────────────────
const GREEN: [number, number, number] = [5, 150, 105];
const GREEN_DARK: [number, number, number] = [4, 120, 87];
const GREEN_SOFT: [number, number, number] = [110, 195, 165];
const GREEN_TINT: [number, number, number] = [236, 253, 245];
const DARK: [number, number, number] = [15, 23, 42];
const MID: [number, number, number] = [90, 90, 90];
const GRAY: [number, number, number] = [140, 140, 140];
const FAINT: [number, number, number] = [180, 180, 180];
const HAIRLINE: [number, number, number] = [228, 228, 228];
const TRACK: [number, number, number] = [243, 244, 246];
const SUBTOTAL: [number, number, number] = [243, 244, 246];
const ZEBRA: [number, number, number] = [250, 250, 250];
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
            const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
            const W = doc.internal.pageSize.getWidth();
            const H = doc.internal.pageSize.getHeight();

            doc.addFileToVFS("Outfit-Regular.ttf", OUTFIT_REGULAR_BASE64);
            doc.addFont("Outfit-Regular.ttf", "Outfit", "normal");
            doc.addFileToVFS("Outfit-Bold.ttf", OUTFIT_BOLD_BASE64);
            doc.addFont("Outfit-Bold.ttf", "Outfit", "bold");
            doc.setFont("Outfit", "normal");

            const logo = data.meta.logoUrl ? await loadImageForPdf(data.meta.logoUrl) : null;
            const companyLogo = data.meta.watermarkUrl ? await loadImageForPdf(data.meta.watermarkUrl) : null;

            const M = 10, TOP = 22, BOTTOM = H - 19;
            let cursorY = TOP;

            type Style = { weight?: "normal" | "bold"; size: number; color: [number, number, number] };
            function apply(s: Style) {
                doc.setFont("Outfit", s.weight ?? "normal");
                doc.setFontSize(s.size);
                doc.setTextColor(s.color[0], s.color[1], s.color[2]);
            }

            function drawWatermark() {
                if (!companyLogo) return;
                const maxSize = 100;
                const scale = Math.min(maxSize / companyLogo.width, maxSize / companyLogo.height);
                const w = companyLogo.width * scale, h = companyLogo.height * scale;
                doc.setGState(new (doc as any).GState({ opacity: 0.05 }));
                doc.addImage(companyLogo.dataUri, companyLogo.format, (W - w) / 2, (H - h) / 2, w, h);
                doc.setGState(new (doc as any).GState({ opacity: 1 }));
            }

            // Running header + footer + watermark, drawn on every page from the
            // Table of Contents onward (the cover is a standalone page — see
            // below). Idempotent per page number so a manual pre-emptive page
            // break followed by autoTable's own didDrawPage on that same fresh
            // page can't double-composite the watermark/footer.
            const chromedPages = new Set<number>();
            function drawChrome() {
                const pg = doc.getCurrentPageInfo().pageNumber;
                if (chromedPages.has(pg)) return;
                chromedPages.add(pg);

                drawWatermark();

                apply({ weight: "bold", size: 8, color: GRAY });
                doc.text(data.meta.companyName.toUpperCase(), M, 10);
                doc.text("MANAGEMENT REPORT", W - M, 10, { align: "right" });
                apply({ size: 7, color: FAINT });
                doc.text(data.meta.monthLabel, M, 14.5);
                doc.setDrawColor(...HAIRLINE); doc.setLineWidth(0.2);
                doc.line(M, 17, W - M, 17);

                const footY = H - 14;
                doc.line(M, footY, W - M, footY);
                apply({ size: 7, color: GRAY });
                doc.text(`${data.meta.companyName} · CONFIDENTIAL`, M, footY + 5.5);
                apply({ size: 6, color: FAINT });
                doc.text("Powered by Pesanest", M, footY + 9);
                apply({ size: 7, color: GRAY });
                doc.text(`Page ${pg}`, W - M, footY + 5.5, { align: "right" });
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
            doc.line(18, 26, 18, H - 26);

            if (logo) {
                const boxH = 8, w = (logo.width / logo.height) * boxH;
                doc.addImage(logo.dataUri, logo.format, (W - w) / 2, 32, w, boxH);
            }

            apply({ weight: "bold", size: 21, color: DARK });
            doc.text("MANAGEMENT REPORT", W / 2, 52, { align: "center" });
            apply({ size: 11, color: MID });
            doc.text(data.meta.monthLabel, W / 2, 60, { align: "center" });
            apply({ size: 8.5, color: GRAY });
            doc.text("Financial & Operational Performance", W / 2, 67, { align: "center" });
            apply({ size: 8, color: FAINT });
            doc.text("For Management Review", W / 2, 72.5, { align: "center" });

            if (companyLogo) {
                const boxH = 11, w = (companyLogo.width / companyLogo.height) * boxH;
                doc.addImage(companyLogo.dataUri, companyLogo.format, (W - w) / 2, 84, w, boxH);
            } else {
                apply({ weight: "bold", size: 12.5, color: DARK });
                doc.text(data.meta.companyName, W / 2, 92, { align: "center" });
            }

            // Key figures, as a table rather than a tile band — even the cover
            // reads like a report page, not a dashboard.
            const [netRevenueKpi, netResultKpi, cashKpi] = data.kpis;
            {
                const tw = 130, tx = W / 2 - tw / 2;
                autoTable(doc, {
                    startY: 100,
                    margin: { left: tx, right: W - tx - tw },
                    tableWidth: tw,
                    head: [["Key Figures", currency]],
                    body: [
                        ["Net Revenue", { content: netRevenueKpi?.value ?? "0.00", styles: { halign: "right" } }],
                        [{ content: "Net Result", styles: { fillColor: ZEBRA } }, { content: netResultKpi?.value ?? "0.00", styles: { halign: "right", fillColor: ZEBRA } }],
                        ["Cash Position", { content: cashKpi?.value ?? "0.00", styles: { halign: "right" } }],
                    ],
                    theme: "plain",
                    styles: { font: "Outfit", fontSize: 9.5, textColor: DARK },
                    headStyles: { fillColor: GREEN, textColor: 255, fontStyle: "bold", fontSize: 8 },
                    columnStyles: { 0: { cellWidth: tw - 45 }, 1: { cellWidth: 45, halign: "right" } },
                });
            }
            const statTableEnd = (doc as any).lastAutoTable.finalY;

            const metaRows: [string, string][] = [
                ["Reporting Period", data.meta.periodLabel],
                ["Currency", data.meta.currency],
                ["Generated", data.meta.generatedLabel],
            ];
            const metaW = 150, metaColW = metaW / 3, metaX0 = W / 2 - metaW / 2;
            let metaY = statTableEnd + 12;
            doc.setDrawColor(...HAIRLINE); doc.setLineWidth(0.2);
            doc.line(metaX0, metaY, metaX0 + metaW, metaY);
            metaY += 7;
            metaRows.forEach(([label, value], i) => {
                const cx = metaX0 + metaColW * i + metaColW / 2;
                apply({ weight: "bold", size: 7, color: GRAY });
                doc.text(label.toUpperCase(), cx, metaY, { align: "center" });
                apply({ size: 9.5, color: DARK });
                doc.text(value, cx, metaY + 6, { align: "center" });
            });

            apply({ weight: "bold", size: 7.5, color: FAINT });
            doc.text("CONFIDENTIAL — INTERNAL MANAGEMENT USE", W / 2, H - 22, { align: "center" });

            // ── Table of Contents (reserved page 2; content filled at the end) ──
            doc.addPage();
            const tocPage = doc.getCurrentPageInfo().pageNumber;
            drawChrome();

            newPage();

            // ── Section registry ────────────────────────────────────────────
            const toc: { layer: number; title: string; page: number }[] = [];

            // `reserve` is the height of whatever immediately follows the
            // heading (a table, a chart, a lead line, …) — folding it into the
            // same space check keeps the heading from ever landing alone at
            // the bottom of a page with its content pushed to the next.
            function heading(title: string, layer: number, reserve = 0) {
                ensureSpace(13 + reserve);
                toc.push({ layer, title, page: doc.getCurrentPageInfo().pageNumber });
                apply({ weight: "bold", size: 7.5, color: GREEN });
                doc.text(`${String(layer + 1).padStart(2, "0")}`, M, cursorY);
                apply({ weight: "bold", size: 12.5, color: DARK });
                doc.text(title, M + 9, cursorY);
                doc.setDrawColor(...HAIRLINE); doc.setLineWidth(0.2);
                doc.line(M, cursorY + 3, W - M, cursorY + 3);
                cursorY += 9;
            }

            // A one-line "point of the page, stated first" — a thin green rule
            // on the left, larger type than body text.
            function lead(text: string) {
                apply({ size: 10.5, color: DARK });
                const lines = doc.splitTextToSize(text, W - 2 * M - 6) as string[];
                const lineH = 5;
                ensureSpace(lines.length * lineH + 6);
                const y0 = cursorY;
                lines.forEach((ln, i) => doc.text(ln, M + 6, y0 + i * lineH));
                doc.setDrawColor(...GREEN); doc.setLineWidth(0.8);
                doc.line(M, y0 - 3.5, M, y0 + (lines.length - 1) * lineH + 1);
                cursorY = y0 + lines.length * lineH + 6;
            }

            // A basis-of-preparation / methodology note — a light green box
            // with a bold header line, not just a plain paragraph.
            function callout(text: string) {
                apply({ size: 7.8, color: DARK });
                const pad = 4;
                const maxW = W - 2 * M - pad * 2 - 3;
                const lines = doc.splitTextToSize(text, maxW) as string[];
                const lineH = 4;
                const boxH = (lines.length + 1) * lineH + pad * 1.6;
                ensureSpace(boxH + 4);
                const y0 = cursorY;
                doc.setFillColor(...GREEN_TINT);
                doc.rect(M, y0, W - 2 * M, boxH, "F");
                doc.setFillColor(...GREEN);
                doc.rect(M, y0, 1.2, boxH, "F");
                apply({ weight: "bold", size: 7.5, color: GREEN_DARK });
                doc.text("BASIS OF PREPARATION", M + pad + 3, y0 + pad + 1);
                apply({ size: 7.8, color: DARK });
                lines.forEach((ln, i) => doc.text(ln, M + pad + 3, y0 + pad + 1 + lineH + i * lineH));
                cursorY = y0 + boxH + 10;
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

            // ── a flat "Metric | KES" table (Key Financial Metrics) ─────────
            function metricTable(items: { label: string; value: string; sub: string }[]) {
                ensureSpace(20);
                autoTable(doc, {
                    startY: cursorY,
                    head: [["Metric", currency]],
                    body: items.map((k, i) => [
                        { content: `${k.label}${k.sub ? `  —  ${k.sub}` : ""}`, styles: i % 2 === 1 ? { fillColor: ZEBRA } : {} },
                        { content: k.value, styles: { halign: "right", ...(i % 2 === 1 ? { fillColor: ZEBRA } : {}) } },
                    ]),
                    theme: "plain",
                    styles: { font: "Outfit", fontSize: 9, textColor: DARK },
                    headStyles: { fillColor: GREEN, textColor: 255, fontStyle: "bold", fontSize: 8 },
                    columnStyles: { 0: { cellWidth: W - 2 * M - 50 }, 1: { cellWidth: 50, halign: "right" } },
                    margin: { top: TOP, left: M, right: M, bottom: 22 },
                    rowPageBreak: "avoid",
                    showHead: "everyPage",
                    didDrawPage: () => drawChrome(),
                });
                cursorY = (doc as any).lastAutoTable.finalY + 10;
            }

            // Body rows for one statement group (label/amount lines + an
            // optional shaded subtotal) — shared by the single- and two-column
            // statement drawers below.
            function groupRows(g: { rows: { name: string; amount: number; indent?: boolean }[]; subtotal?: { label: string; amount: number } }) {
                const body: any[] = [];
                if (g.rows.length === 0) {
                    body.push([{ content: "No activity recorded", colSpan: 2, styles: { fontStyle: "italic", textColor: FAINT } }]);
                }
                g.rows.forEach((r, i) => {
                    const fill = i % 2 === 1 ? ZEBRA : ([255, 255, 255] as [number, number, number]);
                    body.push([
                        { content: `${r.indent ? "   " : ""}${r.name}`, styles: { fillColor: fill } },
                        { content: fmtMoney(r.amount), styles: { halign: "right", fillColor: fill } },
                    ]);
                });
                if (g.subtotal) {
                    body.push([
                        { content: g.subtotal.label, styles: { fillColor: SUBTOTAL, fontStyle: "bold" } },
                        { content: fmtMoney(g.subtotal.amount), styles: { halign: "right", fillColor: SUBTOTAL, fontStyle: "bold" } },
                    ]);
                }
                return body;
            }

            // A same-page estimate for a two-column statement, so its heading
            // can reserve enough room that BOTH columns start on the same page
            // — critical for twoColStatement below, which returns to that
            // starting page before drawing the right column and would
            // misplace it if the left column had already spilled onto a
            // later page with a different coordinate space.
            function estimateGroupHeight(g: { rows: unknown[]; subtotal?: unknown }): number {
                return 7 + Math.max(1, g.rows.length) * 6 + (g.subtotal ? 6.5 : 0);
            }
            function estimateStatementHeight(
                leftGroup: { rows: unknown[]; subtotal?: unknown },
                rightGroups: { rows: unknown[]; subtotal?: unknown }[],
            ): number {
                const leftH = estimateGroupHeight(leftGroup);
                const rightH = rightGroups.reduce((s, g, i) => s + estimateGroupHeight(g) + (i > 0 ? 6 : 0), 0);
                return Math.max(leftH, rightH) + 19; // + dark total bar and its gaps
            }

            function darkTotalBar(label: string, amount: number) {
                ensureSpace(11);
                const h = 9;
                doc.setFillColor(17, 24, 39);
                doc.rect(M, cursorY, W - 2 * M, h, "F");
                apply({ weight: "bold", size: 10.5, color: [255, 255, 255] });
                doc.text(label.toUpperCase(), M + 4, cursorY + 6);
                doc.text(fmtMoney(amount), W - M - 4, cursorY + 6, { align: "right" });
                cursorY += h + 10;
            }

            // Two ruled mini-tables side by side (left: one group; right: one
            // or more groups stacked), with a single full-width dark total bar
            // underneath spanning both — the landscape page's width goes to
            // cutting a statement's height in half, not just to more margin.
            function twoColStatement(
                leftGroup: { label: string; rows: { name: string; amount: number; indent?: boolean }[]; subtotal?: { label: string; amount: number } },
                rightGroups: { label: string; rows: { name: string; amount: number; indent?: boolean }[]; subtotal?: { label: string; amount: number } }[],
                totalLabel: string,
                totalAmount: number,
            ) {
                const gap = 10;
                const colW = (W - 2 * M - gap) / 2;
                const leftX = M, rightX = M + colW + gap;
                // The heading before this call reserves estimateStatementHeight,
                // so in the normal case both columns fit on THIS page without
                // either overflowing. Still, autoTable will silently paginate
                // if a column's real height (long account names wrapping, etc.)
                // exceeds the estimate — so explicitly return to the starting
                // page before drawing the right column rather than trusting
                // "current page" to still be where the left column began.
                ensureSpace(24);
                const startY = cursorY;
                const startPage = doc.getCurrentPageInfo().pageNumber;

                autoTable(doc, {
                    startY,
                    margin: { top: TOP, left: leftX, right: W - leftX - colW, bottom: 22 },
                    tableWidth: colW,
                    head: [[leftGroup.label, currency]],
                    body: groupRows(leftGroup),
                    theme: "plain",
                    styles: { font: "Outfit", fontSize: 8.5, textColor: DARK },
                    headStyles: { fillColor: GREEN, textColor: 255, fontStyle: "bold", fontSize: 7.5 },
                    columnStyles: { 1: { halign: "right" } },
                    rowPageBreak: "avoid",
                    showHead: "everyPage",
                    didDrawPage: () => drawChrome(),
                });
                const leftEnd = (doc as any).lastAutoTable.finalY;
                const leftEndPage = doc.getCurrentPageInfo().pageNumber;

                doc.setPage(startPage);
                let ry = startY;
                for (const g of rightGroups) {
                    autoTable(doc, {
                        startY: ry,
                        margin: { top: TOP, left: rightX, right: W - rightX - colW, bottom: 22 },
                        tableWidth: colW,
                        head: [[g.label, currency]],
                        body: groupRows(g),
                        theme: "plain",
                        styles: { font: "Outfit", fontSize: 8.5, textColor: DARK },
                        headStyles: { fillColor: GREEN, textColor: 255, fontStyle: "bold", fontSize: 7.5 },
                        columnStyles: { 1: { halign: "right" } },
                        rowPageBreak: "avoid",
                        showHead: "everyPage",
                        didDrawPage: () => drawChrome(),
                    });
                    ry = (doc as any).lastAutoTable.finalY + 6;
                }
                const rightEnd = ry - 6;
                const rightEndPage = doc.getCurrentPageInfo().pageNumber;

                // Land the dark total bar on whichever column finished last —
                // almost always the same page as both started, per the reserve
                // above, but this stays correct even if the estimate was off.
                const finalPage = Math.max(leftEndPage, rightEndPage);
                if (doc.getCurrentPageInfo().pageNumber !== finalPage) doc.setPage(finalPage);
                cursorY = Math.max(leftEndPage === finalPage ? leftEnd : 0, rightEndPage === finalPage ? rightEnd : 0) + 3;
                darkTotalBar(totalLabel, totalAmount);
            }

            function barChartAt(x: number, w: number, startY: number, items: { category: string; amount: number; pct: number }[]) {
                const RH = 10.5, BAR_H = 4, GUTTER = 40;
                const trackW = w - GUTTER - 4;
                const maxAmt = Math.max(...items.map(i => i.amount), 1);
                items.forEach((it, i) => {
                    const ry = startY + i * RH;
                    apply({ size: 8, color: MID });
                    const labelLines = doc.splitTextToSize(it.category, trackW * 0.55) as string[];
                    doc.text(labelLines[0], x, ry + 3);

                    apply({ weight: "bold", size: 8, color: DARK });
                    doc.text(fmtMoney(it.amount), x + w, ry + 3, { align: "right" });
                    apply({ size: 7, color: FAINT });
                    doc.text(`${it.pct.toFixed(1)}%`, x + w - GUTTER + 8, ry + 3, { align: "right" });

                    doc.setFillColor(...TRACK);
                    doc.rect(x, ry + 5, trackW, BAR_H, "F");
                    const bw = Math.max(0.8, (Math.max(0, it.amount) / maxAmt) * trackW);
                    doc.setFillColor(...(i === 0 ? GREEN : GREEN_SOFT));
                    doc.rect(x, ry + 5, bw, BAR_H, "F");
                });
                return startY + items.length * RH;
            }

            function spendingAnalysis(categories: { category: string; amount: number; pct: number; count: number }[]) {
                const gap = 12;
                const colW = (W - 2 * M - gap) / 2;
                const leftX = M, rightX = M + colW + gap;
                const top8 = categories.slice(0, 8);
                ensureSpace(Math.max(top8.length * 10.5, 20));
                const startY = cursorY;

                const chartEnd = top8.length > 0 ? barChartAt(leftX, colW, startY, top8) : startY;

                autoTable(doc, {
                    startY,
                    margin: { top: TOP, left: rightX, right: W - rightX - colW, bottom: 22 },
                    tableWidth: colW,
                    head: [["Category", "Items", "Share", currency]],
                    body: categories.map(c => [c.category, String(c.count), `${c.pct.toFixed(1)}%`, fmtMoney(c.amount)]),
                    theme: "plain",
                    styles: { font: "Outfit", fontSize: 7.5, textColor: MID },
                    headStyles: { fontStyle: "bold", fontSize: 7, textColor: FAINT },
                    columnStyles: { 0: { cellWidth: colW - 60 }, 1: { cellWidth: 16, halign: "right" }, 2: { cellWidth: 18, halign: "right" }, 3: { cellWidth: 26, halign: "right" } },
                    rowPageBreak: "avoid",
                    showHead: "everyPage",
                    didDrawPage: () => drawChrome(),
                });
                const tableEnd = (doc as any).lastAutoTable.finalY;

                cursorY = Math.max(chartEnd, tableEnd) + 10;
            }

            function pipelineTable(stages: { label: string; count: number; amount: number }[]) {
                ensureSpace(20);
                autoTable(doc, {
                    startY: cursorY,
                    head: [["Stage", "Items", currency]],
                    body: stages.map((s, i) => [
                        { content: s.label, styles: i % 2 === 1 ? { fillColor: ZEBRA } : {} },
                        { content: String(s.count), styles: { halign: "right", ...(i % 2 === 1 ? { fillColor: ZEBRA } : {}) } },
                        { content: fmtMoney(s.amount), styles: { halign: "right", ...(i % 2 === 1 ? { fillColor: ZEBRA } : {}) } },
                    ]),
                    theme: "plain",
                    styles: { font: "Outfit", fontSize: 9, textColor: DARK },
                    headStyles: { fillColor: GREEN, textColor: 255, fontStyle: "bold", fontSize: 8 },
                    columnStyles: { 0: { cellWidth: W - 2 * M - 40 - 55 }, 1: { cellWidth: 40, halign: "right" }, 2: { cellWidth: 55, halign: "right" } },
                    margin: { top: TOP, left: M, right: M, bottom: 22 },
                    rowPageBreak: "avoid",
                    showHead: "everyPage",
                    didDrawPage: () => drawChrome(),
                });
                cursorY = (doc as any).lastAutoTable.finalY + 10;
            }

            // ── 01 · Executive Overview ─────────────────────────────────────
            lead(`${data.meta.companyName} reported a net profit of ${netResultKpi?.value ?? fmtMoney(0)}, a ${netResultKpi?.sub ?? ""}, on cash reserves of ${cashKpi?.value ?? fmtMoney(0)}.`);

            heading("Key Financial Metrics", 0, 20);
            metricTable(data.kpis);

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

            callout("Every figure is drawn from posted journal entries — voided entries are included as their offsetting reversal, never netted out or dropped. Nothing here is estimated or carried forward by hand.");

            // ── 02 · Financial Performance ──────────────────────────────────
            const revenueTotal = data.incomeStatement.revenue.reduce((s, r) => s + r.amount, 0);
            const expensesTotal = data.incomeStatement.expenses.reduce((s, e) => s + e.amount, 0);
            const incomeLeft = { label: "Revenue", rows: data.incomeStatement.revenue.map(r => ({ name: `${r.code ? `${r.code} · ` : ""}${r.name}`, amount: r.amount })) };
            const incomeRight = [{ label: "Operating Expenses", rows: data.incomeStatement.expenses.map(e => ({ name: `${e.code ? `${e.code} · ` : ""}${e.name}`, amount: -e.amount })) }];
            heading("Income Statement", 1, 12 + estimateStatementHeight(incomeLeft, incomeRight));
            lead(`Revenue of ${fmtMoney(revenueTotal)} ${currency} against expenses of ${fmtMoney(expensesTotal)} ${currency} left a net ${data.incomeStatement.netIncome >= 0 ? "profit" : "loss"} of ${fmtMoney(data.incomeStatement.netIncome)} ${currency} for the period.`);
            twoColStatement(incomeLeft, incomeRight, "Net Income", data.incomeStatement.netIncome);

            const bsLeft = { label: "Assets", rows: data.balanceSheet.assets.map(a => ({ name: `${a.code ? `${a.code} · ` : ""}${a.name}`, amount: a.amount })), subtotal: { label: "Total Assets", amount: data.balanceSheet.totalAssets } };
            const bsRight = [
                { label: "Liabilities", rows: data.balanceSheet.liabilities.map(a => ({ name: `${a.code ? `${a.code} · ` : ""}${a.name}`, amount: a.amount })), subtotal: { label: "Total Liabilities", amount: data.balanceSheet.totalLiabilities } },
                { label: "Equity", rows: data.balanceSheet.equity.map(a => ({ name: `${a.code ? `${a.code} · ` : ""}${a.name}`, amount: a.amount })), subtotal: { label: "Total Equity", amount: data.balanceSheet.totalEquity } },
            ];
            heading("Balance Sheet", 1, estimateStatementHeight(bsLeft, bsRight));
            twoColStatement(bsLeft, bsRight, "Total Liabilities & Equity", data.balanceSheet.totalLiabilities + data.balanceSheet.totalEquity);

            const cfLeft = { label: "Operating Activities", rows: data.cashFlow.operating.items.map(i => ({ name: i.name, amount: i.amount })), subtotal: { label: "Net Cash from Operating Activities", amount: data.cashFlow.operating.total } };
            const cfRight = [
                { label: "Investing Activities", rows: data.cashFlow.investing.items.map(i => ({ name: i.name, amount: i.amount })), subtotal: { label: "Net Cash from Investing Activities", amount: data.cashFlow.investing.total } },
                { label: "Financing Activities", rows: data.cashFlow.financing.items.map(i => ({ name: i.name, amount: i.amount })), subtotal: { label: "Net Cash from Financing Activities", amount: data.cashFlow.financing.total } },
            ];
            heading("Cash Flow Statement", 1, estimateStatementHeight(cfLeft, cfRight));
            twoColStatement(cfLeft, cfRight, "Net Increase / (Decrease) in Cash", data.cashFlow.netChange);
            ensureSpace(7);
            apply({ size: 8, color: GRAY });
            doc.text("Cash Balance on Books", M, cursorY);
            doc.text(fmtMoney(data.cashPosition), W - M, cursorY, { align: "right" });
            cursorY += 11;

            heading("Spending Analysis", 1, Math.min(8, data.spendingCategories.length || 1) * 10.5 + 4);
            if (data.spendingCategories.length > 0) {
                spendingAnalysis(data.spendingCategories);
            } else {
                paragraph("No spending recorded for this period.");
            }

            // ── 03 · Operations & Controls ──────────────────────────────────
            const submittedCount = data.pipeline.filter(p => p.label !== "Draft").reduce((s, p) => s + p.count, 0);
            const approvedCount = data.pipeline.filter(p => p.label === "Approved" || p.label === "Paid").reduce((s, p) => s + p.count, 0);
            const approvalRate = submittedCount > 0 ? (approvedCount / submittedCount) * 100 : 0;
            const pendingCount = data.pipeline.find(p => p.label === "Pending")?.count ?? 0;
            heading("Requisition Pipeline", 2, 20);
            lead(`${submittedCount} requisition${submittedCount !== 1 ? "s" : ""} moved through approval this period — ${approvalRate.toFixed(1)}% approved, ${pendingCount} still pending, ${data.risks.length} flagged for review.`);
            pipelineTable(data.pipeline);

            {
                const gap = 12;
                const colW = (W - 2 * M - gap) / 2;
                const leftX = M, rightX = M + colW + gap;
                const risksReserve = data.risks.length > 0 ? 20 : 14;
                const actionsReserve = data.actions.length > 0 ? 20 : 14;
                ensureSpace(13 + Math.max(risksReserve, actionsReserve));

                toc.push({ layer: 2, title: "Risks & Spending Alerts", page: doc.getCurrentPageInfo().pageNumber });
                toc.push({ layer: 2, title: "Management Actions", page: doc.getCurrentPageInfo().pageNumber });

                apply({ weight: "bold", size: 12.5, color: DARK });
                doc.text("Risks & Alerts", leftX, cursorY);
                doc.text("Management Actions", rightX, cursorY);
                doc.setDrawColor(...HAIRLINE); doc.setLineWidth(0.2);
                doc.line(leftX, cursorY + 3, leftX + colW, cursorY + 3);
                doc.line(rightX, cursorY + 3, rightX + colW, cursorY + 3);
                const tablesY = cursorY + 9;

                let leftEnd = tablesY;
                if (data.risks.length > 0) {
                    autoTable(doc, {
                        startY: tablesY,
                        margin: { top: TOP, left: leftX, right: W - leftX - colW, bottom: 22 },
                        tableWidth: colW,
                        head: [["", "Exception", "Amount", "Status"]],
                        body: data.risks.map(r => ["", r.title, fmtMoney(r.amount), r.status]),
                        theme: "plain",
                        styles: { font: "Outfit", fontSize: 8, textColor: MID, valign: "top" },
                        headStyles: { fillColor: GREEN, textColor: 255, fontStyle: "bold", fontSize: 7.5 },
                        columnStyles: { 0: { cellWidth: 6 }, 2: { cellWidth: 28, halign: "right" }, 3: { cellWidth: 26 } },
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
                    leftEnd = (doc as any).lastAutoTable.finalY;
                } else {
                    apply({ size: 9, color: GRAY });
                    doc.text("No spending alerts identified for this period.", leftX, tablesY + 4);
                    leftEnd = tablesY + 8;
                }

                let rightEnd = tablesY;
                if (data.actions.length > 0) {
                    autoTable(doc, {
                        startY: tablesY,
                        margin: { top: TOP, left: rightX, right: W - rightX - colW, bottom: 22 },
                        tableWidth: colW,
                        head: [["Action", "Owner", "Status"]],
                        body: data.actions.map(a => [a.action, a.owner || "—", a.status || "Open"]),
                        theme: "plain",
                        styles: { font: "Outfit", fontSize: 8, textColor: MID, valign: "top" },
                        headStyles: { fillColor: GREEN, textColor: 255, fontStyle: "bold", fontSize: 7.5 },
                        columnStyles: { 1: { cellWidth: 24 }, 2: { cellWidth: 20 } },
                        rowPageBreak: "avoid",
                        showHead: "everyPage",
                        didParseCell: (d) => {
                            if (d.section !== "body" || d.column.index !== 2) return;
                            const key = String(d.cell.raw).toLowerCase();
                            d.cell.styles.textColor = STATUS_COLOR[key] ?? MID;
                            d.cell.styles.fontStyle = "bold";
                        },
                        didDrawPage: () => drawChrome(),
                    });
                    rightEnd = (doc as any).lastAutoTable.finalY;
                } else {
                    apply({ size: 9, color: GRAY });
                    doc.text("No outstanding actions for this period.", rightX, tablesY + 4);
                    rightEnd = tablesY + 8;
                }

                cursorY = Math.max(leftEnd, rightEnd) + 10;
            }

            // ── 04 · Appendices ──────────────────────────────────────────────
            newPage();
            apply({ weight: "bold", size: 8, color: GREEN });
            doc.text("APPENDICES", M, 70);
            apply({ weight: "bold", size: 18, color: DARK });
            doc.text(`A — Detailed Transactions (${data.transactions.length})`, M, 82);
            doc.setDrawColor(...HAIRLINE); doc.setLineWidth(0.2);
            doc.line(M, 88, W - M, 88);
            apply({ size: 9, color: GRAY });
            doc.text("Full itemized listing of every requisition recorded in the reporting period, for reference.", M, 96);
            toc.push({ layer: 3, title: "Detailed Transactions", page: doc.getCurrentPageInfo().pageNumber });
            newPage();

            if (data.transactions.length > 0) {
                autoTable(doc, {
                    startY: cursorY,
                    head: [["Date", "Description", "Category", "Requested By", "Status", currency]],
                    body: data.transactions.map(t => [t.date, t.description, t.category, t.requestedBy, t.status, fmtMoney(t.amount)]),
                    theme: "striped",
                    styles: { font: "Outfit", fontSize: 8, textColor: MID, overflow: "linebreak" },
                    headStyles: { fillColor: GREEN, textColor: 255, fontStyle: "bold", fontSize: 8 },
                    alternateRowStyles: { fillColor: ZEBRA },
                    columnStyles: {
                        0: { cellWidth: 22 },
                        1: { cellWidth: "auto" },
                        2: { cellWidth: 40 },
                        3: { cellWidth: 34 },
                        4: { cellWidth: 24 },
                        5: { cellWidth: 30, halign: "right" },
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
            const LEFT_A = 18, RIGHT_A = W / 2 - 8, LEFT_B = W / 2 + 8, RIGHT_B = W - 18, INDENT = 8;
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
            doc.text("TABLE OF CONTENTS", W / 2, 22, { align: "center" });

            const colA = toc.filter(e => e.layer <= 1);
            const colB = toc.filter(e => e.layer >= 2);
            function drawTocColumn(entries: typeof toc, xL: number, xR: number) {
                let y = 38, lastLayer = -1;
                for (const entry of entries) {
                    if (entry.layer !== lastLayer) {
                        if (lastLayer !== -1) y += 6;
                        apply({ weight: "bold", size: 8, color: GREEN });
                        doc.text(TOC_LAYERS[entry.layer], xL, y);
                        doc.setDrawColor(232, 232, 232); doc.setLineWidth(0.2);
                        doc.line(xL, y + 1.8, xR, y + 1.8);
                        y += 8;
                        lastLayer = entry.layer;
                    }
                    leaderRow(xL + INDENT, xR, y, entry.title, String(entry.page));
                    y += 6.5;
                }
            }
            drawTocColumn(colA, LEFT_A, RIGHT_A);
            drawTocColumn(colB, LEFT_B, RIGHT_B);

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
            for (const a of data.balanceSheet.assets) rows.push([csvEsc("Balance Sheet — Assets"), csvEsc(a.name), a.code ?? "", a.amount.toFixed(2)]);
            rows.push([csvEsc("Balance Sheet"), csvEsc("Total Assets"), "", data.balanceSheet.totalAssets.toFixed(2)]);
            for (const l of data.balanceSheet.liabilities) rows.push([csvEsc("Balance Sheet — Liabilities"), csvEsc(l.name), l.code ?? "", l.amount.toFixed(2)]);
            rows.push([csvEsc("Balance Sheet"), csvEsc("Total Liabilities"), "", data.balanceSheet.totalLiabilities.toFixed(2)]);
            for (const e of data.balanceSheet.equity) rows.push([csvEsc("Balance Sheet — Equity"), csvEsc(e.name), e.code ?? "", e.amount.toFixed(2)]);
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
