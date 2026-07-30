
import prisma from "@/lib/prisma";

// ─── Helpers ────────────────────────────────────────────────────────────────

async function getNextEntryNumber(): Promise<string> {
    const seq = await (prisma as any).documentSequence.upsert({
        where: { prefix: 'JE' },
        update: { lastNumber: { increment: 1 } },
        create: { prefix: 'JE', lastNumber: 1 },
    });
    return `JE-${String(seq.lastNumber).padStart(6, '0')}`;
}

async function writeAuditLog(params: {
    actorId?: string;
    actorEmail?: string;
    action: string;
    entity: string;
    entityId?: string;
    before?: object;
    after?: object;
}) {
    try {
        await (prisma as any).auditLog.create({ data: params });
    } catch {
        // Audit failure must never abort a financial operation — log to stderr only
        console.error('[AuditLog] Failed to write audit entry:', params);
    }
}

/**
 * Throws if `date` falls in a closed accounting period.
 * Also throws if the fiscal year itself is closed.
 */
async function assertPostingAllowed(date: Date): Promise<void> {
    const period = await (prisma as any).accountingPeriod.findFirst({
        where: {
            startDate: { lte: date },
            endDate: { gte: date },
        },
    });

    if (period?.isClosed) {
        throw new Error(
            `Posting not allowed: accounting period "${period.name}" is closed.`
        );
    }

    if (period) {
        const fy = await (prisma as any).fiscalYear.findUnique({
            where: { id: period.fiscalYearId },
        });
        if (fy?.isClosed) {
            throw new Error(
                `Posting not allowed: fiscal year "${fy.name}" is closed.`
            );
        }
    }
}

// ─── Engine ─────────────────────────────────────────────────────────────────

export class AccountingEngine {

    /**
     * Posts a Journal Entry (General Ledger).
     * Enforces: double-entry balance, open period, gapless numbering, audit log.
     */
    static async postJournalEntry(
        data: {
            date: Date;
            description: string;
            reference?: string;
            lines: { accountId: string; debit: number; credit: number; description?: string; costCentreId?: string }[];
            source?: {
                expenseId?: string;
                invoiceId?: string;
                paymentId?: string;
                saleId?: string;
                creditNoteId?: string;
                requisitionId?: string;
                monthlyBudgetId?: string;
            };
            userId?: string;
            reversalOfId?: string;
            currency?: string;
        }
    ) {
        // KES-only enforcement — multi-currency requires IAS 21 revaluation (Phase 5+)
        if (data.currency && data.currency !== 'KES') {
            throw new Error(`Multi-currency posting not yet supported. All entries must be in KES (received: ${data.currency}).`);
        }
        // 1. Period guard
        await assertPostingAllowed(data.date);

        // 2. Double-entry validation
        const totalDebit = data.lines.reduce((sum, line) => sum + line.debit, 0);
        const totalCredit = data.lines.reduce((sum, line) => sum + line.credit, 0);

        if (Math.abs(totalDebit - totalCredit) > 0.01) {
            throw new Error(`Double Entry Mismatch: Debits (${totalDebit}) != Credits (${totalCredit})`);
        }

        // 3. Gapless sequence number
        const entryNumber = await getNextEntryNumber();

        // 4. Create the entry
        const entry = await (prisma as any).journalEntry.create({
            data: {
                entryNumber,
                date: data.date,
                description: data.description,
                reference: data.reference,
                expenseId: data.source?.expenseId,
                invoiceId: data.source?.invoiceId,
                saleId: data.source?.saleId,
                paymentId: data.source?.paymentId,
                creditNoteId: data.source?.creditNoteId,
                requisitionId: data.source?.requisitionId,
                monthlyBudgetId: data.source?.monthlyBudgetId,
                reversalOfId: data.reversalOfId,
                createdBy: data.userId,
                status: 'POSTED',
                lines: {
                    create: data.lines.map(line => ({
                        accountId: line.accountId,
                        debit: line.debit,
                        credit: line.credit,
                        description: line.description || data.description,
                        ...(line.costCentreId && { costCentreId: line.costCentreId })
                    }))
                }
            }
        });

        // 5. Audit log
        await writeAuditLog({
            actorId: data.userId,
            action: data.reversalOfId ? 'JOURNAL_REVERSE' : 'JOURNAL_POST',
            entity: 'JournalEntry',
            entityId: entry.id,
            after: { entryNumber, description: data.description, reference: data.reference },
        });

        return entry;
    }

