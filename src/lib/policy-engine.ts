import prisma from "@/lib/prisma";

export type PolicyViolation = {
    policyId: string;
    policyName: string;
    message: string;
    isBlocking: boolean; // If true, prevents submission. If false, just warnings/requires approval.
};

export type PolicyCheckResult = {
    compliant: boolean;
    canSubmit: boolean;
    violations: PolicyViolation[];
    warnings: PolicyViolation[];
    info: PolicyViolation[];
};

export class PolicyEngine {
    /**
     * Validate an expense against all active policies
     */
    async validateExpense(userId: string, data: {
        amount: number;
        category: string;
        expenseDate: Date;
        title: string;
        description?: string;
        merchant?: string;
        hasReceipt: boolean;
        requisitionId?: string;
    }): Promise<PolicyCheckResult> {
        // Check if user is admin - admins bypass ALL policy restrictions
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { role: true }
        });

        const isAdmin = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN' || user?.role === 'SYSTEM_ADMIN';
        const isCapitalPay = process.env.NEXT_PUBLIC_APP_NAME === 'Capital Pay';

        // Admins and Capital Pay users are exempt from policy-level spending limits
        if (isAdmin || isCapitalPay) {
            return {
                compliant: true,
                canSubmit: true,
                violations: [],
                warnings: [],
                info: [{
                    policyId: 'spending-limit-bypass',
                    policyName: isCapitalPay ? 'Capital Pay Policy' : 'Admin Exemption',
                    message: isCapitalPay 
                        ? 'Scaling/spending limits are removed for Capital Pay.'
                        : 'Admin users are exempt from all policy restrictions',
                    isBlocking: false
                }]
            };
        }

        const policies = await prisma.policy.findMany({
            where: { isActive: true }
        });

        const violations: PolicyViolation[] = [];
        const warnings: PolicyViolation[] = [];
        const info: PolicyViolation[] = [];

        // Helper: partial check for "is weekend"
        const isWeekend = (date: Date) => {
            const day = date.getDay();
            return day === 0 || day === 6; // 0 is Sunday, 6 is Saturday
        };

        // Helper: check business hours (e.g., 9am to 6pm)
        const isOutsideBusinessHours = (date: Date) => {
            const hour = date.getHours();
            return hour < 9 || hour >= 18;
        };

        for (const policy of policies) {
            let rule: any;
            try {
                rule = JSON.parse(policy.rules);
            } catch (e) {
                console.error(`Failed to parse rules for policy ${policy.id}`);
                continue;
            }

            // 1. AMOUNT LIMITS
            if (policy.type === 'SPENDING_LIMIT') {
                if (rule.maxAmount && data.amount > rule.maxAmount) {
                    const v = {
                        policyId: policy.id,
                        policyName: policy.name,
                        message: `Amount $${data.amount} exceeds the limit of $${rule.maxAmount}`,
                        isBlocking: rule.isBlocking ?? true
                    };
                    if (v.isBlocking) violations.push(v);
                    else warnings.push(v);
                }
            }

            // 2. RECEIPT REQUIREMENTS
            if (policy.type === 'RECEIPT_REQUIREMENT') {
                const threshold = rule.threshold || 0;
                if (data.amount >= threshold && !data.hasReceipt) {
                    violations.push({
                        policyId: policy.id,
                        policyName: policy.name,
                        message: `Receipt is required for expenses over $${threshold}`,
                        isBlocking: true
                    });
                }
            }

            // 3. CATEGORY RESTRICTIONS
            if (policy.type === 'CATEGORY_RESTRICTION') {
                if (rule.blockedCategories && rule.blockedCategories.includes(data.category)) {
                    violations.push({
                        policyId: policy.id,
                        policyName: policy.name,
                        message: `Category '${data.category}' is restricted by policy`,
                        isBlocking: true
                    });
                }
            }

            // 4. TIME LIMITS (Weekends, Late Nights)
            if (policy.type === 'TIME_LIMIT') {
                if (rule.blockWeekends && isWeekend(data.expenseDate)) {
                    violations.push({
                        policyId: policy.id,
                        policyName: policy.name,
                        message: `Expenses cannot be submitted for weekends`,
                        isBlocking: true
                    });
                }
                if (rule.blockAfterHours && isOutsideBusinessHours(data.expenseDate)) {
                    violations.push({
                        policyId: policy.id,
                        policyName: policy.name,
                        message: `Expenses cannot be submitted outside business hours (9AM-6PM)`,
                        isBlocking: true
                    });
                }
            }

            // 5. VENDOR CONTROLS
            if (policy.type === 'VENDOR_RESTRICTION') {
                if (data.merchant && rule.blockedVendors && rule.blockedVendors.includes(data.merchant)) {
                    violations.push({
                        policyId: policy.id,
                        policyName: policy.name,
                        message: `Vendor '${data.merchant}' is on the blocked list`,
                        isBlocking: true
                    });
                }
            }

            // 6. KEYWORD RESTRICTIONS (Database-driven)
            if (policy.type === 'KEYWORD_RESTRICTION') {
                const text = `${data.title} ${data.description || ''}`.toLowerCase();
                const prohibitedKeywords: string[] = rule.prohibitedKeywords || [];

                for (const kw of prohibitedKeywords) {
                    if (text.includes(kw.toLowerCase())) {
                        violations.push({
                            policyId: policy.id,
                            policyName: policy.name,
                            message: `Prohibited keyword detected: "${kw}"`,
                            isBlocking: true
                        });
                        break; // Only report first match
                    }
                }
            }
        }

        return {
            compliant: violations.length === 0,
            canSubmit: violations.length === 0,
            violations,
            warnings,
            info
        };
    }
}

export const policyEngine = new PolicyEngine();

// Maintain legacy function for backward compatibility if needed
export async function checkExpensePolicies(data: {
    amount: number;
    category: string;
    merchant?: string;
    expenseDate: Date;
    receiptUrl?: string | null;
    userId: string;
    paymentMethod?: string;
    title?: string;
}): Promise<{
    isValid: boolean;
    violations: PolicyViolation[];
    requiresApproval: boolean;
}> {
    const result = await policyEngine.validateExpense(data.userId, {
        ...data,
        title: data.title || "Expense",
        hasReceipt: !!data.receiptUrl
    });
    return {
        isValid: result.compliant,
        violations: result.violations,
        requiresApproval: !result.compliant || result.warnings.length > 0
    };
}
