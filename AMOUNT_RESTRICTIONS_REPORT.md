# Expense & Requisition Amount Restrictions - Analysis Report

**Generated:** 2026-02-11  
**System:** Prudence Expense Management System

---

## Executive Summary

✅ **No Active Policies Currently Restricting Requisition Amounts**

The system has a comprehensive policy engine, but **no policies are currently active** in the database that would restrict requisition amounts.

---

## 1. Database Policies (Dynamic - Configurable via UI)

### Status: ✅ **NONE ACTIVE**

The system supports the following policy types that can be configured:

### A. **SPENDING_LIMIT** Policy
- **Purpose:** Restrict maximum amount per expense/requisition
- **Current Status:** No active policies
- **Configuration:**
  - `maxAmount`: Maximum dollar amount allowed
  - `isBlocking`: If true, hard blocks submission; if false, shows warning only
  - Can be category-specific

**Example Configuration:**
```json
{
  "maxAmount": 5000,
  "isBlocking": true,
  "categories": ["Travel & Transport"]
}
```

### B. **RECEIPT_REQUIREMENT** Policy
- **Purpose:** Require receipts above certain threshold
- **Current Status:** No active policies
- **Configuration:**
  - `threshold`: Dollar amount above which receipt is required

### C. **CATEGORY_RESTRICTION** Policy
- **Purpose:** Block certain expense categories
- **Current Status:** No active policies
- **Configuration:**
  - `blockedCategories`: Array of category names to block

### D. **TIME_LIMIT** Policy
- **Purpose:** Restrict submissions by time/day
- **Current Status:** No active policies
- **Configuration:**
  - `blockWeekends`: Boolean
  - `blockAfterHours`: Boolean (9AM-6PM)

### E. **VENDOR_RESTRICTION** Policy
- **Purpose:** Block specific vendors/merchants
- **Current Status:** No active policies
- **Configuration:**
  - `blockedVendors`: Array of vendor names

---

## 2. Hardcoded Restrictions

### A. **Expense API Route** (Line 11 in `/src/app/api/expenses/route.ts`)

⚠️ **HARDCODED LIMIT FOUND:**

```typescript
amount: z.number().positive('Amount must be positive').max(1000000)
```

**Details:**
- **Location:** `/src/app/api/expenses/route.ts`
- **Limit:** $1,000,000 (One Million USD)
- **Applies To:** Expenses submitted via API
- **Type:** Hard validation limit
- **Blocking:** Yes - submissions above this amount will fail

**Note:** This is for the **Expense** submission API, not the **Requisition** form.

### B. **Requisition Form Validation** (Line 10 in `/src/app/dashboard/requisitions/new/actions.ts`)

✅ **NO HARDCODED LIMIT:**

```typescript
amount: z.coerce.number().positive("Amount must be positive")
```

**Details:**
- **Location:** `/src/app/dashboard/requisitions/new/actions.ts`
- **Limit:** None (only requires positive number)
- **Applies To:** Requisition submissions
- **Type:** Basic validation only

### C. **Prohibited Keywords** (Line 134 in `/src/lib/policy-engine.ts`)

⚠️ **HARDCODED CONTENT FILTER:**

```typescript
const prohibitedKeywords = ['alcohol', 'wine', 'beer', 'spa', 'gym', 'jewelry'];
```

**Details:**
- **Applies To:** Both expenses and requisitions
- **Blocking:** Yes - will reject if title/description contains these words
- **Case:** Case-insensitive matching
- **Message:** "Potential prohibited item detected: [keyword]"

---

## 3. Approval Workflow Thresholds

These are **NOT blocking limits**, but determine approval routing:

### Auto-Approval Thresholds (from `/src/lib/approval-workflow.ts`):

| Amount Range | Approval Required |
|-------------|-------------------|
| ≤ $50 | Auto-approve (if policy exists) |
| ≤ $500 | Manager approval |
| ≤ $2,000 | Manager + Finance |
| > $2,000 | Manager + Finance + Executive |

**Note:** These are routing rules, not hard limits. Amounts above thresholds require more approvals but are not blocked.

---

## 4. Summary of Active Restrictions

### For **Requisitions**:
1. ✅ **No maximum amount limit** (can request any positive amount)
2. ⚠️ **Prohibited keywords** in title/description (hardcoded)
3. ✅ **No active database policies** restricting amounts
4. ℹ️ Higher amounts require more approval levels

### For **Expenses** (API):
1. ⚠️ **Maximum $1,000,000** (hardcoded in API validation)
2. ⚠️ **Prohibited keywords** in title/description (hardcoded)
3. ✅ **No active database policies** restricting amounts

---

## 5. How to Add/Modify Restrictions

### Via UI (Recommended):
1. Navigate to **Policies** section in dashboard
2. Create new policy with type `SPENDING_LIMIT`
3. Set `maxAmount` and `isBlocking` values
4. Activate the policy

### Via Code (Hardcoded):
1. **Requisitions:** Edit `/src/app/dashboard/requisitions/new/actions.ts`
2. **Expenses:** Edit `/src/app/api/expenses/route.ts`
3. Add `.max(amount)` to the Zod schema validation

---

## 6. Recommendations

1. **Current State:** System is open for any requisition amount (no restrictions)
2. **If Limits Needed:** Use the Policy Manager UI to create dynamic policies
3. **Prohibited Keywords:** Consider making this configurable via policies instead of hardcoded
4. **Expense API Limit:** The $1M limit on expenses is reasonable for fraud prevention

---

## Files Analyzed

- ✅ `/src/lib/policy-engine.ts` - Policy validation logic
- ✅ `/src/app/dashboard/requisitions/new/actions.ts` - Requisition validation
- ✅ `/src/app/api/expenses/route.ts` - Expense API validation
- ✅ `/src/lib/approval-workflow.ts` - Approval routing logic
- ✅ Database: `Policy` table (checked for active policies)

---

**Conclusion:** The requisition system currently has **no active amount restrictions**. Users can request any positive dollar amount, subject only to the approval workflow routing and prohibited keyword checks.
