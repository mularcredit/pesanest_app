# Bank Reconciliation Guide

## Overview
The Bank Reconciliation feature allows you to match your bank statement transactions with your General Ledger entries to ensure accuracy and identify discrepancies.

## Access
**Navigation**: Accounting → Bank Reconciliation  
**URL**: `/dashboard/accounting/reconciliation`

## Features

### 1. **Upload Bank Statement**
- **Supported Formats**: CSV, Excel (.xlsx, .xls)
- **Required Columns**:
  - `Date` - Transaction date
  - `Description` - Transaction description/narration
  - `Amount` - Transaction amount (positive for deposits, negative for withdrawals)

**Example CSV Format**:
```csv
Date,Description,Amount
2024-02-01,Customer Payment - Acme Corp,5000.00
2024-02-02,Office Rent Payment,-2000.00
2024-02-03,Bank Charges,-15.00
```

### 2. **Manual Entry**
- Click "Add Manual Entry" to add transactions one by one
- Useful for:
  - Small statements
  - Missing transactions
  - Quick reconciliations

### 3. **Auto-Match**
- Automatically matches transactions based on:
  - **Exact amount match**
  - **Same date**
  - Not already matched
- Click "Auto-Match" button to run
- Review and adjust matches manually if needed

### 4. **Manual Matching**
- Click on bank transaction to select it
- Click on corresponding GL entry to match
- Matched items turn green
- Click again to unmatch

### 5. **Reconciliation Summary**
Shows:
- **Bank Balance** (as entered/uploaded)
- **GL Balance** (calculated from ledger)
- **Matched Items** (count and total)
- **Unmatched Bank Items** (need investigation)
- **Unmatched GL Items** (need investigation)
- **Difference** (Bank - GL)

### 6. **Create Adjustment Entry**
- If there's a difference between Bank and GL
- Click "Create Adjustment Entry"
- Creates a journal entry to reconcile the difference
- You'll need to specify the offset account (e.g., Bank Fees, Interest Income)

## Workflow

### Step 1: Prepare Bank Statement
1. Download your bank statement from your bank
2. Save as CSV or Excel
3. Ensure it has Date, Description, and Amount columns

### Step 2: Upload to System
1. Go to Bank Reconciliation page
2. Click "Upload Statement"
3. Select your file
4. Enter the ending balance from your bank statement

### Step 3: Match Transactions
1. Click "Auto-Match" to automatically match obvious items
2. Review the matches
3. Manually match any remaining items by clicking on them

### Step 4: Investigate Unmatched Items

**Unmatched Bank Items** might be:
- Bank fees not recorded in GL
- Interest earned not recorded
- Deposits in transit
- Outstanding checks
- Errors in bank statement

**Unmatched GL Items** might be:
- Checks not yet cleared
- Deposits not yet processed by bank
- Timing differences
- Errors in GL

### Step 5: Create Adjustments
For legitimate differences (bank fees, interest, errors):
1. Click "Create Adjustment Entry"
2. Select the appropriate offset account
3. Post the entry
4. Refresh the page to see updated balances

### Step 6: Verify Reconciliation
- Check that "Reconciled!" status appears
- Difference should be $0.00
- All items should be matched or explained

## Common Scenarios

### Scenario 1: Bank Fees
**Bank Statement**: -$25.00 "Monthly Service Fee"  
**GL**: No entry

**Solution**:
1. Note the unmatched bank item
2. Create adjustment entry:
   - Debit: Bank Fees Expense (6100) - $25
   - Credit: Cash & Bank (1000) - $25

### Scenario 2: Interest Earned
**Bank Statement**: +$10.50 "Interest Earned"  
**GL**: No entry

**Solution**:
1. Create adjustment entry:
   - Debit: Cash & Bank (1000) - $10.50
   - Credit: Interest Income (4500) - $10.50

### Scenario 3: Outstanding Check
**GL**: Payment to vendor - $500 (recorded)  
**Bank**: Not yet cleared

**Solution**:
- This is normal timing difference
- Leave unmatched
- Will match in next period when check clears

### Scenario 4: Deposit in Transit
**GL**: Customer payment - $2,000 (recorded)  
**Bank**: Not yet deposited

**Solution**:
- Normal timing difference
- Leave unmatched
- Will match in next period

### Scenario 5: Error in GL
**Bank**: Correct amount $1,500  
**GL**: Recorded as $1,050 (typo)

**Solution**:
1. Create correcting journal entry:
   - Debit: Cash & Bank (1000) - $450
   - Credit: [Original Account] - $450
2. Re-run reconciliation

## Best Practices

### Frequency
- **Daily**: For high-volume businesses
- **Weekly**: For medium-volume businesses
- **Monthly**: Minimum recommended frequency

### Documentation
- Save reconciliation reports
- Document all adjustments
- Keep notes on timing differences
- Track outstanding items month-to-month

### Segregation of Duties
- Person recording transactions ≠ Person reconciling
- Reduces fraud risk
- Improves accuracy

### Review Process
1. Accountant performs reconciliation
2. Manager reviews and approves
3. Adjustments posted after approval
4. Final reconciliation report filed

## Troubleshooting

### "Cash Account (1000) not found"
**Problem**: Chart of Accounts missing Cash account  
**Solution**: Create account 1000 - Cash & Bank in Chart of Accounts

### Auto-Match not working
**Problem**: Dates or amounts don't match exactly  
**Solution**: 
- Check date formats
- Verify amounts are exact (including decimals)
- Use manual matching

### Large difference between Bank and GL
**Problem**: Many unmatched items  
**Solution**:
- Review recent GL entries for errors
- Check if bank statement is complete
- Look for duplicate entries
- Verify opening balances

### Can't upload bank statement
**Problem**: File format not recognized  
**Solution**:
- Save as CSV or Excel
- Ensure columns are named correctly
- Remove extra header rows
- Check for special characters

## Reports

### Reconciliation Summary
Shows:
- Starting balances
- Matched transactions
- Unmatched transactions
- Adjustments made
- Ending balances
- Reconciliation status

### Outstanding Items Report
Lists:
- Checks not yet cleared
- Deposits in transit
- Age of outstanding items

## Security

### Access Control
- Requires authentication
- Should be restricted to accounting staff
- Consider role-based permissions

### Audit Trail
- All matches are logged
- Adjustments create journal entries
- Full history maintained

## Integration

### Connected Systems
- **General Ledger**: Reads cash account transactions
- **Journal Entries**: Creates adjustment entries
- **Chart of Accounts**: Uses account 1000 (Cash & Bank)

### Data Flow
1. GL transactions → Reconciliation page
2. Bank statement → Upload
3. Matching → In-memory (not saved)
4. Adjustments → Journal Entry API → GL

## Future Enhancements
- [ ] Save reconciliation sessions
- [ ] Reconciliation history/archive
- [ ] Multi-bank account support
- [ ] Automatic bank feed integration
- [ ] Scheduled reconciliation reminders
- [ ] PDF export of reconciliation report
- [ ] Fuzzy matching (similar amounts/dates)
- [ ] Bulk adjustment entries

---

**Status**: ✅ READY FOR USE  
**Last Updated**: 2026-02-04  
**Feature Type**: Manual Process (Upload-based)
