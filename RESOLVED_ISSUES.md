# Resolved Issues

## 1. Runtime Error: PrismaClient in Browser
- **Issue**: The `AddItemModal` component (Client Component) was directly calling `getAllCategories` from `src/lib/constants.ts`, which attempts to use `PrismaClient`. Prisma cannot run in the browser.
- **Fix**: 
  - Created a new **Server Action** `getCategoriesAction` in `src/app/dashboard/requisitions/new/multi-item-actions.ts`.
  - Updated `AddItemModal` to call this server action instead of the direct library function.
  - This ensures database queries happen securely on the server.

## 2. Requisition Features (Previous)
- **Header Modal**: Now centered correctly using React Portals.
- **Paid Requisitions**: Now supported for adding items, with appropriate UI updates.

Your application should now run without the console error and fully support the requested requisition workflows.
