-- Clear all dummy data from the database
-- WARNING: This will delete ALL data except user accounts

-- Delete in order to respect foreign key constraints

-- 1. Delete approvals first (they reference expenses and requisitions)
DELETE FROM Approval;

-- 2. Delete expenses (they reference requisitions and users)
DELETE FROM Expense;

-- 3. Delete requisitions (they reference users)
DELETE FROM Requisition;

-- 4. Delete wallet transactions (they reference wallets and users)
DELETE FROM WalletTransaction;

-- 5. Delete wallets (they reference users)
DELETE FROM Wallet;

-- 6. Optionally delete all users except admins (uncomment if needed)
-- DELETE FROM User WHERE role != 'SYSTEM_ADMIN' AND role != 'FINANCE_APPROVER';

-- Show what's left
SELECT 'Users remaining:' as info, COUNT(*) as count FROM User
UNION ALL
SELECT 'Expenses:', COUNT(*) FROM Expense
UNION ALL
SELECT 'Requisitions:', COUNT(*) FROM Requisition
UNION ALL
SELECT 'Approvals:', COUNT(*) FROM Approval
UNION ALL
SELECT 'Wallets:', COUNT(*) FROM Wallet
UNION ALL
SELECT 'Wallet Transactions:', COUNT(*) FROM WalletTransaction;
