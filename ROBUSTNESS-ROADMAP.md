# Pesanest Robustness Roadmap

Working plan derived from the CFO systems audit (maturity score 34/100). Each phase has an
exit test — do not start the next phase until the current one passes it. Finding IDs
(F-01…) reference the audit report.

**Governing principles (apply to every phase):**

1. **One gate for every shilling.** Every financial mutation — user action, wallet movement,
   sync, depreciation — goes through `AccountingEngine` (`src/lib/accounting/accounting-engine.ts`),
   which enforces balance, period, permission, sequence, and audit logging in one place.
2. **The ledger is append-only.** Nothing posted is ever updated or deleted. Corrections are
   new entries referencing what they correct.
3. **Compliance lives in the capture flow,** not in after-the-fact exports. Tax rates on lines,
   control-unit numbers on invoices.

---

## Phase 1 — Trust foundations

> **Exit test:** an external auditor can be shown who did what, proven that history cannot
> change, and shown a period that actually locks.

### 1.1 Audit log (F-01) — CRITICAL
- [ ] Add `AuditLog` model: `id, actorId, action, entity, entityId, before Json?, after Json?, ip?, createdAt`. Indexes on `(entity, entityId)` and `(actorId, createdAt)`.
- [ ] Write helper `logAudit(actor, action, entity, entityId, before, after)` in `src/lib/audit.ts`.
- [ ] Call it from: `AccountingEngine.postJournalEntry`, all approval actions, payment authorize/reject, period close/reopen, wallet mutations, login success/failure, role/permission changes, password resets.
- [ ] Replace the static placeholder at `src/app/dashboard/audit/page.tsx` with a real, filterable log viewer (by entity, actor, date range). Read-only; no delete path.

### 1.2 Append-only ledger + reversals (F-02) — CRITICAL
- [ ] Add `reversalOfId String?` (self-relation) and `reversedById String?` to `JournalEntry`.
- [ ] Add `AccountingEngine.reverseJournalEntry(entryId, reason, userId)` — posts a contra entry (debits↔credits swapped), links both directions, audit-logs the reason.
- [ ] **Delete every hard-delete path:**
  - `postSaleInvoice` delete-and-repost (`accounting-engine.ts:195–203`) → reverse old entry, post new one.
  - `journalEntry.deleteMany` in `src/app/api/accounting/payments/route.ts:451` → reversal.
  - Admin hard-delete in `src/app/api/accounting/journal/route.ts` DELETE → replace with reversal endpoint.
  - Sale deletion (`api/accounting/sales/[id]/route.ts`) → block if posted; offer reversal.
- [ ] Add a CI guard: a test that greps `src/` and fails if `journalEntry.create|delete` appears outside `accounting-engine.ts`.

### 1.3 Period enforcement (F-03) — CRITICAL
- [ ] Implement `assertPostingAllowed(date, actor)` in the engine: rejects postings dated into a closed `AccountingPeriod` or closed `FiscalYear`; FINANCE_APPROVER+ may post into soft-locked ranges.
- [ ] Call it at the top of `postJournalEntry` — every posting inherits it automatically.
- [ ] Role-gate `closePeriod` / `closeFiscalYear` (`src/app/dashboard/accounting/periods/actions.ts`) behind new `PERIODS.CLOSE` permission (FINANCE_APPROVER, SYSTEM_ADMIN).
- [ ] Add `reopenPeriod(periodId, reason)` — requires `PERIODS.REOPEN`, reason mandatory, audit-logged, notifies admins.
- [ ] Pre-close validation: block close if the period has unposted documents or unbalanced days; show the checklist in the periods UI.

### 1.4 Access control on financial actions (F-08, F-09) — CRITICAL
- [ ] Remove `NODE_ENV === 'production'` condition on maker≠checker (`src/app/api/payments/action/route.ts:52`). Enforce always.
- [ ] Gate `POST /api/accounting/accounts` behind `ACCOUNTING.MANAGE` (currently any session).
- [ ] Add auth + `ACCOUNTING.MANAGE` check to `runDepreciation()` (`src/app/dashboard/assets/actions.ts` — currently **no auth at all**).
- [ ] Sweep all `/api/accounting/*` routes for session-only checks; add permission checks.
- [ ] Add permissions to the legacy map in `src/auth.ts`: `ACCOUNTING.MANAGE`, `PERIODS.CLOSE`, `PERIODS.REOPEN`, `JOURNALS.APPROVE`.

