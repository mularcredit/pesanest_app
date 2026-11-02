"use client";

import { useState } from "react";
import { PiPrinter, PiArrowLeft, PiFilePdf, PiSpinner } from "react-icons/pi";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { OUTFIT_REGULAR_BASE64, OUTFIT_BOLD_BASE64 } from "@/lib/pdf-fonts/outfit-font";

export interface InvoicePdfItem {
    description: string;
    quantity: number;
    unitPrice: number;
    total: number;
}

export interface InvoicePdfData {
    invoiceNumber: string;
    issueDate: string;
    dueDate: string;
    currency: string;
    companyName: string;
    companyAddress: string;
    etimsPin: string;
    registrationNumber?: string;
    customerName: string;
    customerTaxId?: string;
    customerAddress?: string;
    items: InvoicePdfItem[];
    subtotal: number;
    taxAmount: number;
    totalAmount: number;
    etims?: {
        receiptNumber: string;
        controlUnit: string;
        qrDataUri: string | null;
    };
}

/**
 * A real, standalone PDF file — generated with jsPDF and saved directly via
 * doc.save(), not window.print(). The previous "Download" button just opened
 * the browser's print dialog, which only produces a file if the person
 * manually picks "Save as PDF" as the destination printer themselves; many
 * people (reasonably) don't know that step exists, so it read as "there is
 * no download," which is exactly what was reported. Print is kept as its
 * own separate button for anyone who does want to print to paper.
 */
