-- Comprehensive fix for requisitions and expenses

-- Step 1: Update expenses from requisitions to be APPROVED and reimbursable
UPDATE Expense
SET 
    status = 'APPROVED',
    isReimbursable = 1
WHERE requisitionId IS NOT NULL
AND status IN ('SUBMITTED', 'PENDING_APPROVAL', 'DRAFT');

-- Step 2: Mark requisitions as FULFILLED if they have expenses
UPDATE Requisition
SET status = 'FULFILLED'
WHERE id IN (
    SELECT DISTINCT requisitionId 
    FROM Expense 
    WHERE requisitionId IS NOT NULL
)
AND status IN ('APPROVED', 'PENDING');

-- Step 3: Show summary
SELECT 'Expenses ready for payment:' as info, COUNT(*) as count
FROM Expense
WHERE status = 'APPROVED' AND isReimbursable = 1
UNION ALL
SELECT 'Fulfilled requisitions:', COUNT(*)
FROM Requisition
WHERE status = 'FULFILLED';
