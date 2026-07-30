"use client";

import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { BiDownload, BiFile } from "react-icons/bi";
import { useToast } from "@/components/ui/ToastProvider";
import { useState } from "react";

interface ExportButtonsProps {
    expenses: any[];
    userName: string;
}

export function ExportButtons({ expenses, userName }: ExportButtonsProps) {
    const { showToast } = useToast();
    const [isExporting, setIsExporting] = useState(false);

    const generatePDF = () => {
        setIsExporting(true);
        try {
            const doc = new jsPDF();

            // Header
            doc.setFontSize(22);
            doc.setTextColor(16, 185, 129); // Emerald
            doc.text("Expense Report", 14, 22);

            doc.setFontSize(10);
            doc.setTextColor(100);
            doc.text(`Generated for: ${userName}`, 14, 32);
            doc.text(`Date: ${new Date().toLocaleDateString()}`, 14, 37);

            // Totals
            const total = expenses.reduce((sum, e) => sum + e.amount, 0);
            doc.setFontSize(14);
            doc.setTextColor(0);
            doc.text(`Total Combined Spend: $${total.toLocaleString()}`, 14, 50);

            // Table
            const tableData = expenses.map(e => [
                new Date(e.expenseDate || e.createdAt).toLocaleDateString(),
                e.title,
                e.category,
                e.status,
                `KSh ${e.amount.toFixed(2)}`
            ]);

            autoTable(doc, {
                startY: 60,
                head: [["Date", "Description", "Category", "Status", "Amount"]],
                body: tableData,
                theme: 'striped',
                headStyles: { fillColor: [16, 185, 129] },
                alternateRowStyles: { fillColor: [245, 245, 245] }
            });

            doc.save(`Expense_Report_${Date.now()}.pdf`);
            showToast("PDF Report generated successfully", "success");
        } catch (error) {
            showToast("Failed to generate PDF", "error");
        } finally {
            setIsExporting(false);
        }
    };

    const generateCSV = () => {
        setIsExporting(true);
        try {
            const headers = ["Date", "Title", "Category", "Amount", "Status", "Description"];
            const rows = expenses.map(e => [
                new Date(e.expenseDate || e.createdAt).toLocaleDateString(),
                `"${e.title}"`,
                e.category,
                e.amount,
                e.status,
                `"${e.description || ''}"`
            ]);

            const csvContent = [
                headers.join(","),
                ...rows.map(row => row.join(","))
            ].join("\n");

            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement("a");
            const url = URL.createObjectURL(blob);
            link.setAttribute("href", url);
            link.setAttribute("download", `Expenses_${Date.now()}.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            showToast("CSV Exported successfully", "success");
        } catch (error) {
            showToast("Failed to export CSV", "error");
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <div className="flex gap-4">
            <button
                onClick={generateCSV}
                disabled={isExporting}
                className="gds-glass px-4 py-2 flex items-center gap-2 text-gds-text-muted hover:text-gds-text-main transition-all disabled:opacity-50"
            >
                <BiDownload className="text-lg" />
                <span className="text-xs font-semibold tracking-wider">Export CSV</span>
            </button>
            <button
                onClick={generatePDF}
                disabled={isExporting}
                className="gds-btn-premium flex items-center gap-2 disabled:opacity-50"
            >
                <BiFile className="text-lg" />
                <span>Download PDF</span>
            </button>
        </div>
    );
}
