# Recording Payments After Sales

This guide explains how to record customer payments after recording sales in the Payridge accounting system.

## Overview

The system uses a **two-step process** for managing customer receivables:

1. **Record a Sale (Invoice)** - Creates an accounts receivable entry
2. **Record Payment** - Records when the customer pays, reducing their balance

## Database Structure

### Sale Model
- Represents an invoice issued to a customer
- Fields: `invoiceNumber`, `totalAmount`, `issueDate`, `dueDate`, `status`
- Status values: `DRAFT`, `SENT`, `PAID`, `PARTIAL`, `OVERDUE`, `VOID`

### CustomerPayment Model
- Represents a payment received from a customer
- Fields: `amount`, `paymentDate`, `method`, `reference`, `saleId` (optional)
- Can be allocated to a specific invoice or left unallocated

## Workflow

### Step 1: Record a Sale

1. Navigate to **Accounting → Sales**
2. Click **"Record Sale"**
3. Fill in the invoice details:
   - Select customer
   - Add line items (description, quantity, unit price)
   - Set issue date and due date
   - Add notes/terms
4. Click **"Save & Post to Ledger"** (status: SENT) or **"Save as Draft"**

**What happens:**
- A `Sale` record is created in the database
- Status is set to `SENT` (or `DRAFT`)
- The sale appears on the customer's statement as a debit (amount owed)

### Step 2: Record Payment

There are **two ways** to record a payment:

#### Option A: From Customer Statement (Recommended)

1. Navigate to **Accounting → Customers**
2. Click on the customer name or **"View Statement"**
3. Click the **"Record Payment"** button (green button)
4. Fill in the payment details:
   - **Amount**: Payment amount received
   - **Payment Date**: When the payment was received
   - **Payment Method**: Cash, Bank Transfer, Cheque, or Mobile Money
   - **Reference**: Transaction ID, cheque number, etc.
   - **Allocate to Invoice** (optional): Link payment to a specific invoice
   - **Notes**: Additional details
5. Click **"Record Payment"**

#### Option B: Via API (for integrations)

```typescript
POST /api/accounting/payments

{
  "customerId": "customer_id",
  "amount": 1000.00,
  "paymentDate": "2026-02-06",
  "method": "BANK_TRANSFER",
  "reference": "TXN-12345",
  "saleId": "sale_id", // Optional: allocate to specific invoice
  "notes": "Payment for Invoice INV-001"
}
```

**What happens:**
- A `CustomerPayment` record is created
- The payment appears on the customer's statement as a credit (payment received)
- If allocated to a specific invoice:
  - System calculates total payments for that invoice
  - Updates invoice status automatically:
    - `PAID` if total payments >= invoice amount
    - `PARTIAL` if total payments > 0 but < invoice amount
- Customer's outstanding balance is reduced

## Payment Methods

The system supports four payment methods:

1. **CASH** - Cash payments
2. **BANK_TRANSFER** - Bank wire transfers, ACH, etc.
3. **CHEQUE** - Check payments
4. **MOBILE_MONEY** - Mobile money services (M-Pesa, etc.)

## Payment Allocation

### Allocated Payments
When you link a payment to a specific invoice (`saleId`):
- The system tracks which invoice was paid
- Invoice status updates automatically
- Useful for tracking partial payments on specific invoices

### Unallocated Payments
When you don't link a payment to an invoice:
- Payment is recorded against the customer's account
- Reduces overall customer balance
- Useful for advance payments or when customer pays multiple invoices at once

## Customer Statement

The customer statement shows:
- **Opening Balance**: Amount owed at start of period
- **Invoices (Debits)**: Sales recorded in the period
- **Payments (Credits)**: Payments received in the period
- **Running Balance**: Updated balance after each transaction
- **Ending Balance**: Amount owed at end of period

### Viewing a Statement

1. Go to **Accounting → Customers**
2. Click customer name or **"View Statement"**
3. Use date filters to select period
4. Click **"Generate Statement"** to create a PDF

## Best Practices

### 1. Record Sales Immediately
- Record sales as soon as invoices are issued
- Use `SENT` status for issued invoices
- Use `DRAFT` for quotes or pending invoices

### 2. Record Payments Promptly
- Record payments on the day they're received
- Always include a reference number for traceability
- Allocate payments to specific invoices when possible

### 3. Use Payment References
- For bank transfers: Use transaction ID
- For cheques: Use cheque number
- For mobile money: Use transaction reference
- For cash: Use receipt number

### 4. Regular Reconciliation
- Review customer statements monthly
- Follow up on overdue invoices
- Reconcile payments with bank statements

### 5. Handle Partial Payments
- Record partial payments as they're received
- Allocate to the specific invoice being paid
- System will automatically mark invoice as `PARTIAL`

## Common Scenarios

### Scenario 1: Full Payment on Single Invoice

1. Record sale: $1,000 (Status: SENT)
2. Customer pays $1,000
3. Record payment: $1,000, allocate to invoice
4. Invoice status → PAID

### Scenario 2: Partial Payment

1. Record sale: $1,000 (Status: SENT)
2. Customer pays $400
3. Record payment: $400, allocate to invoice
4. Invoice status → PARTIAL
5. Customer pays remaining $600
6. Record payment: $600, allocate to same invoice
7. Invoice status → PAID

### Scenario 3: Multiple Invoices, One Payment

1. Record sale #1: $500 (Status: SENT)
2. Record sale #2: $300 (Status: SENT)
3. Customer pays $800 for both
4. Record payment: $800, leave unallocated
5. Customer balance reduced by $800

### Scenario 4: Advance Payment

1. Customer pays $1,000 in advance
2. Record payment: $1,000, leave unallocated
3. Customer balance: -$1,000 (credit balance)
4. Later, record sale: $600
5. Customer balance: -$400 (still has credit)

## Accounting Impact

### When Recording a Sale (SENT status)
```
DR: Accounts Receivable    $1,000
CR: Sales Revenue          $1,000
```

### When Recording a Payment
```
DR: Cash/Bank              $1,000
CR: Accounts Receivable    $1,000
```

*Note: Journal entries are automatically created by the accounting engine when sales are posted and payments are recorded.*

## API Endpoints

### Record Payment
```
POST /api/accounting/payments
```

### List Payments
```
GET /api/accounting/payments?customerId={id}
GET /api/accounting/payments?saleId={id}
GET /api/accounting/payments?from=2026-01-01&to=2026-01-31
```

## Troubleshooting

### Payment not showing on statement
- Check date filters on statement page
- Verify payment was successfully saved
- Refresh the page

### Invoice status not updating
- Ensure payment was allocated to the invoice
- Check that payment amount was recorded correctly
- Verify customer ID matches

### Balance incorrect
- Review all transactions in the period
- Check for duplicate payments
- Verify opening balance calculation

## Related Features

- **Customer Management**: `/dashboard/accounting/customers`
- **Sales Recording**: `/dashboard/accounting/sales/new`
- **Customer Statements**: `/dashboard/accounting/customers/[id]/statement`
- **Finance Studio**: Generate professional PDF statements

## Need Help?

For additional support or questions about the payment recording process, contact your system administrator or refer to the main documentation.
