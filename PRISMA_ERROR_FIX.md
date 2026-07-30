# Resolved Prisma Runtime Error

## Issue
The console error `PrismaClient is unable to run in this browser environment` occurred because client-side components (`AddItemModal` and `NewRequisitionPage`) were directly importing and calling `getAllCategories` from `src/lib/constants.ts`, which attempts to initialize `PrismaClient`. Prisma cannot run in the browser.

## Fix Applied
1.  **Created Server Action**: Added `getCategoriesAction` in `src/app/dashboard/requisitions/new/multi-item-actions.ts`. This function performs the database query securely on the server.
2.  **Updated Components**:
    - `src/components/requisitions/AddItemModal.tsx`: Updated to use `getCategoriesAction` instead of `getAllCategories`.
    - `src/app/dashboard/requisitions/new/page.tsx`: Updated to use `getCategoriesAction` instead of `getAllCategories`.

## Result
- Clicking "Add Item to Existing" should now open the modal and load categories without error.
- Clicking "New Requisition" should navigate to the form page and load categories without error.
