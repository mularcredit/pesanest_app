
const XLSX = require('xlsx');
const fs = require('fs');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function processSalaryFile() {
    try {
        console.log("Reading SSCAA SALARIES MASTER.xlsx...");
        const workbook = XLSX.readFile('SSCAA SALARIES MASTER.xlsx');
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];

        // Convert to JSON
        const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        // Skip header rows (Rows 0 and 1 are headers based on previous context)
        // Row 0: "SUBMISSION OF E-GOVERNMENT SERVICES SALARIES LIST "
        // Row 1: Headers ["S/N", "NAMES", "NAME OF BANK", "ACCOUNT NUMBER", "AMOUNT USD"]
        const dataRows = rawData.slice(2);

        const validRows = [];
        let totalAmount = 0;

        // Clean and validate data
        dataRows.forEach((row, index) => {
            if (!Array.isArray(row) || row.length < 5) return;

            const name = row[1];
            // Clean amount - remove commas, currency symbols
            let amount = 0;
            const rawAmount = row[4];

            if (typeof rawAmount === 'number') {
                amount = rawAmount;
            } else if (typeof rawAmount === 'string') {
                amount = parseFloat(rawAmount.replace(/[^0-9.]/g, ''));
            }

            if (name && !isNaN(amount) && amount > 0) {
                totalAmount += amount;
                validRows.push({
                    name: String(name).trim(),
                    bank: row[2] ? String(row[2]).trim() : null,
                    accountNumber: row[3] ? String(row[3]).trim() : null,
                    amount: amount
                });
            }
        });

        console.log(`Found ${validRows.length} valid salary entries.`);
        console.log(`Total Amount: $${totalAmount.toFixed(2)}`);

        if (validRows.length === 0) {
            console.log("No valid rows found. Exiting.");
            return;
        }

        // Create the Salary Batch
        const currentMonth = new Date().getMonth() + 1;
        const currentYear = new Date().getFullYear();
        const title = `SSCAA Salaries - ${new Date().toLocaleString('default', { month: 'long', year: 'numeric' })} (Manual Import)`;

        // Find system admin or first user to assign as creator
        const user = await prisma.user.findFirst();
        if (!user) {
            console.error("No user found in database to assign as creator.");
            return;
        }

        console.log(`Creating batch '${title}' assigned to user: ${user.name} (${user.id})`);

        const batch = await prisma.salaryBatch.create({
            data: {
                title: title,
                month: currentMonth,
                year: currentYear,
                totalAmount: totalAmount,
                currency: "USD",
                status: "DRAFT",
                createdById: user.id,
                notes: "Manually imported via script"
            }
        });

        console.log(`Batch created with ID: ${batch.id}`);

        // Bulk insert records
        console.log("Inserting salary records...");

        await prisma.salaryRecord.createMany({
            data: validRows.map(row => ({
                batchId: batch.id,
                employeeName: row.name,
                bankName: row.bank,
                accountNumber: row.accountNumber,
                amount: row.amount,
                notes: ""
            }))
        });

        console.log("✅ Successfully imported all salary records into the database.");

    } catch (error) {
        console.error("Error processing file:", error);
    } finally {
        await prisma.$disconnect();
    }
}

processSalaryFile();
