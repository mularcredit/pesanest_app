-- Enforces at most one active (non-VOID) journal entry per asset. This is
-- the database-level backstop for the asset-purchase duplication bug fixed
-- in application code this session (see AccountingEngine.postAssetPurchase).
--
-- Based on status, not reversalOfId: voiding an entry (voidJournalEntry())
-- only flips its status to VOID — it never clears reversalOfId on the
-- original row. A predicate of "reversalOfId IS NULL" would still treat a
-- voided original as active and block a legitimate re-post after voiding.
CREATE UNIQUE INDEX "JournalEntry_assetId_active_unique"
  ON "JournalEntry" ("assetId")
  WHERE "assetId" IS NOT NULL AND "status" != 'VOID';
