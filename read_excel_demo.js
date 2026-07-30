const XLSX = require('xlsx');

try {
    const workbook = XLSX.readFile('SV.xlsx');
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet);

    console.log(`Successfully read ${data.length} rows from ${sheetName}:`);
    console.log(JSON.stringify(data.slice(0, 3), null, 2)); // Show first 3 rows
} catch (error) {
    console.error("Error reading Excel file:", error.message);
}
