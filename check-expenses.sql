-- Check and fix expenses that should be in the Pay queue
-- These are expenses created from requisitions that should be APPROVED and reimbursable

-- First, let's see what we have
SELECT 
    e.id,
    e.title,
    e.status,
    e.isReimbursable,
    e.amount,
    e.receiptUrl,
    r.id as req_id,
    r.status as req_status
FROM Expense e
LEFT JOIN Requisition r ON e.requisitionId = r.id
WHERE e.requisitionId IS NOT NULL
ORDER BY e.createdAt DESC
LIMIT 10;