### 1.5 Depreciation integrity (F-10) — HIGH
- [ ] Idempotency: before posting `DEP-{period}-{assetId}`, check the reference doesn't already exist; skip and report if it does.
- [ ] Wrap GL posting + `currentValue` decrement in one `$transaction`.
- [ ] Stop depreciating below salvage value; stop at end of useful life.
- [ ] Record `lastDepreciatedPeriod` on `Asset`.

### 1.6 Gapless document numbering (F-12) — HIGH
- [ ] `DocumentSequence` model: `type (JOURNAL|INVOICE|PAYMENT|RECEIPT|CREDIT_NOTE), prefix, nextNumber`, incremented with a row lock inside the posting transaction.
- [ ] `JournalEntry.entryNumber` (unique, e.g. `JV-2026-000123`) assigned by the engine.
- [ ] Replace `Date.now()`-based references (`ALLOC-OUT-...`, `TOPUP-...`) with issued sequences.

### 1.7 Atomic document lifecycles (F-14) — HIGH
- [ ] Wrap requisition create + approval-record creation in one `$transaction` (`src/app/dashboard/requisitions/new/multi-item-actions.ts`).
- [ ] Same for: payment authorize + GL posting + document status; sale create + posting; expense approve + posting.
- [ ] Integrity report page: documents in a financial state (PAID/POSTED/APPROVED) with no matching journal entry, and vice versa.

### 1.8 Decimal money — migration plan (F-07) — HIGH (plan now, execute in Phase 2)
- [ ] Decide representation: `Decimal(18,2)` via Prisma `Decimal`.
- [ ] Inventory every monetary `Float` column (JournalLine, Sale, Payment, Wallet, Budget, Asset, etc.).
- [ ] Write the migration + a shadow-comparison script (old float totals vs new decimal totals per account) to run before/after.

---

## Phase 2 — Statutory tax compliance

> **Exit test:** a VAT-registered Kenyan client can invoice through eTIMS and survive a
> KRA desk review using system output alone.

### 2.1 VAT ledger treatment (F-04) — CRITICAL
- [ ] Seed control accounts: `2200 Output VAT`, `1400 Input VAT` (protected, non-deletable).
- [ ] Wire `TaxRate` into capture: tax code per sale line / expense / vendor bill; compute tax at line level.
- [ ] Fix `postSaleInvoice`: Dr AR (gross) / Cr Revenue (net) / Cr Output VAT (tax). Mirror for purchases and credit notes.
- [ ] VAT return report: output vs input VAT per month, net payable/claimable, drill-down to source documents. Align boxes with the KRA VAT3 layout.

### 2.2 eTIMS integration (F-05) — CRITICAL (start early; certification takes time)
- [ ] Choose integration route: OSCU (online) vs VSCU (virtual, offline-capable). Recommend VSCU for branch resilience.
- [ ] Register for the KRA eTIMS sandbox; build the transmission client (invoice submit, credit note submit).
- [ ] Store returned control-unit invoice number + QR data on `Sale`; print on invoice PDF.
- [ ] Block issuing a final (non-draft) invoice that fails transmission; queue + retry for offline windows.
- [ ] Capture supplier eTIMS invoice numbers on expenses/vendor bills (deductibility evidence).

### 2.3 Withholding tax (F-05) — HIGH
- [ ] WHT codes table (professional fees 5%, contractual 3%, rent, dividends… — config-driven, not hardcoded).
- [ ] On vendor payment: optional WHT code → system splits payment: Dr Payable (gross) / Cr Bank (net) / Cr WHT Payable (2210).
- [ ] WHT certificate PDF per withholding; monthly WHT register report.

