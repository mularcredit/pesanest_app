-- Fix script: Mark requisitions as FULFILLED if they have associated expenses
-- Run this in Prisma Studio or via: npx prisma db execute --file fix-requisitions.sql

UPDATE Requisition
SET status = 'FULFILLED'
WHERE id IN (
    SELECT DISTINCT requisitionId 
    FROM Expense 
    WHERE requisitionId IS NOT NULL
)
AND status = 'APPROVED';

-- Show what was updated
SELECT 
    r.id,
    r.title,
    r.status,
    COUNT(e.id) as expense_count
FROM Requisition r
LEFT JOIN Expense e ON e.requisitionId = r.id
WHERE r.status = 'FULFILLED'
GROUP BY r.id;
