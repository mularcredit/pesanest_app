import { jsPDF } from "jspdf";
import autoTable from 'jspdf-autotable';
import XLSX from 'xlsx';
import fs from 'fs';

// Load Excel
const workbook = XLSX.readFile('SV.xlsx');
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];
const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

// Find Header
let headerRowIndex = -1;
let headers = null;

for (let i = 0; i < rawData.length; i++) {
    const row = rawData[i];
    if (row && row[0] === 'S/NO') {
        headerRowIndex = i;
        headers = row;
        break;
    }
}

if (headerRowIndex === -1) {
    console.error("Could not find header row starting with S/NO");
    process.exit(1);
}

// Extract Data
const bodyCoords = [];
let totalsRow = null;

for (let i = headerRowIndex + 1; i < rawData.length; i++) {
    const row = rawData[i];
    if (!row || row.length === 0) continue;

    // Check for Totals
    if (row[0] === 'TOTALS') {
        totalsRow = row;
        // Pad totals row if needed to match header length
        while (totalsRow.length < headers.length) {
            totalsRow.push(null);
        }
        break;
        // Assuming data ends at totals
    }

    // Check if row has data (sometimes empty rows are parsed as [])
    // We want rows that have at least some content. 
    // The sample shows valid rows have index 0 (S/NO) or are null but have other data.
    // Row 10: [1, "FLY DEAL", ...]
    // Row 11: [null, "FLY DEAL", ...]

    // We should include this row.
    // Ensure row has same length as headers for table stability
    const cleanRow = [];
    for (let j = 0; j < headers.length; j++) {
        cleanRow.push(row[j] || '');
    }
    bodyCoords.push(cleanRow);
}

// Prepare Total Row for Footer
const footerRow = [];
if (totalsRow) {
    for (let j = 0; j < headers.length; j++) {
        footerRow.push(totalsRow[j] || '');
    }
}

// Create PDF
const doc = new jsPDF();

// Branding
doc.setFontSize(22);
doc.setTextColor(40, 40, 40);
doc.text("Payridge", 14, 20);

doc.setFontSize(10);
doc.setTextColor(100, 100, 100);
doc.text("Expense Management System", 14, 26);

// Title
doc.setFontSize(16);
doc.setTextColor(0, 0, 0);
doc.text("AIRLINES STATEMENT OF ACCOUNT", 14, 40);

doc.setFontSize(10);
doc.text(`Date: ${new Date().toLocaleDateString()}`, 14, 48);

// Table
autoTable(doc, {
    startY: 55,
    head: [headers],
    body: bodyCoords,
    foot: footerRow ? [footerRow] : undefined,
    theme: 'grid',
    headStyles: { fillColor: [66, 66, 66] },
    footStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' },
    styles: { fontSize: 8, cellPadding: 3 },
    columnStyles: {
        0: { cellWidth: 15 }, // S/NO
        5: { halign: 'right' }, // Amounts
        6: { halign: 'right' },
        7: { halign: 'right' }
    },
    didParseCell: function (data) {
        // Format numbers in Amount columns (indices 5, 6, 7)
        // Check column index
        if (data.section === 'body' || data.section === 'foot') {
            if (data.column.index >= 5 && data.column.index <= 7) {
                let val = data.cell.raw;
                if (typeof val === 'number') {
                    data.cell.text = [val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })];
                }
            }
        }
    }
});

// Save
const outputPath = 'Customer_Statement_SV.pdf';
const pdfData = doc.output('arraybuffer');
fs.writeFileSync(outputPath, Buffer.from(pdfData));

console.log(`Successfully created ${outputPath}`);