    /**
     * Creates a contra-entry that reverses an existing posted journal entry.
     * The original entry is left untouched (append-only ledger).
     */
    static async createReversal(
        entryId: string,
        userId: string,
        reason: string
    ) {
        const original = await (prisma as any).journalEntry.findUnique({
            where: { id: entryId },
            include: { lines: true },
        });

        if (!original) throw new Error(`Journal entry ${entryId} not found`);

        // Check it hasn't already been reversed
        const alreadyReversed = await (prisma as any).journalEntry.findFirst({
            where: { reversalOfId: entryId },
        });
        if (alreadyReversed) {
            throw new Error(`Entry ${entryId} has already been reversed (${alreadyReversed.entryNumber})`);
        }

        // Period guard on reversal date (today)
        const reversalDate = new Date();
        await assertPostingAllowed(reversalDate);

        const reversalLines = original.lines.map((line: any) => ({
            accountId: line.accountId,
            debit: line.credit,   // swap debit ↔ credit
            credit: line.debit,
            description: `Reversal: ${line.description || original.description}`,
        }));

        return this.postJournalEntry({
            date: reversalDate,
            description: `Reversal of ${original.entryNumber}: ${reason}`,
            reference: original.reference ? `REV-${original.reference}` : undefined,
            lines: reversalLines,
            reversalOfId: original.id,
            userId,
        });
    }

    /**
     * AUTOMATION: Post an Expense to the Ledger
     */
    static async postExpensePayment(expenseId: string, paidFromAccountId: string) {
        const expense = await (prisma as any).expense.findUnique({
            where: { id: expenseId }
        });

        if (!expense) throw new Error("Expense not found");

        let expenseAccount = await prisma.account.findFirst({
            where: { name: expense.category, type: 'EXPENSE' }
        });

        if (!expenseAccount) {
            expenseAccount = await prisma.account.findFirst({ where: { code: '6000' } });
        }

        if (!expenseAccount) throw new Error("No GL Account found for this expense category");

        await this.postJournalEntry({
            date: new Date(),
            description: `Payment for Expense: ${expense.title}`,
            reference: `EXP-${expenseId.substring(0, 8)}`,
            source: { expenseId: expense.id },
            lines: [
                { accountId: expenseAccount.id, debit: expense.amount, credit: 0 },
                { accountId: paidFromAccountId, debit: 0, credit: expense.amount }
            ]
        });
    }

    /**
     * AUTOMATION: Post a Requisition Payment to the Ledger
     */
    static async postRequisitionPayment(requisitionId: string, paidFromAccountId: string) {
        const requisition = await prisma.requisition.findUnique({
            where: { id: requisitionId }
        });

        if (!requisition) throw new Error("Requisition not found");

        let expenseAccount: any = null;

        if ((requisition as any).accountId) {
            expenseAccount = await prisma.account.findUnique({ where: { id: (requisition as any).accountId } });
        }

        if (!expenseAccount) {
            expenseAccount = await prisma.account.findFirst({
                where: { name: requisition.category, type: 'EXPENSE' }
            });

            if (!expenseAccount) {
                expenseAccount = await prisma.account.findFirst({ where: { code: '6000' } });
            }
        }

        if (!expenseAccount) throw new Error("No GL Account found for this requisition");

        await this.postJournalEntry({
            date: new Date(),
            description: `Payment for Requisition: ${requisition.title}`,
            reference: `REQ-${requisitionId.substring(0, 8)}`,
            source: { requisitionId: requisition.id },
            lines: [
                { accountId: expenseAccount.id, debit: requisition.amount, credit: 0 },
                { accountId: paidFromAccountId, debit: 0, credit: requisition.amount }
            ]
        });
    }

