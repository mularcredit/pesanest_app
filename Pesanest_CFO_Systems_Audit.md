**CONFIDENTIAL — INTERNAL AUDIT WORKING PAPER**

# Pesanest Accounting Platform
### CFO Systems Audit

**Scope:** Full codebase review of the Pesanest expense & accounting system (Next.js / Prisma / PostgreSQL) — schema, posting engine, API routes, and workflows, examined as an external CFO would examine a system a business intends to run its finance department on.

**Standard of reference:** IFRS/IAS, ISA expectations of an external auditor, Kenyan statutory requirements (KRA — VAT, eTIMS, WHT; NSSF, SHA, AHL), and control patterns of SAP, Dynamics 365 BC, NetSuite, Sage, QuickBooks Enterprise, Odoo, Xero, and Zoho Books.

**Method:** Every material claim below was verified against source code, with file references. Findings carry IDs (F-01…) and are cross-referenced rather than repeated.

> *Note: payroll-related content has been omitted from this version of the report at the client's request.*

---

## 01 Executive Summary

Pesanest has the skeleton of a real accounting system — a genuine double-entry ledger, a maker-checker payment flow, multi-level approvals, a fixed-asset register that posts depreciation, and a full document set from invoices to credit notes. That skeleton is better than most systems at this stage, and it is worth saying plainly: the foundations are salvageable and largely correct in intent.

**It is not yet an accounting system a finance department can rely on, for three structural reasons:**

- **The books can be silently rewritten.** Posted journal entries are physically deleted and re-created on edit, there is no audit trail of any kind (the audit page is a static placeholder backed by no data model), and period close is a flag that no posting path reads. An external auditor's first three questions — can history change, who changed it, is the period locked — all currently answer "yes, unknown, no."
- **The ledger does not tell the whole truth.** The entire wallet subsystem (corporate wallet, branch wallets, allocations, admin "virtual funds") moves money outside the general ledger; VAT charged on sales is credited to revenue instead of a liability account; and multi-currency documents post raw foreign amounts into an implicitly-KES ledger. The trial balance balances, but it is not a faithful statement of the business.
- **Kenyan statutory compliance is essentially absent.** No eTIMS integration, no VAT ledger treatment or return, and no withholding tax. For a VAT-registered Kenyan business this is disqualifying today, not eventually.

None of this is fatal. The single posting engine (`AccountingEngine.postJournalEntry`) that validates debits = credits is the right architecture — it gives one choke point at which immutability, period enforcement, tax splitting, and audit logging can all be added without rewriting the application. The roadmap in §17 sequences that work: trust first, tax second, cash third.

---

## 02 Overall Maturity Score

### 34 / 100

*Weighted across domains. Benchmark: mature SME ERP (QuickBooks Enterprise / Odoo tier) = 100.*

| Domain | Score / 100 |
|---|---|
| Core GL & double entry | 55 |
| Audit trail & immutability | 15 |
| Internal controls / SoD | 40 |
| Kenyan tax & statutory | 8 |
| Receivables & payables | 48 |
| Cash & banking | 30 |
| Fixed assets | 45 |
| Financial reporting | 40 |
| Budgeting | 45 |
| Security & access | 40 |
| Multi-entity / currency | 15 |

Interpretation: below 40 a system supports record-keeping; 40–70 supports an internal finance team with compensating manual controls; above 70 it can face an external audit without heroics. Pesanest sits at the top of the first band — an operational expense-management tool with a promising ledger attached, not yet a system of record.

---

## 03 Strengths

Credit where due — several of these are genuinely uncommon in systems at this maturity:

