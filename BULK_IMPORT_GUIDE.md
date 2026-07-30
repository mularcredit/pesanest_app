# Bulk Data Import Feature

## Overview
A complete bulk import system for uploading Customers and Sales Invoices via Excel/CSV files.

## Location
**URL**: `/dashboard/settings/import`
**Sidebar**: Administration → Data Import

## Features

### 1. Customer Import
Upload a list of customers with the following fields:
- Name (required)
- Email
- Phone
- Tax ID
- Address
- City
- Country
- Currency (defaults to USD)

**Behavior**:
- If a customer with the same name exists, it will be **updated** with new data
- If no match is found, a **new customer** is created

### 2. Sales Invoice Import
Upload sales invoices with line items:
- Invoice Number (required)
- Customer Name (must match existing customer)
- Issue Date
- Due Date
- Description (item description)
- Quantity
- Unit Price

**Behavior**:
- Multiple rows with the same Invoice Number are grouped into a single invoice with multiple line items
- Customers must exist before importing sales (import customers first)
- Invoices are created with status "SENT" (they will appear on statements immediately)
- Duplicate invoice numbers are skipped with an error message

## How to Use

### Step 1: Download Template
1. Navigate to `/dashboard/settings/import`
2. Select either "Import Customers" or "Import Sales" tab
3. Click "Download Template" button
4. Open the template in Excel

### Step 2: Fill in Data
- Fill in your data following the template structure
- For Sales: Ensure customer names match exactly with existing customers
- For multi-line invoices: Use the same Invoice Number for all related items

### Step 3: Upload
1. Click the upload zone or drag and drop your file
2. Review the preview (first 5 rows shown)
3. Click "Confirm Import"

### Step 4: Review Results
- Success message shows number of records imported
- Any errors are listed with specific row details
- Successfully imported data is immediately available in the system

## Technical Details

### Files Created
- `src/app/actions/bulk-import.ts` - Server actions for processing uploads
- `src/components/dashboard/DataImporter.tsx` - UI component
- `src/app/dashboard/settings/import/page.tsx` - Page wrapper
- Updated `src/components/layout/Sidebar.tsx` - Added navigation link

### Data Validation
- Uses Zod schemas for type safety
- Validates required fields
- Handles date parsing
- Prevents duplicate invoice numbers
- Case-insensitive customer name matching

### Performance
- Client-side parsing using `xlsx` library
- Preview before submission
- Batch processing on server
- Transaction-safe (errors don't corrupt database)

## Example Templates

### Customers Template
```csv
name,email,phone,taxId,address,city,country,currency
Acme Corp,contact@acme.com,+1 555 0123,TAX-12345,123 Main St,Nairobi,Kenya,USD
```

### Sales Template
```csv
invoiceNumber,customerName,issueDate,dueDate,description,quantity,unitPrice
INV-2024-001,Acme Corp,2024-02-01,2024-03-01,Consulting Services,10,150
INV-2024-001,Acme Corp,2024-02-01,2024-03-01,Travel Expenses,1,500
```

## Integration with Other Features

### Customer Statements
- Imported sales automatically appear on customer statements
- Opening balance is calculated from all historical transactions
- Use Finance Studio to generate statements after import

### General Ledger
- Sales with status "SENT" are automatically posted to the GL
- Accounts Receivable is updated
- Revenue accounts are credited

## Error Handling
- Row-level error reporting
- Partial imports (successful rows are saved, failed rows are reported)
- Detailed error messages for debugging
- No data corruption on failures

## Future Enhancements
- Support for customer payments import
- Vendor import
- Expense import
- CSV format support (currently Excel-focused)
- Bulk update mode
- Import history/audit log