    /**
     * AUTOMATION: Post a Monthly Budget Disbursement to the Ledger
     */
    static async postBudgetDisbursement(budgetId: string, paidFromAccountId: string) {
        const budget = await (prisma as any).monthlyBudget.findUnique({
            where: { id: budgetId }
        });

        if (!budget) throw new Error("Budget not found");

        const expenseAccount = await prisma.account.findFirst({ where: { code: '6000' } });
        if (!expenseAccount) throw new Error("Operating Expenses (6000) Account not found");

        await this.postJournalEntry({
            date: new Date(),
            description: `Disbursement: ${budget.month}/${budget.year} Budget - ${budget.branch}`,
            reference: `BUD-${budgetId.substring(0, 8)}`,
            source: { monthlyBudgetId: budget.id },
            lines: [
                { accountId: expenseAccount.id, debit: budget.totalAmount, credit: 0 },
                { accountId: paidFromAccountId, debit: 0, credit: budget.totalAmount }
            ]
        });
    }

    /**
     * AUTOMATION: Post a Sale (Invoice) to the Ledger.
     * VAT-aware: if the sale has a tax amount, splits posting into
     *   Dr AR (gross) / Cr Revenue (net) / Cr Output VAT 2200
     * If an entry already exists it is skipped — use createReversal() if the sale changes.
     */
    static async postSaleInvoice(saleId: string, userId?: string) {
        const sale = await prisma.sale.findUnique({
            where: { id: saleId },
            include: { customer: true }
        });

        if (!sale) throw new Error("Sale not found");

        // Idempotency: skip if already posted
        const existing = await (prisma as any).journalEntry.findFirst({
            where: { saleId: sale.id, reversalOfId: null }
        });
        if (existing) return existing;

        const arAccount = await prisma.account.findFirst({ where: { code: '1200' } });
        const revenueAccount = await prisma.account.findFirst({ where: { code: '4000' } });
        if (!arAccount || !revenueAccount) throw new Error("Missing AR (1200) or Revenue (4000) Accounts in GL");

        const gross = Number(sale.totalAmount);
        const tax = Number(sale.taxAmount);
        const net = gross - tax;

        if (tax > 0) {
            // Ensure Output VAT liability account exists
            let outputVatAccount = await prisma.account.findFirst({ where: { code: '2200' } });
            if (!outputVatAccount) {
                outputVatAccount = await prisma.account.create({
                    data: { code: '2200', name: 'Output VAT Payable', type: 'LIABILITY', subtype: 'TAX' }
                });
            }

            return this.postJournalEntry({
                date: sale.issueDate,
                description: `Invoice #${sale.invoiceNumber} for ${sale.customer.name}`,
                reference: sale.invoiceNumber,
                source: { saleId: sale.id },
                userId,
                lines: [
                    { accountId: arAccount.id, debit: gross, credit: 0, description: 'AR — gross invoice' },
                    { accountId: revenueAccount.id, debit: 0, credit: net, description: 'Revenue — net of VAT' },
                    { accountId: outputVatAccount.id, debit: 0, credit: tax, description: 'Output VAT' },
                ]
            });
        }

        return this.postJournalEntry({
            date: sale.issueDate,
            description: `Invoice #${sale.invoiceNumber} for ${sale.customer.name}`,
            reference: sale.invoiceNumber,
            source: { saleId: sale.id },
            userId,
            lines: [
                { accountId: arAccount.id, debit: gross, credit: 0 },
                { accountId: revenueAccount.id, debit: 0, credit: gross }
            ]
        });
    }

    /**
     * AUTOMATION: Post a Credit Note to the Ledger
     */
    static async postCreditNote(creditNoteId: string) {
        const creditNote = await prisma.creditNote.findUnique({
            where: { id: creditNoteId },
            include: { customer: true }
        });

        if (!creditNote) throw new Error("Credit Note not found");

        const arAccount = await prisma.account.findFirst({ where: { code: '1200' } });

        let returnsAccount = await prisma.account.findFirst({ where: { code: '4100' } });
        if (!returnsAccount) {
            returnsAccount = await prisma.account.findFirst({
                where: { name: { contains: 'Return', mode: 'insensitive' } }
            });
        }

        if (!arAccount) throw new Error("Missing AR (1200) Account");
        if (!returnsAccount) throw new Error("Missing Sales Return Account");

        return this.postJournalEntry({
            date: creditNote.createdAt,
            description: `Credit Note #${creditNote.cnNumber} for ${creditNote.customer.name} - ${creditNote.reason}`,
            reference: creditNote.cnNumber,
            source: { creditNoteId: creditNote.id },
            lines: [
                { accountId: returnsAccount.id, debit: creditNote.amount, credit: 0 },
                { accountId: arAccount.id, debit: 0, credit: creditNote.amount }
            ]
        });
    }

