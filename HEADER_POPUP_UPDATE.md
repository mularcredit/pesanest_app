# Header Integration Update

## Summary
The "New Requisition" button in the global header has been updated to match the behavior of the button on the Requisitions page. It now opens the same decision modal ("New Requisition" vs "Add Item to Existing").

## Changes Made

### 1. Global Header Button
- **Replaced**: The direct link in the header has been replaced with a smart button component.
- **Behavior**: Clicking "Requisition" in the header now opens the choice modal.

### 2. Smart Data Loading
- **Optimization**: To keep the header lightweight, the list of existing requisitions (needed for the "Add Item" flow) is fetched **on-demand** only when you open the modal.
- **Loading State**: Added a loading spinner to the modal so you know when it's fetching the list of existing requisitions.

### 3. Consistency
- **Unified Experience**: Whether you click "New Requisition" on the main page or in the header, you get the same consistent workflow.

## Technical Details
- Created `GlobalNewRequisitionButton.tsx` for the header.
- Added `getEligibleRequisitions` server action for efficient data fetching.
- Updated `RequisitionTypeModal` to support loading states.
- Modified `Header.tsx` to use the new component.

## Status
✅ **Done**: The header button now launches the popup as requested.