- **True double-entry with enforcement at a single choke point.** `AccountingEngine.postJournalEntry` rejects any entry where debits ≠ credits. One posting gate is the correct architecture and the anchor for every fix in this report.
- **Maker-checker on payments.** Payment carries distinct `makerId`/`checkerId` with a `PENDING_AUTHORIZATION` state and a self-approval block. Most SME systems never build this. (Weakened by F-08.)
- **Multi-level approval workflow with a policy engine.** Requisitions route through configurable approval levels with regional routing, and `checkExpensePolicies` can hard-block violations before posting.
- **Fiscal calendar exists.** `FiscalYear` / `AccountingPeriod` with monthly generation and a management UI — the data model for period close is already right; only enforcement is missing (F-03).
- **Fixed-asset register that reaches the GL.** Straight-line and declining-balance methods post Dr Depreciation Expense (6050) / Cr Accumulated Depreciation (1600) — correct contra-asset treatment.
- **Complete document set.** Sales invoices, credit notes (with correct reversal postings), customer payments and statements, vendor invoices and payables, budgets with approvals.
- **RBAC with custom roles and live permission refresh on each session.** Admin role changes take effect without re-login.
- **Statement suite present.** Trial balance, P&L, balance sheet, cash flow, general ledger drill-down, plus CSV/PDF exports.
- **Kenya-aware by design.** KES defaults, M-Pesa paybill/till flows, branch wallets modeled on real field-cash operations.
- **Atomicity where it was thought about.** Branch creation and wallet allocation run inside `prisma.$transaction` correctly.

---

## 04 Findings Register — Weaknesses

*Each finding: what we verified, why it matters (the accounting principle at stake), and the fix. Later sections reference these IDs.*

### F-01 — No audit trail exists `[Critical]`
**What we verified:** There is no `AuditLog` model anywhere in the Prisma schema. The `/dashboard/audit` page is a static placeholder that queries nothing. No financial mutation — posting, editing, deleting, approving, closing — leaves a who/when/what record beyond scattered `createdBy` fields.

**Why it matters:** ISA 315 treats the audit trail as a baseline IT general control. Without it, an external auditor cannot rely on any system-generated figure and must extend substantive testing — or qualify. Fraud investigation is impossible after the fact.

**Fix:** Append-only `AuditLog` (actor, action, entity, before/after JSON) written from the posting engine and every approval/close action. *(Complexity: Low–Medium)*

### F-02 — Posted entries are mutable — delete-and-repost is the standard pattern `[Critical]`
**What we verified:** Verified in three places: `postSaleInvoice` deletes all prior journal entries for a sale and re-creates them (`accounting-engine.ts:195–203`); the payments route bulk-deletes entries on edit (`api/accounting/payments/route.ts:451`); an admin API hard-deletes any journal entry including system-generated ones (`api/accounting/journal/route.ts`).

**Why it matters:** The foundational bookkeeping principle — errors are corrected by reversal, never by erasure — is violated by design. Any figure ever reported to a bank, board, or KRA can be silently changed afterwards. Every mature ERP (SAP, BC, NetSuite, Odoo) forbids physical deletion of posted documents.

**Fix:** Remove all `journalEntry.delete` paths; add `reversalOfId`; corrections generate contra entries. *(Complexity: Medium)*

### F-03 — Period close is decorative — nothing enforces it `[Critical]`
**What we verified:** Exactly two files reference `AccountingPeriod`: the period-management UI and its own actions. No posting path checks `isClosed`. Additionally, `closePeriod()` requires only a logged-in session — any employee can close (or leave open) a fiscal year — and no reopen mechanism exists at all.

**Why it matters:** Without posting-period control there is no month-end, no year-end, and no cut-off assertion. Comparability of reported periods (IAS 1) cannot be demonstrated.

**Fix:** Single `assertPostingAllowed(date, actor)` guard inside the engine; role-gate close; reopen requires reason + audit log. *(Complexity: Medium)*

### F-04 — VAT is never posted as a liability `[Critical]`
**What we verified:** `Sale.taxAmount` exists in the schema, and a Tax Rates admin screen exists — but the posting routine credits the entire invoice total to Sales Revenue (4000) (`accounting-engine.ts:217–233`). The `TaxRate` table is referenced by zero posting paths. There is no Output VAT or Input VAT account treatment anywhere.