    /**
     * AUTOMATION: Post Asset Purchase to Ledger
     */
    static async postAssetPurchase(assetId: string) {
        const asset = await (prisma as any).asset.findUnique({ where: { id: assetId } });
        if (!asset) throw new Error("Asset not found");

        let assetAccount = await prisma.account.findFirst({
            where: { name: asset.category, type: 'ASSET' }
        });
        if (!assetAccount) {
            assetAccount = await prisma.account.findFirst({ where: { code: '1500' } });
        }

        const bankAccount = await prisma.account.findFirst({ where: { code: '1000' } });

        if (!assetAccount || !bankAccount) {
            console.warn("Missing GL Accounts for Asset Purchase. Skipping Ledger Post.");
            return;
        }

        return this.postJournalEntry({
            date: asset.purchaseDate,
            description: `Asset Purchase: ${asset.name}`,
            reference: asset.assetTag || asset.serialNumber || `ASSET-${asset.id.substring(0, 8)}`,
            source: {},
            lines: [
                { accountId: assetAccount.id, debit: asset.purchasePrice, credit: 0 },
                { accountId: bankAccount.id, debit: 0, credit: asset.purchasePrice }
            ]
        });
    }

    /**
     * AUTOMATION: Post Depreciation Entry.
     * Idempotent — skips silently if the period reference was already posted.
     */
    static async postAssetDepreciation(assetId: string, amount: number, period: string) {
        const asset = await (prisma as any).asset.findUnique({ where: { id: assetId } });
        if (!asset) throw new Error("Asset not found");

        const depRef = `DEP-${period}-${asset.id.substring(0, 6)}`;

        // Idempotency: skip if this period was already posted for this asset
        const already = await (prisma as any).journalEntry.findFirst({
            where: { reference: depRef },
        });
        if (already) return already;

        let expenseAccount = await prisma.account.findFirst({ where: { code: '6050' } });
        let accumAccount = await prisma.account.findFirst({ where: { code: '1600' } });

        if (!expenseAccount) {
            expenseAccount = await prisma.account.create({
                data: { code: '6050', name: 'Depreciation Expense', type: 'EXPENSE' }
            });
        }
        if (!accumAccount) {
            accumAccount = await prisma.account.create({
                data: { code: '1600', name: 'Accumulated Depreciation', type: 'ASSET', subtype: 'CONTRA' }
            });
        }

        return this.postJournalEntry({
            date: new Date(),
            description: `Depreciation (${period}): ${asset.name}`,
            reference: depRef,
            lines: [
                { accountId: expenseAccount.id, debit: amount, credit: 0 },
                { accountId: accumAccount.id, debit: 0, credit: amount }
            ]
        });
    }

    /**
     * AUTOMATION: Post Vendor Invoice to Ledger.
     * Input VAT-aware: if the invoice has a tax amount, splits posting into
     *   Dr Expense (net) / Dr Input VAT 2100 / Cr AP (gross)
     */
    static async postVendorInvoice(invoiceId: string) {
        const invoice = await prisma.invoice.findUnique({
            where: { id: invoiceId },
            include: { vendor: true, items: true }
        });

        if (!invoice) throw new Error("Invoice not found");

        const apAccount = await prisma.account.findFirst({ where: { code: '2000' } });
        if (!apAccount) throw new Error("Missing Accounts Payable (2000) Account");

        const expenseAccount = await prisma.account.findFirst({ where: { code: '6000' } });
        if (!expenseAccount) throw new Error("Missing Operating Expenses (6000) Account");

        const gross = Number(invoice.amount);
        const tax = Number(invoice.taxAmount);
        const net = gross - tax;

        if (tax > 0) {
            let inputVatAccount = await prisma.account.findFirst({ where: { code: '2100' } });
            if (!inputVatAccount) {
                inputVatAccount = await prisma.account.create({
                    data: { code: '2100', name: 'Input VAT Recoverable', type: 'ASSET', subtype: 'TAX' }
                });
            }

            return this.postJournalEntry({
                date: invoice.invoiceDate,
                description: `Vendor Invoice #${invoice.invoiceNumber} - ${invoice.vendor.name}`,
                reference: invoice.invoiceNumber,
                source: { invoiceId: invoice.id },
                lines: [
                    { accountId: expenseAccount.id, debit: net, credit: 0, description: 'Expense — net of VAT' },
                    { accountId: inputVatAccount.id, debit: tax, credit: 0, description: 'Input VAT' },
                    { accountId: apAccount.id, debit: 0, credit: gross, description: 'AP — gross payable' },
                ]
            });
        }

        return this.postJournalEntry({
            date: invoice.invoiceDate,
            description: `Vendor Invoice #${invoice.invoiceNumber} - ${invoice.vendor.name}`,
            reference: invoice.invoiceNumber,
            source: { invoiceId: invoice.id },
            lines: [
                { accountId: expenseAccount.id, debit: gross, credit: 0, description: invoice.description || undefined },
                { accountId: apAccount.id, debit: 0, credit: gross }
            ]
        });
    }