### 2.4 Payroll module (PAYE, NSSF, SHA, AHL) — CRITICAL (in scope now)
Schema:
- [ ] `EmployeePayProfile`: userId, basicSalary, allowances Json, kraPin, nssfNumber, shaNumber, bankAccount, active.
- [ ] `PayrollRun`: period (YYYY-MM), status (DRAFT → APPROVED → POSTED → PAID), totals, approvedBy, postedEntryId.
- [ ] `Payslip`: runId, userId, gross, paye, nssfEmployee, nssfEmployer, sha, ahlEmployee, ahlEmployer, otherDeductions Json, netPay.
- [ ] `StatutoryRateTable`: **all rates config-driven with effective dates** (PAYE bands + personal relief, NSSF tiers/limits, SHA %, AHL %) — rates change; never hardcode.

Engine:
- [ ] `runPayroll(period)`: compute per employee — gross → NSSF (deductible) → taxable → PAYE bands − personal relief → SHA (2.75% of gross, config) → AHL (1.5% employee + 1.5% employer, config) → net pay. Idempotent per period (same pattern as 1.5).
- [ ] GL posting through the engine, one entry per run:
      Dr Salaries & Wages (gross + employer NSSF + employer AHL)
      Cr PAYE Payable / NSSF Payable / SHA Payable / AHL Payable / Net Salaries Payable.
- [ ] Maker-checker: payroll run must be APPROVED by a second user before POSTED (reuse Payment maker-checker pattern).
- [ ] Payment: net salaries disbursed via the existing Payment flow; statutory payables cleared by payment with due-date reminders (PAYE/SHA/NSSF/AHL by 9th of following month).

Outputs:
- [ ] Payslip PDF per employee; payroll summary per run.
- [ ] P10 (monthly PAYE return) export; P9 (annual per-employee) export; NSSF/SHA/AHL schedule exports in filing-ready format.

### 2.5 Decimal migration — EXECUTE (from 1.8)
- [ ] Run the migration alongside payroll schema work (one schema-churn window).
- [ ] Run the shadow-comparison script; reconcile any drift before switching reports over.

---

## Phase 3 — Cash truth (Weeks 13–18)

> **Exit test:** every shilling of real-world cash movement appears in the trial balance and
> reconciles to an external statement.

### 3.1 Bank account entities (F-11)
- [ ] `BankAccount` model: name, bankName, accountNumber, currency, glAccountId (unique) — each bank/M-Pesa/petty-cash float gets its own GL sub-account (1010, 1020, 1030…). Retire the single hardcoded `1000`.
- [ ] Migrate existing cash balances to the new sub-accounts via an opening-balance journal.

### 3.2 Statement import + persisted reconciliation (F-11)
- [ ] `BankStatement` + `StatementLine` models; CSV import (bank exports, M-Pesa statement export).
- [ ] `ReconciliationMatch` model: statementLineId ↔ journalLineId(s), matchedBy, matchedAt. Ticks persist.
- [ ] Auto-match suggestions (amount + date proximity + reference).
- [ ] Reconciliation report: reconciled balance, unreconciled items carried forward, per period.

### 3.3 Wallet → GL unification (F-06) — CRITICAL carry-over
- [ ] Map corporate wallet and each `BranchWallet` to GL sub-accounts.
- [ ] Every `WalletTransaction`/`BranchWalletTransaction` posts a journal entry through the engine (allocation = Dr Branch Float / Cr Corporate Cash).
- [ ] Virtual top-up: either remove, or post it as Dr Cash-Clearing / Cr Owner Funding with mandatory approval + audit log. **No balance may change without a journal entry.**
- [ ] Backfill script: post catch-up journals for historical wallet transactions so GL and wallet balances tie out.

### 3.4 Payment reversal flow (§11)
- [ ] `REVERSED` status on Payment; reversal re-opens the payable and posts the contra entry via `reverseJournalEntry`.
- [ ] Reason + audit log mandatory.

