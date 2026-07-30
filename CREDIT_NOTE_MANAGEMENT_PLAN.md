# Credit Note Management - Implementation Plan

## Current State
- ✅ Create credit notes
- ✅ Credit notes posted to ledger
- ✅ Credit notes appear in customer statement
- ❌ No way to view/manage credit notes
- ❌ No way to void incorrect credit notes

## Proposed Solution

### 1. Add Credit Note Status Field
Update the schema to support voiding:
- Status: POSTED, VOIDED

### 2. View Credit Notes
Add a "Credit Notes" tab/section to customer statement showing:
- Credit note number
- Date created
- Invoice reference
- Amount
- Reason
- Status (POSTED/VOIDED)
- Actions (View, Void)

### 3. Void Credit Note (Instead of Delete)
When voiding a credit note:
- Mark status as VOIDED
- Create reversing journal entry:
  - Debit: Accounts Receivable (reverses the credit)
  - Credit: Sales Returns & Allowances (reverses the debit)
- Update customer balance
- Keep original record for audit trail

### 4. Credit Note History Modal
Similar to "Manage Payments" modal, create:
- List all credit notes for customer
- Filter by status
- View details
- Void action (with confirmation)

## Why NOT Edit/Delete?

### Accounting Best Practices:
1. **Immutability** - Financial records should not be altered
2. **Audit Trail** - Need complete history of all transactions
3. **Legal Compliance** - Tax authorities require original records
4. **Ledger Integrity** - Edits would require complex GL adjustments

### Correct Process:
- ❌ Edit credit note amount → ✅ Void and create new one
- ❌ Delete credit note → ✅ Void with reason
- ❌ Change invoice ref → ✅ Void and create correct one

## Implementation Files Needed

1. **Update Schema** (if needed)
   - Add VOIDED status to CreditNote enum

2. **API Routes**
   - PATCH /api/accounting/credit-notes - Void credit note
   - GET /api/accounting/credit-notes?customerId=X - Already exists

3. **Components**
   - ManageCreditNotesModal.tsx - List and manage credit notes
   - VoidCreditNoteButton.tsx - Void action with confirmation

4. **Update Statement Page**
   - Add "Credit Notes" button/tab
   - Show credit note status in transaction list

## User Flow

### Voiding a Credit Note:
1. Click "Credit Notes" button on customer statement
2. Modal shows all credit notes for customer
3. Click "Void" on incorrect credit note
4. Confirmation dialog: "Are you sure? This will reverse the credit note and restore the customer balance."
5. System:
   - Marks credit note as VOIDED
   - Creates reversing journal entry
   - Updates customer balance
   - Shows success message

### Creating Correct Credit Note:
1. After voiding incorrect one
2. Click "Credit Note" button
3. Create new credit note with correct details

## Benefits

✅ Maintains audit trail
✅ Follows accounting standards
✅ Preserves ledger integrity
✅ Compliant with tax regulations
✅ Clear history of all actions
✅ Prevents accidental data loss

## Alternative (Not Recommended)

If you absolutely need to delete (not recommended):
- Only allow deletion within X hours of creation
- Only if no other transactions have occurred
- Require admin approval
- Log deletion in audit log
- Create reversing journal entry
- Hard delete from database

**Recommendation**: Implement VOID functionality instead of edit/delete.