**Why it matters:** Revenue is overstated by the VAT element (VAT collected is the state's money held in trust, not income), and the VAT liability is invisible in the balance sheet. Every VAT return filed from this system would be reconstructed by hand — and the P&L is simply wrong.

**Fix:** Split postings — Dr AR gross / Cr Revenue net / Cr Output VAT (2200); mirror for purchases; wire `TaxRate` into document capture. *(Complexity: Medium)*

### F-05 — No eTIMS, no WHT, no statutory tax reporting `[Critical]`
**What we verified:** A codebase-wide search for eTIMS, iTax, and withholding logic returns only category name strings. No invoice is transmitted to KRA; no control-unit invoice number is captured or printed.

**Why it matters:** eTIMS transmission is mandatory for VAT-registered businesses, and since January 2024 business expenses are non-deductible for income tax unless supported by an eTIMS invoice. Customers of this platform inherit that exposure on both the sales and purchase side. WHT (e.g. 5% professional fees, 3% contractual) is a withholding obligation — failure to withhold makes the payer liable for the tax plus penalties.

**Fix:** eTIMS OSCU/VSCU integration on the sales pipeline; WHT category on vendor payments with certificate generation; VAT return report. *(Complexity: High — external integration + certification)*

### F-06 — The wallet subsystem is a second, off-ledger set of books `[Critical]`
**What we verified:** Corporate wallet balances, branch wallet balances, HQ→branch allocations, and admin "virtual funds" all move through `WalletTransaction`/`BranchWalletTransaction` tables that never touch `JournalEntry`. The admin virtual top-up creates spendable balance with no accounting event at all. Real cash movements (Paystack/M-Pesa collections and disbursements) are therefore invisible to the trial balance.

**Why it matters:** This is, literally, two sets of books. The GL cash account (1000) and the wallet ledgers will never reconcile because they don't share events. An admin able to mint balance without a journal entry is a fraud vector an auditor will flag on day one — completeness and existence assertions both fail for cash.

**Fix:** Map each wallet to a GL cash/clearing sub-account; every wallet transaction posts through the engine; retire non-GL top-ups or post them to a funding/equity account with approval. *(Complexity: Medium–High)*

### F-07 — Money is stored as floating point `[High]`
**What we verified:** Every monetary field in the schema — journal lines, invoices, payments, budgets, wallets — is Prisma `Float` (double precision). The engine's own balance check tolerates a 0.01 drift per entry, which is an admission of the problem.

**Why it matters:** Binary floats cannot represent most decimal amounts exactly; errors compound across thousands of postings and surface as unexplainable cents in the trial balance — the classic symptom auditors probe first. Standard practice is `Decimal` (or integer cents).

**Fix:** Migrate monetary columns to `Decimal(18,2)`; round at capture; keep the Dr=Cr check exact. *(Complexity: Medium — mechanical but wide)*

### F-08 — Payment self-approval is blocked only in production `[High]`
**What we verified:** `api/payments/action/route.ts:52` — the maker≠checker check is wrapped in `NODE_ENV === 'production'`. In any staging/dev/misconfigured deployment, a maker authorizes their own payment.

**Why it matters:** Segregation of duties must be a property of the system, not of an environment variable. An auditor testing the control in a UAT environment will observe it failing.

**Fix:** Delete the env condition; enforce unconditionally. *(Complexity: Trivial)*

### F-09 — Sensitive financial actions lack role gating `[High]`
**What we verified:** Any authenticated user can create GL accounts (`api/accounting/accounts` POST checks session only), close accounting periods and fiscal years (F-03), and run depreciation for the entire company (`runDepreciation()` in `assets/actions.ts` has no auth check at all).

**Why it matters:** Chart-of-accounts changes, period close, and depreciation runs are controller-level actions. Unrestricted access defeats the RBAC system that otherwise exists.

**Fix:** Permission checks (`ACCOUNTING.MANAGE`, `PERIODS.CLOSE`) on every accounting mutation; audit-log each (F-01). *(Complexity: Low)*

### F-10 — Depreciation run is not idempotent `[High]`
**What we verified:** The run builds a period reference (`DEP-YYYY-MM-assetid`) but never checks whether that reference already exists before posting. Clicking "Run Depreciation" twice in a month double-charges depreciation and double-decrements asset book values. The GL posting and the asset-value update are also not wrapped in one transaction.

**Why it matters:** IAS 16 depreciation must be systematic; a button that silently double-posts corrupts both P&L and the asset register with no warning.

**Fix:** Uniqueness check on the period reference (skip-if-posted); wrap post + decrement in one transaction; record a depreciation schedule per asset. *(Complexity: Low)*

### F-11 — No bank accounts, and reconciliation state is not persisted `[High]`
**What we verified:** There is no `BankAccount` model — the entire cashbook is one hardcoded GL account (code 1000, "Cash & Bank"). The reconciliation screen loads that account's journal lines, but the schema contains no model for bank statements, statement lines, or match state: nothing an accountant ticks is saved, and no statement can be imported.

**Why it matters:** Bank reconciliation is the single most load-bearing monthly control in an SME. One merged cash account also makes multi-bank + M-Pesa float management impossible, and petty cash cannot be isolated.

**Fix:** `BankAccount` (one GL sub-account each), `BankStatement`/`StatementLine` import (CSV/M-Pesa export), persisted match records, reconciliation report with unreconciled carry-forward. *(Complexity: Medium–High)*

### F-12 — No journal voucher numbering or controlled document series `[High]`
**What we verified:** `JournalEntry` has no sequential entry number; references are free-text or timestamp-derived (e.g. `ALLOC-OUT-${Date.now()}`). Sales invoice numbers are unique but nothing guarantees a gapless series.

**Why it matters:** Completeness testing (ISA 500) relies on sequence checks — a gap or duplicate is how missing/duplicated transactions are caught. eTIMS additionally imposes controlled invoice numbering.

**Fix:** Per-type sequence table issuing gapless numbers inside the posting transaction. *(Complexity: Low–Medium)*

### F-13 — Magic GL codes and on-the-fly account creation `[Medium]`
**What we verified:** The engine locates accounts by hardcoded codes ('1000', '1200', '4000', '6050', '1600') and creates missing ones automatically mid-posting; the requisition module "self-heals" by seeding expense accounts with sequential codes from 6001. Three parallel taxonomies coexist (`Account`, `Category`, `CustomCategory`) linked by name-matching.

**Why it matters:** The chart of accounts is a controlled document; a system that silently invents accounts mid-transaction cannot maintain a stable mapping to financial statement lines. Renaming a category silently orphans history.

**Fix:** Account-mapping configuration (like Odoo's property accounts); fail loudly when unmapped; consolidate taxonomies onto `Account` with FK links. *(Complexity: Medium)*

### F-14 — Multi-step financial writes are not atomic `[Medium]`
**What we verified:** Requisition creation, approval-record generation, and (elsewhere) GL posting + document status updates run as separate awaited calls, not inside one `$transaction`. A crash mid-sequence leaves a requisition with no approval records, or a document marked paid without its journal entry.

**Why it matters:** Partially-completed financial state is worse than failure — it produces documents that exist operationally but not financially.

**Fix:** Wrap each document lifecycle event in a single transaction; add an integrity report (documents without postings). *(Complexity: Low–Medium)*

### F-15 — Multi-currency documents, single-currency ledger `[Medium]`
**What we verified:** Requisitions offer ~24 currencies and documents store a currency code, but `JournalLine` has no currency, no FX rate is stored, and the engine performs zero conversion — a USD 100 expense posts as 100 into a ledger read as KES.

**Why it matters:** IAS 21 requires transactions recorded at spot rate with monetary items revalued; today the trial balance silently sums mixed currencies. Either enforce KES-only capture or do FX properly — the current middle state corrupts data.

**Fix:** Near-term: restrict posting currency to KES, convert at capture with stored rate. Later: full FX — transaction + base amounts on lines, revaluation routine. *(Complexity: Low now / High later)*

### F-16 — Manual journals post instantly with no review `[Medium]`
**What we verified:** The manual journal modal posts straight to `POSTED` status. Payments got maker-checker; journals — the most abusable instrument in accounting — did not. Backdating is unrestricted (compounded by F-03).

**Why it matters:** Management-override risk (ISA 240) concentrates in manual journal entries; auditors specifically test late and unusual journals. A draft→approve flow for journals above a threshold is standard.

**Fix:** `DRAFT` status + approval permission for manual journals; flag backdated entries. *(Complexity: Low–Medium)*

### F-17 — Account security below financial-system bar `[Medium]`
**What we verified:** Passwords are bcrypt-hashed (good) and RBAC exists, but: no 2FA, no login rate-limiting or lockout (verified — no attempt-tracking fields), no session/device audit, and this engagement itself demonstrated that direct database access can silently reset credentials with no trace (see F-01).

**Why it matters:** Finance-facing systems need a stronger authentication bar than the average SaaS product, given the direct monetary consequence of a compromised account.

**Fix:** TOTP 2FA for finance roles, lockout + alerting, login history. *(Complexity: Medium)*

---

## 05 Missing Features

| Capability | Status in Pesanest | ERP baseline | Essential? |
|---|---|---|---|
| eTIMS e-invoicing | Absent | KRA-certified OSCU/VSCU | Essential (statutory) |
| Withholding tax | Absent | WHT codes on vendor bills + certificates | Essential |
| Bank statement import & persisted reconciliation | Screen only, no persistence (F-11) | Feeds/import + match memory | Essential |
| Accruals, prepayments, deferred income, recurring journals | Absent (recurring exists only for requisitions) | Deferral schedules + recurring JE templates | Essential for accrual accounting |
| Petty cash / cash float module | Branch wallets exist but off-ledger (F-06) | Imprest accounts on GL | Essential |
| Audit trail & close management | Absent / decorative (F-01, F-03) | Universal | Essential |
| Cost centres / dimensions | Branch + free-text department only | Dimension tagging on journal lines | Optional → High as clients grow |
| Inventory accounting (COGS, valuation) | Absent — sale lines are free-form | Perpetual inventory, FIFO/WAC | Industry-specific |
| Multi-company & consolidation | One org per deployment (env-file tenancy) | Entity dimension + eliminations | Optional |
| Full multi-currency (IAS 21) | Cosmetic currency fields (F-15) | Rates, dual amounts, revaluation | Optional → High if FX is real |
| Fixed-asset disposals & revaluation | Register + depreciation only | Disposal with gain/loss posting | High |

---

## 06 Compliance Risks — Kenya

- **eTIMS (F-05):** invoices issued outside eTIMS expose sellers to penalties and render buyers' expenses non-deductible. This is the largest single adoption blocker for Kenyan businesses.
- **VAT accounting (F-04):** no output/input VAT ledger means no system-generated VAT return; manual returns diverging from books is a classic KRA audit trigger.
- **WHT (F-05):** the payment module can disburse professional/contractual fees with no withholding — the client becomes personally liable for un-withheld tax.
- **Record retention & integrity:** the Tax Procedures Act expects reliable records for 5 years; mutable books (F-02) undermine the reliability claim itself.

---

## 07 Accounting Risks

- **Misstated revenue and liabilities —** VAT inside revenue (F-04): P&L overstated, balance sheet missing a liability, both by the full VAT element of every sale.
- **Incomplete cash —** wallet flows outside the GL (F-06) break completeness/existence for the most sensitive asset class.
- **Cut-off failure —** unenforced periods + unrestricted backdating (F-03, F-16).
- **Arithmetic integrity —** float money (F-07) plus a per-entry 1-cent tolerance compounds across volume.
- **Asset values —** double-run depreciation (F-10) and no disposal accounting.
- **Cash-basis books presented as accrual —** no accrual/prepayment machinery (§5) while producing accrual-format statements.

---

## 08 Tax Risks

Concentrated in F-04 and F-05; the compounding factor is that the system looks tax-aware — a Tax Rates screen exists, invoices carry a tax amount field — while no posting, return, or transmission actually uses them. A finance team could reasonably believe VAT is handled. Recommendation: until Phase 1 of the roadmap ships, the product should explicitly state that tax computation and filing are out of scope.

---

## 09 Security Risks

- Environment-dependent SoD control (F-08).
- Ungated financial endpoints — COA creation, period close, depreciation run (F-09).
- No 2FA / lockout / session audit for finance users (F-17).
- Admin balance-minting with no accounting event (F-06) — an insider-fraud design gap, independent of authentication strength.
- No tamper-evidence on the ledger (F-01, F-02): with DB access, history rewrites are undetectable. Mature systems add hash-chaining or rely on immutability + append-only logs.

---

## 10 Internal Control Weaknesses

| Control | Expected (COSO / ERP baseline) | Observed | Ref |
|---|---|---|---|
| Audit trail | Append-only, all financial mutations | None | F-01 |
| Correction discipline | Reversal entries only | Delete-and-repost | F-02 |
| Posting-period control | Enforced at posting layer | Flag read by nothing | F-03 |
| Segregation of duties | Unconditional maker≠checker | Production-only; journals exempt | F-08, F-16 |
| Access to COA / close / depreciation | Controller-level permission | Any user / no auth | F-09 |
| Document sequences | Gapless, system-issued | Free-text / timestamps | F-12 |
| Bank reconciliation | Persisted, reviewable, carried forward | Ephemeral screen | F-11 |
| Master-data control | Approved COA changes | Auto-created mid-posting | F-13 |

---

## 11 Workflow Weaknesses

- No month-end or year-end procedure exists in practice — closing is a button any user can press that changes nothing (F-03). There is no close checklist, no pre-close validation (unposted documents, unbalanced days), no closing entries for year-end P&L rollup to retained earnings.
- Corrections have no sanctioned path. Because reversals aren't modeled, users' only options are editing history (F-02) or asking an admin to hard-delete — both audit failures. Credit notes exist for AR; nothing equivalent exists for journals, payments, or expenses.
- Partial completion is unhandled (F-14) — no retry, no integrity sweep, no alerting for documents whose postings are missing.
- Offline/interruption behaviour: the system is online-only; a network drop mid-submission relies on the browser resubmitting. For field/branch operations (the wallet use-case) there is no queued capture. Acceptable for now, but eTIMS work (Phase 1) should choose an offline-capable control unit deliberately.
- Payment reversal: a bounced/reversed bank payment has no representation — status flows forward only. Requires a reversal state that re-opens the payable and posts the contra entry.

---

## 12 Reporting Gaps

- Statements exist but inherit misstatement from F-04/F-06/F-15 — the trial balance is internally consistent yet wrong about VAT, cash, and currency. Fixing the postings fixes the reports; the report layer itself is serviceable.
- No AR/AP aging reports tied to the GL control accounts (customer statements exist, aging summaries with control-account tie-out do not).
- No tax reports: VAT return, WHT register/certificates, deductibility flags.
- No close binder: auditors expect period-end TB snapshot, journals listing, sequence-gap and exception reports (backdated entries, manual journals near period end, documents without postings).
- No comparative periods / budget-vs-actual on the statement suite (budgets exist but seed synthetic KSh 1,000 defaults, so variance reporting would currently mislead).

---

## 13 Scalability Concerns

- Reports compute from raw journal lines with no summarization layer — fine to ~10⁵ lines, degrades beyond; plan period-balance snapshots once close (F-03) exists to anchor them.
- Tenancy by environment file (separate DB per client via `.env` swap) is operationally fragile — this session's own confusion between three live databases is the cautionary tale. Acceptable short-term; needs deliberate tenancy architecture before scale.
- Sequential-number contention (once F-12 is fixed) needs row-lock discipline inside the posting transaction.
- The QuickBooks sync writes into the ledger and must respect the same posting guard as users, or it becomes the back door that punctures every control added above.

---

## 14 Recommendations

Three governing principles, then the priority lists in §15–16:

- **One gate for every shilling.** Every financial mutation — user, wallet, sync, depreciation — flows through `AccountingEngine`, which enforces balance, period, permission, sequence, and audit logging. Add a CI check failing any direct `journalEntry.create`/`delete` outside the engine.
- **The ledger is append-only.** Nothing posted is ever updated or deleted; corrections are new entries that reference what they correct. This single principle converts most Critical findings into non-issues.
- **Compliance is a product surface, not a report.** eTIMS and VAT belong in the transaction capture flow (rates on lines, control-unit numbers on invoices), not as after-the-fact exports.

---

## 15 Implement Immediately — Critical Path

| # | Item | Resolves | Complexity | Priority |
|---|---|---|---|---|
| 1 | Append-only audit log + wire into engine, approvals, close, auth events | F-01 | Low–Med | Critical |
| 2 | Remove all journal delete paths; reversal-entry mechanism (`reversalOfId`) | F-02 | Medium | Critical |
| 3 | `assertPostingAllowed` period/lock enforcement + role-gated close/reopen with reason | F-03 | Medium | Critical |
| 4 | VAT split posting (Output/Input VAT accounts); wire `TaxRate` into capture | F-04 | Medium | Critical |
| 5 | Wallet→GL unification; kill no-entry balance minting | F-06 | Med–High | Critical |
| 6 | Unconditional maker≠checker; role-gate COA/close/depreciation endpoints | F-08, F-09 | Trivial–Low | Critical |
| 7 | Depreciation idempotency + transaction wrap | F-10 | Low | High |
| 8 | Gapless journal & document numbering | F-12 | Low–Med | High |
| 9 | Atomic document lifecycles + orphan-posting integrity report | F-14 | Low–Med | High |
| 10 | Decimal money migration plan (schema + rounding policy) | F-07 | Medium | High |

---

## 16 Implement Later

| Item | Resolves / adds | Complexity | Priority |
|---|---|---|---|
| eTIMS integration (OSCU/VSCU) + controlled invoice series | F-05 | High | Critical before Kenyan GA |
| Bank accounts, statement import, persisted reconciliation | F-11 | Med–High | High |
| WHT on vendor payments + certificates; VAT return report | F-05 | Medium | High |
| Manual-journal draft→approve; backdating flags | F-16 | Low–Med | High |
| Accruals / prepayments / deferred income / recurring journals | §5 | Medium | High |
| Day-end close ritual (checklist + lock-date advance) on top of item 3 | prior memo | Medium | High |
| COA governance: mapping config, taxonomy consolidation, edit/archive UI | F-13 | Medium | Medium |
| 2FA, lockout, session audit for finance roles | F-17 | Medium | Medium |
| KES-only enforcement now; full IAS 21 multi-currency later | F-15 | Low / High | Medium |
| Asset disposals, AR/AP aging, close binder, comparatives | §12 | Medium | Medium |
| Inventory accounting; multi-company consolidation; cost-centre dimensions | §5 | High | Low / market-driven |

---

## 17 Roadmap to an Enterprise-Grade ERP

**Phase 0** *(Weeks 1–4)* — **Trust foundations**
Items 1–3 and 6–9 of §15: audit log, append-only ledger with reversals, enforced periods, unconditional SoD, gated endpoints, idempotent depreciation, gapless numbering, atomic lifecycles. Exit test: an external auditor can be shown who did what, proven history cannot change, and shown a period that actually locks.

**Phase 1** *(Weeks 5–10)* — **Kenyan tax compliance**
VAT split posting and return report; eTIMS OSCU/VSCU integration with controlled invoice series; WHT capture and certificates. Decimal migration lands here (schema churn batches well with tax fields). Exit test: a VAT-registered client can invoice, file, and survive a KRA desk review from system output alone.

**Phase 2** *(Weeks 11–16)* — **Cash truth**
Bank account entities, statement import (bank CSV + M-Pesa), persisted reconciliation, wallet→GL unification, petty-cash imprest, payment reversal flow, day-end close ritual. Exit test: every shilling of real-world cash movement appears in the trial balance and reconciles to an external statement.

**Phase 3** *(Months 5–6)* — **Accrual completeness**
Accruals/prepayments/deferred income with schedules, recurring journals, manual-journal approval, asset disposals, AR/AP aging with control-account tie-out, close binder, comparative reporting, month/year-end closing entries to retained earnings.

**Phase 4** *(Month 7+)* — **Scale & breadth**
Full multi-currency per IAS 21, cost-centre dimensions on journal lines, period-balance summarization for reporting scale, deliberate tenancy architecture, then market-driven modules (inventory, consolidation). 2FA and session audit land no later than here.

---

### Closing opinion

*If a client asked me today whether they can run their finance department on Pesanest, my answer would be: not yet — but the distance is shorter than it looks. The expensive architectural decision (a single validated posting engine) is already correct; what's missing is discipline layered onto it, not a rewrite. Phase 0 alone moves this system from "records transactions" to "defensible books." Phase 1 makes it sellable in Kenya. Most platforms at this stage have the opposite problem — polish on top of a broken core. This one has a sound core waiting for its controls.*

*Prepared from direct source inspection. File references cite the repository at time of review; findings marked with specific line numbers were read, not inferred. One earlier assessment was corrected during this review: fixed-asset depreciation does post to the general ledger — the residual issues are idempotency and authorization (F-09, F-10).*