### 3.5 Day-end close (from the earlier memo)
- [ ] `DayClose` model: date (Africa/Nairobi bucket), status, checklist snapshot Json, closedBy/At, reopenedBy/reason/At.
- [ ] Checklist screen: unposted docs count, cash collected vs recorded, M-Pesa vs recorded, day's debits = credits.
- [ ] Closing a day advances the soft-lock date consumed by `assertPostingAllowed` (1.3). Reopen = permission + reason + log.

---

## Phase 4 — Accrual completeness (Months 5–6)

> **Exit test:** the statements are true accrual-basis financials, and month-end/year-end
> produce a close binder an auditor can work from.

- [ ] **Accruals & prepayments:** deferral schedule model (total, periods, account pair); monthly release journal generated automatically (idempotent, same pattern as depreciation).
- [ ] **Deferred income:** invoice-in-advance flag → Cr Deferred Income, released to revenue on schedule.
- [ ] **Recurring journals:** template + schedule (reuse `Schedule` infrastructure) generating DRAFT journals for approval.
- [ ] **Manual journal maker-checker (F-16):** DRAFT → APPROVED → POSTED; `JOURNALS.APPROVE` permission; flag backdated entries and journals posted within 3 days of period close on an exceptions report.
- [ ] **Asset disposals:** disposal action posting gain/loss (Dr Cash + Accum. Dep. / Cr Asset cost / Dr-Cr Gain-Loss); revaluation support later.
- [ ] **AR/AP aging:** 30/60/90+ buckets tied out to the AR (1200) / AP control accounts.
- [ ] **Close binder:** period-end TB snapshot (frozen at close), journals listing, sequence-gap report, exceptions report, budget-vs-actual — exportable as one PDF pack.
- [ ] **Year-end close:** closing entries rolling P&L to Retained Earnings; comparative-period reporting.
- [ ] **Budget realism:** remove synthetic KSh 1,000 defaults from `/api/budgets`; budgets only from approved `MonthlyBudget` records.

---

## Phase 5 — Scale & hardening (Month 7+)

- [ ] **2FA (TOTP) for finance roles**, login rate-limiting/lockout, session & device audit (F-17).
- [ ] **Multi-currency per IAS 21** (only if clients need it): FX rate table, transaction + base amounts on `JournalLine`, month-end revaluation of monetary items. Until then: **enforce KES-only posting** — convert at capture with a stored rate (small Phase 2 task).
- [ ] **Cost-centre dimensions:** optional `dimension1/2` (branch, department FK) on `JournalLine`; dimensional P&L.
- [ ] **Reporting scale:** period-balance snapshot table (account × period), rebuilt at close; reports read snapshots + open-period deltas instead of scanning all journal lines.
- [ ] **Tenancy architecture:** replace env-file-swap tenancy with deliberate per-tenant provisioning; document which database is which (this bit us during the audit).
- [ ] **Integration guard:** QuickBooks sync (and any future integration) must post through the engine and respect `assertPostingAllowed` — never raw `journalEntry.create`.
- [ ] **COA governance (F-13):** account-mapping config screen (which account plays AR/Revenue/VAT/etc. — no more magic codes in code), edit/archive UI, consolidate `Category`/`CustomCategory` onto `Account` with FKs, block auto-creation of accounts mid-posting.
- [ ] Market-driven: inventory accounting (COGS, FIFO/WAC), multi-company consolidation.

---

## Sequencing summary

| Phase | Theme | Duration | Headline deliverable |
|---|---|---|---|
| 1 | Trust foundations | Weeks 1–4 | Immutable, audited, period-locked ledger |
| 2 | Tax + payroll compliance | Weeks 5–12 | eTIMS invoicing, VAT return, compliant payroll (PAYE/NSSF/SHA/AHL) |
| 3 | Cash truth | Weeks 13–18 | Bank recon + wallets on the GL |
| 4 | Accrual completeness | Months 5–6 | True accrual statements + close binder |
| 5 | Scale & hardening | Month 7+ | 2FA, dimensions, FX, reporting scale |

**Rule of thumb when priorities collide:** anything that protects the integrity of already-recorded
data (Phase 1) beats anything that adds new capability. A feature added on mutable books
inherits their unreliability.