export function PrintControls({ data }: { data?: InvoicePdfData }) {
    const [isGenerating, setIsGenerating] = useState(false);

    async function handleDownloadPdf() {
        if (!data) return;
        const money = (n: number) => `${data.currency} ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        setIsGenerating(true);
        try {
            const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
            const W = doc.internal.pageSize.getWidth();
            const MARGIN = 16;

            doc.addFileToVFS("Outfit-Regular.ttf", OUTFIT_REGULAR_BASE64);
            doc.addFont("Outfit-Regular.ttf", "Outfit", "normal");
            doc.addFileToVFS("Outfit-Bold.ttf", OUTFIT_BOLD_BASE64);
            doc.addFont("Outfit-Bold.ttf", "Outfit", "bold");
            doc.setFont("Outfit", "normal");

            let y = MARGIN;

            // ── Header: company (left) + TAX INVOICE (right) ──
            doc.setFont("Outfit", "bold"); doc.setFontSize(15); doc.setTextColor(17, 17, 17);
            doc.text(data.companyName, MARGIN, y + 5);

            doc.setFont("Outfit", "bold"); doc.setFontSize(14); doc.setTextColor(79, 70, 229);
            doc.text("TAX INVOICE", W - MARGIN, y + 5, { align: "right" });

            y += 10;
            doc.setFont("Outfit", "normal"); doc.setFontSize(9.5); doc.setTextColor(107, 114, 128);
            doc.text(data.companyAddress, MARGIN, y);
            doc.text(data.invoiceNumber, W - MARGIN, y, { align: "right" });

            y += 5;
            doc.text(`PIN: ${data.etimsPin} · Branch 00`, MARGIN, y);
            doc.text(`Issued: ${data.issueDate}`, W - MARGIN, y, { align: "right" });

            if (data.registrationNumber) {
                y += 5;
                doc.text(`Reg No: ${data.registrationNumber}`, MARGIN, y);
                doc.text(`Due: ${data.dueDate}`, W - MARGIN, y, { align: "right" });
            } else {
                doc.text(`Due: ${data.dueDate}`, W - MARGIN, y, { align: "right" });
            }

            y += 6;
            doc.setDrawColor(17, 17, 17); doc.setLineWidth(0.6);
            doc.line(MARGIN, y, W - MARGIN, y);

            // ── Bill To ──
            y += 8;
            doc.setFont("Outfit", "normal"); doc.setFontSize(8.5); doc.setTextColor(107, 114, 128);
            doc.text("BILL TO", MARGIN, y);
            y += 5;
            doc.setFont("Outfit", "bold"); doc.setFontSize(11); doc.setTextColor(17, 17, 17);
            doc.text(data.customerName, MARGIN, y);
            doc.setFont("Outfit", "normal"); doc.setFontSize(9.5); doc.setTextColor(107, 114, 128);
            if (data.customerTaxId) { y += 5; doc.text(`PIN: ${data.customerTaxId}`, MARGIN, y); }
            if (data.customerAddress) { y += 5; doc.text(data.customerAddress, MARGIN, y); }

            // ── Line items ──
            y += 6;
            autoTable(doc, {
                startY: y,
                margin: { left: MARGIN, right: MARGIN },
                head: [["Description", "Qty", "Unit Price", "Amount"]],
                body: data.items.map(it => [
                    it.description,
                    String(it.quantity),
                    money(it.unitPrice),
                    money(it.total),
                ]),
                theme: "plain",
                styles: { font: "Outfit", fontSize: 9.5, textColor: [26, 26, 26], cellPadding: { top: 2.5, bottom: 2.5, left: 1.5, right: 1.5 } },
                headStyles: { fontStyle: "bold", textColor: [107, 114, 128], fontSize: 8.5, lineWidth: { bottom: 0.4 }, lineColor: [229, 231, 235] },
                bodyStyles: { lineWidth: { bottom: 0.2 }, lineColor: [240, 240, 240] },
                columnStyles: {
                    1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right" },
                },
            });

            let finalY = (doc as any).lastAutoTable.finalY + 8;

            // ── Totals ──
            const totalsX = W - MARGIN - 70;
            doc.setFont("Outfit", "normal"); doc.setFontSize(9.5); doc.setTextColor(107, 114, 128);
            doc.text("Subtotal", totalsX, finalY);
            doc.text(money(data.subtotal), W - MARGIN, finalY, { align: "right" });
            finalY += 5.5;
            doc.text("VAT (16%)", totalsX, finalY);
            doc.text(money(data.taxAmount), W - MARGIN, finalY, { align: "right" });
            finalY += 3;
            doc.setDrawColor(17, 17, 17); doc.setLineWidth(0.6);
            doc.line(totalsX, finalY, W - MARGIN, finalY);
            finalY += 6;
            doc.setFont("Outfit", "bold"); doc.setFontSize(12); doc.setTextColor(17, 17, 17);
            doc.text("Total", totalsX, finalY);
            doc.text(money(data.totalAmount), W - MARGIN, finalY, { align: "right" });

            // ── eTIMS block ──
            if (data.etims) {
                finalY += 10;
                const boxH = 34;
                doc.setFillColor(236, 253, 245);
                doc.setDrawColor(167, 243, 208);
                doc.roundedRect(MARGIN, finalY, W - MARGIN * 2, boxH, 3, 3, "FD");
                doc.setFont("Outfit", "bold"); doc.setFontSize(8.5); doc.setTextColor(4, 120, 87);
                doc.text("KRA eTIMS TAX INVOICE", MARGIN + 6, finalY + 7);
                doc.setFont("Outfit", "normal"); doc.setFontSize(8.5); doc.setTextColor(107, 114, 128);
                doc.text(`Supplier PIN:  ${data.etimsPin}`, MARGIN + 6, finalY + 13);
                doc.text(`Receipt No.:  ${data.etims.receiptNumber}`, MARGIN + 6, finalY + 18);
                doc.text(`Signature (SCU):  ${data.etims.controlUnit}`, MARGIN + 6, finalY + 23);
                doc.setTextColor(4, 120, 87); doc.setFont("Outfit", "bold");
                doc.text("Status: ACCEPTED", MARGIN + 6, finalY + 28);
                if (data.etims.qrDataUri) {
                    doc.addImage(data.etims.qrDataUri, "PNG", W - MARGIN - boxH + 6, finalY + 3, boxH - 6, boxH - 6);
                }
                finalY += boxH;
            }

            // ── Footer ──
            const H = doc.internal.pageSize.getHeight();
            doc.setFont("Outfit", "normal"); doc.setFontSize(8.5); doc.setTextColor(156, 163, 175);
            doc.text(`Thank you for your business · Powered by ${data.companyName}`, W / 2, H - 12, { align: "center" });

            doc.save(`Invoice_${data.invoiceNumber}.pdf`);
        } finally {
            setIsGenerating(false);
        }
    }

    return (
        <>
            <button
                onClick={() => window.history.back()}
                className="inline-flex items-center gap-1.5 rounded-[8px] border border-gray-200 bg-white px-4 py-2 text-[12.5px] font-[500] text-gray-600 hover:bg-gray-50"
            >
                <PiArrowLeft className="text-[14px]" /> Back
            </button>
            <button
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 rounded-[8px] border border-gray-200 bg-white px-4 py-2 text-[12.5px] font-[500] text-gray-600 hover:bg-gray-50"
            >
                <PiPrinter className="text-[14px]" /> Print
            </button>
            {data && (
                <button
                    onClick={handleDownloadPdf}
                    disabled={isGenerating}
                    className="inline-flex items-center gap-1.5 rounded-[8px] bg-indigo-600 px-4 py-2 text-[12.5px] font-[600] text-white hover:bg-indigo-700 disabled:opacity-60"
                >
                    {isGenerating
                        ? <><PiSpinner className="text-[14px] animate-spin" /> Generating…</>
                        : <><PiFilePdf className="text-[14px]" /> Download PDF</>}
                </button>
            )}
        </>
    );
}
