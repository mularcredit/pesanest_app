// Sentinel branch/department values for quick per-category "Budget Rules" —
// distinct from the real branch/department-scoped Monthly Budget Plan, which
// shares the same MonthlyBudget table, so budget-manager.ts's lookup filters
// on these same sentinels to avoid the two systems reading each other's rows.
// Kept in a plain module (not budget-actions.ts) because a "use server" file
// may only export async functions.
export const BUDGET_RULE_BRANCH = "All Branches";
export const BUDGET_RULE_DEPARTMENT = "All Departments";
