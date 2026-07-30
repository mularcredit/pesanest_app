const XLSX = require('xlsx');

try {
    const workbook = XLSX.readFile('SSCAA SALARIES MASTER.xlsx');
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    // Convert to JSON, but get header row first to understand structure
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

    console.log(`Sheet Name: ${sheetName}`);
    console.log(`Total Rows: ${data.length}`);

    // Print first 5 rows to understand columns
    console.log("First 5 rows (including header):");
    console.log(JSON.stringify(data.slice(0, 5), null, 2));

} catch (error) {
    console.error("Error reading Excel file:", error.message);
}
