# Requisition Flow Updates

## Completed Actions
1.  **Fixed Header Modal Positioning**: The modal triggered from the header is now correctly centered on the screen (using React Portals to escape the header's stacking context).
2.  **Enabled Adding Items to Paid Requisitions**:
    - Updated the backend logic (`getEligibleRequisitions`) to include `PAID` requisitions.
    - Updated the frontend filter (`CreateRequisitionButton`) to include `PAID` requisitions.
    - Updated the modal UI to display `PAID` requisitions with a distinct **blue** badge.
    - Updated the helper text to explicitly state "Pending, Approved, or Paid".

## Verification
- You should now be able to click the "Requisition" button in the header, see the modal centered correctly.
- When you click "Add Item to Existing", you should see Paid requisitions in the list (in addition to Pending and Approved).
- You can proceed to add items to them as requested.
