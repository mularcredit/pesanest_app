/**
 * React hooks for workflow operations
 */

import { useState } from 'react';

export interface ApprovalAction {
    decision: 'APPROVED' | 'REJECTED' | 'ADJUST' | 'CLARIFY' | 'POSTPONE';
    comments?: string;
}

export function useApproval() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const processApproval = async (approvalId: string, action: ApprovalAction) => {
        setLoading(true);
        setError(null);

        try {
            const response = await fetch(`/api/approvals/${approvalId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(action)
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to process approval');
            }

            return data;
        } catch (err: any) {
            setError(err.message);
            throw err;
        } finally {
            setLoading(false);
        }
    };

    const approve = async (approvalId: string, comments?: string) => {
        return processApproval(approvalId, { decision: 'APPROVED', comments });
    };

    const reject = async (approvalId: string, comments?: string) => {
        return processApproval(approvalId, { decision: 'REJECTED', comments });
    };

    return {
        approve,
        reject,
        processApproval,
        loading,
        error
    };
}

export interface CreateExpenseData {
    title: string;
    description?: string;
    amount: number;
    category: string;
    expenseDate: string;
    merchant?: string;
    receiptUrl?: string;
    paymentMethod?: 'PERSONAL_CARD' | 'CORPORATE_CARD' | 'CASH' | 'PETTY_CASH' | 'DIRECT_BILL' | 'WALLET';
    requisitionId?: string;
    isReimbursable?: boolean;
    isBillable?: boolean;
}

export function useExpense() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const createExpense = async (data: CreateExpenseData) => {
        setLoading(true);
        setError(null);

        try {
            const response = await fetch('/api/expenses', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Failed to create expense');
            }

            return result;
        } catch (err: any) {
            setError(err.message);
            throw err;
        } finally {
            setLoading(false);
        }
    };

    const validateExpense = async (data: Partial<CreateExpenseData>) => {
        setLoading(true);
        setError(null);

        try {
            const response = await fetch('/api/expenses/validate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Failed to validate expense');
            }

            return result.validation;
        } catch (err: any) {
            setError(err.message);
            throw err;
        } finally {
            setLoading(false);
        }
    };

    return {
        createExpense,
        validateExpense,
        loading,
        error
    };
}
