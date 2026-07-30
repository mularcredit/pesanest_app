# New Requisition Flow & Item-Level Approvals

## Overview
We have implemented a new flow for creating requisitions and adding items to existing ones. This allows for greater flexibility and ensures that items added post-creation follow strict approval rules independently.

## Features Implemented

### 1. New Requisition Choice Modal
- **Trigger**: Clicking "Create New Requisition" or "Single Item" on the Requisitions page.
- **Choices**:
  - **Create New Requisition**: Standard flow to create a fresh request.
  - **Add Item to Existing**: Allows selecting an existing (Pending/Approved) requisition to add items to.

### 2. Item-Level Approval Logic
- **Database Support**: 
  - Added `ItemApproval` model to track approvals for specific items.
  - Added `status`, `type`, and `isInitial` fields to `RequisitionItem`.
- **Logic**:
  - When an item is added to an existing requisition, it is marked as `isInitial: false`.
  - The system automatically determines the approval route for *that specific item* based on its category and amount.
  - If the parent requisition is of a special type (e.g., `SOUTH_SUDAN`), the new item inherits that type.
  - **Auto-Approval**: If the route (e.g., SSCA) allows auto-approval, the item is immediately APPROVED.
  - **Manual Approval**: If not, `ItemApproval` records are created for the required approvers.

### 3. Workflow Rule Compliance
- **SSCA Compliance**: Items added to South Sudan Civil Aviation requisitions automatically bypass standard approvals if the main requisition allows it, ensuring they go directly to payment as requested.
- **Financial Consistency**: The total amount of the main requisition is updated to reflect the new item, ensuring the "Authorized By" value on vouchers reflects the total reality.

## DB Schema Changes
- **User**: Added `itemApprovals` relation.
- **RequisitionItem**: Added `status`, `type`, `isInitial`, `approvals`.
- **ItemApproval**: New model for granular tracking.

## How to Test
1. **Navigate** to Requisitions page.
2. **Click** "Create New Requisition" (the + button).
3. **Select** "Add Item to Existing".
4. **Choose** a requisition (e.g., a South Sudan or Standard one).
5. **Add** an item details.
6. **Verify**:
    - If Standard: Item is added as PENDING and approval records are created in DB.
    - If SSCA: Item is added as APPROVED immediately (if policy allows).

## Pending Scope
- **Approver Dashboard**: The UI for approvers to see `ItemApproval` requests alongside standard `Approval` requests needs to be updated in a future iteration.
- **Item Status UI**: The Requisition details view currently shows the main status. We may want to expose per-item statuses in the future.
