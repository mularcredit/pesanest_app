# Manual Journal Entry Feature - Complete

## Overview
The manual journal entry form now has full Chart of Accounts integration, allowing proper double-entry bookkeeping.

## Features Implemented

### 1. **Chart of Accounts Integration**
- Automatically fetches all accounts when the modal opens
- Dropdown shows: `Code - Account Name` (e.g., "1000 - Cash & Bank")
- Only accounts from your Chart of Accounts can be selected

### 2. **Dynamic Line Items**
- Start with 2 lines (minimum for double-entry)
- **Add Line** button to add more rows
- **Remove** button (trash icon) for lines beyond the minimum 2
- Each line has:
  - Account selector (dropdown)
  - Debit amount (number input)
  - Credit amount (number input)

### 3. **Real-Time Balance Validation**
- Live calculation of total debits and credits
- Visual indicator:
  - ✅ **Green "Balanced"** when Debits = Credits
  - ❌ **Red "Diff: $X.XX"** showing the difference
- Submit button is **disabled** until balanced

### 4. **Form Fields**
- **Date**: Transaction date
- **Reference**: Free-text field (e.g., "ADJ-001", "PAYROLL-JAN")
- **Description**: Brief explanation of the entry

### 5. **Validation**
- ✅ Debits must equal Credits (enforced)
- ✅ All lines must have an account selected
- ✅ Prevents submission if validation fails
- ✅ Clear error messages

## How It Works

### User Flow:
1. Click "Manual Journal Entry" button on General Ledger page
2. Fill in Date, Reference, Description
3. For each line:
   - Select an account from dropdown
   - Enter either a Debit OR Credit amount (not both)
4. Add more lines if needed (e.g., splitting expenses across multiple accounts)
5. Watch the totals update in real-time
6. When "Balanced" appears (green), click "Post Entry"

### Example Entry: Paying Rent
```
Date: 2024-02-01
Reference: RENT-FEB
Description: Monthly office rent payment

Lines:
- Account: 6000 - Operating Expenses | Debit: $2,000 | Credit: $0
- Account: 1000 - Cash & Bank        | Debit: $0     | Credit: $2,000

Total Debit: $2,000
Total Credit: $2,000
Status: ✅ Balanced
```

### Example Entry: Recording a Sale (Manual)
```
Date: 2024-02-01
Reference: INV-2024-050
Description: Consulting services for Acme Corp

Lines:
- Account: 1200 - Accounts Receivable | Debit: $5,000 | Credit: $0
- Account: 4000 - Sales Revenue        | Debit: $0     | Credit: $5,000

Total Debit: $5,000
Total Credit: $5,000
Status: ✅ Balanced
```

## Technical Details

### Data Flow:
1. **Fetch Accounts**: `GET /api/accounting/accounts` → Returns all Chart of Accounts
2. **Submit Entry**: `POST /api/accounting/journal` → Creates JournalEntry with JournalLines
3. **Validation**: Server-side double-entry validation in `AccountingEngine`
4. **Refresh**: Page reloads to show new entry in the ledger

### Database Impact:
- Creates 1 `JournalEntry` record
- Creates N `JournalLine` records (one per line)
- Each line references an `Account` from Chart of Accounts
- Status is set to "POSTED" immediately

### Connection to Chart of Accounts:
- **CRITICAL**: You cannot post to an account that doesn't exist
- The dropdown only shows accounts that are in your Chart of Accounts
- If you need a new account, create it first via "New Account" button
- Account types (ASSET, LIABILITY, REVENUE, EXPENSE, EQUITY) are enforced

## Benefits

### For Accountants:
- ✅ Full control over manual adjustments
- ✅ Proper double-entry enforcement
- ✅ Clear audit trail (reference + description)
- ✅ Immediate posting to General Ledger

### For the System:
- ✅ Data integrity (balanced entries only)
- ✅ Proper GL structure maintained
- ✅ All entries traceable via reference
- ✅ Supports complex multi-line transactions

## Common Use Cases

1. **Adjusting Entries**: Correcting errors or accruals
2. **Opening Balances**: Setting up initial account balances
3. **Depreciation**: Monthly depreciation entries
4. **Payroll**: Recording complex payroll with multiple deductions
5. **Bank Reconciliation**: Adjustments for bank fees, interest
6. **Intercompany Transfers**: Moving funds between accounts

## Future Enhancements
- [ ] Save as draft (status: DRAFT vs POSTED)
- [ ] Edit existing entries
- [ ] Reverse/void entries
- [ ] Recurring journal templates
- [ ] Import from CSV
- [ ] Attachment support (upload receipts/invoices)