    /**
     * AUTOMATION: Post Vendor Payment to Ledger.
     * WHT-aware: if the invoice has a whtAmount, splits posting into
     *   Dr AP (gross) / Cr Cash (net of WHT) / Cr WHT Payable 2300
     */
    static async postVendorPayment(invoiceId: string, paymentAmount: number) {
        const invoice = await prisma.invoice.findUnique({
            where: { id: invoiceId },
            include: { vendor: true }
        });

        if (!invoice) throw new Error("Invoice not found");

        const apAccount = await prisma.account.findFirst({ where: { code: '2000' } });
        const cashAccount = await prisma.account.findFirst({ where: { code: '1000' } });

        if (!apAccount || !cashAccount) throw new Error("Missing AP (2000) or Cash (1000) Account");

        const wht = Number(invoice.whtAmount);

        if (wht > 0) {
            let whtPayableAccount = await prisma.account.findFirst({ where: { code: '2300' } });
            if (!whtPayableAccount) {
                whtPayableAccount = await prisma.account.create({
                    data: { code: '2300', name: 'Withholding Tax Payable', type: 'LIABILITY', subtype: 'TAX' }
                });
            }

            const netCash = paymentAmount - wht;

            return this.postJournalEntry({
                date: new Date(),
                description: `Payment for Invoice #${invoice.invoiceNumber} - ${invoice.vendor.name}`,
                reference: `PAY-${invoice.invoiceNumber}`,
                source: { invoiceId: invoice.id },
                lines: [
                    { accountId: apAccount.id, debit: paymentAmount, credit: 0, description: 'AP cleared' },
                    { accountId: cashAccount.id, debit: 0, credit: netCash, description: 'Cash paid (net of WHT)' },
                    { accountId: whtPayableAccount.id, debit: 0, credit: wht, description: 'WHT withheld — payable to KRA' },
                ]
            });
        }

        return this.postJournalEntry({
            date: new Date(),
            description: `Payment for Invoice #${invoice.invoiceNumber} - ${invoice.vendor.name}`,
            reference: `PAY-${invoice.invoiceNumber}`,
            source: { invoiceId: invoice.id },
            lines: [
                { accountId: apAccount.id, debit: paymentAmount, credit: 0 },
                { accountId: cashAccount.id, debit: 0, credit: paymentAmount }
            ]
        });
    }

    /**
     * AUTOMATION: Post Customer Payment to Ledger
     */
    static async postCustomerPayment(paymentId: string) {
        const payment = await prisma.customerPayment.findUnique({
            where: { id: paymentId },
            include: { customer: true, sale: true }
        });

        if (!payment) throw new Error("Customer payment not found");

        const cashAccount = await prisma.account.findFirst({ where: { code: '1000' } });
        const arAccount = await prisma.account.findFirst({ where: { code: '1200' } });

        if (!cashAccount || !arAccount) throw new Error("Missing Cash (1000) or AR (1200) Account");

        const reference = payment.sale
            ? `PMT-${payment.sale.invoiceNumber}`
            : `PMT-${payment.id.substring(0, 8)}`;

        return this.postJournalEntry({
            date: payment.paymentDate,
            description: `Payment from ${payment.customer.name}${payment.sale ? ` for Invoice #${payment.sale.invoiceNumber}` : ''}`,
            reference,
            lines: [
                { accountId: cashAccount.id, debit: payment.amount, credit: 0 },
                { accountId: arAccount.id, debit: 0, credit: payment.amount }
            ]
        });
    }
}
