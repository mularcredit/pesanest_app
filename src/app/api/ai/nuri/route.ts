/**
 * Nuri — the AI assistant with read access to live financial data.
 *
 * Deliberately NOT raw SQL / free-form query access: the model can only call
 * a fixed set of hand-written, reviewed Prisma queries below. That keeps the
 * blast radius bounded (no injection surface, no accidental full-table dumps)
 * while still covering the questions people actually ask. Add more tools here
 * as new question categories come up — don't loosen this to raw SQL.
 *
 * Admin-only for now: the tools return real balances, vendor contacts, and
 * payment details, which isn't broadly appropriate for every role yet.
 */

import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";

const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";
const MAX_TOOL_ITERATIONS = 5;
const MAX_ROWS = 50;

/**
 * Where things live in the sidebar, kept in sync with src/components/layout/Sidebar.tsx by hand.
 * Lets Nuri answer "where is X" / "how do I do X" navigation questions directly, with no tool call —
 * those aren't data questions, so the "never guess" rule doesn't apply to them.
 */
const NAVIGATION_GUIDE = `
Sidebar map (section → page → path):
- Overview: Dashboard (/dashboard) · Branches (/dashboard/branches) · Regions (/dashboard/regions) · Analytics (/dashboard/reports) · Workflow Analytics (/dashboard/workflow-analytics)
- Expenses: Expenses/requisitions (/dashboard/requisitions) · Approvals (/dashboard/approvals) · Payments (/dashboard/payments)
- Financial: Corporate wallet (/dashboard/wallet) · Petty cash (/dashboard/petty-cash) · Transfers (/dashboard/transfers) · Budgets (/dashboard/budgets) · Forecasting (/dashboard/forecasting) · Audit trail (/dashboard/audit)
- Accounting: Trial Balance (/dashboard/accounting/reports/trial-balance) · Income Statement (/dashboard/accounting/reports/income-statement) · Balance Sheet (/dashboard/accounting/reports/balance-sheet) · Comparative Reports (/dashboard/accounting/reports/comparative) · Cash Flow Statement (/dashboard/accounting/reports/cash-flow) · AR/AP Aging (/dashboard/accounting/aging) · General Ledger (/dashboard/accounting/ledger) · Journal Approvals (/dashboard/accounting/journal-approvals) · Accrual Schedules (/dashboard/accounting/accruals) · Recurring Journals (/dashboard/accounting/recurring-journals) · Close Binder (/dashboard/accounting/close-binder) · Cost Centres (/dashboard/accounting/cost-centres) · Cost Centre Report (/dashboard/accounting/reports/by-dimension) · Customers (/dashboard/accounting/customers) · Sales & Income (/dashboard/accounting/sales) · Accounts Payable (/dashboard/accounting/payables) · Period Management (/dashboard/accounting/periods) · Tax Rates (/dashboard/accounting/tax-rates) · Chart of Accounts (/dashboard/accounting/chart-of-accounts) · Bank Reconciliation (/dashboard/accounting/reconciliation, history at /dashboard/accounting/reconciliation/history)
- Operations: Vendors (/dashboard/vendors) · Invoices (/dashboard/invoices) · Contracts (/dashboard/contracts) · Assets (/dashboard/assets) · Schedules (/dashboard/schedules)
- Administration: Team management (/dashboard/team) · Account Requests (/dashboard/users) · Roles & Permissions (/dashboard/roles) · Policies (/dashboard/policies) · Data Import (/dashboard/settings/import) · Account Security (/dashboard/settings/security) · System config (/dashboard/settings) · SMS Notifications (/dashboard/sms)

How key multi-step workflows work, when asked "how do I...":
- Bank reconciliation: go to Accounting → Bank Reconciliation, pick a bank or paybill account, import a statement (CSV/Excel). Select one or more bank transactions and one or more book (journal) entries on each side, then match them — many-to-one and one-to-many splits are supported as long as the selected sums agree. Mid-way through, "Save as Draft" preserves your selections so you can resume later. Past imports and what each line matched to are under Bank Reconciliation → history.
- Accounts Payable: go to Accounting → Accounts Payable and use "Record Payable" to log a vendor invoice/bill; it flows into the payables ledger and can later be paid via Payments.
- Expense/requisition approval flow: an employee submits a request under Expenses → Expenses, it routes to their approver under Approvals, and once approved it's settled via Expenses → Payments (bank transfer, paybill, cash, or Paystack).
`.trim();

async function isAdmin(userId: string) {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { role: true, customRole: { select: { isSystem: true } } },
    });
    return user?.role === 'SYSTEM_ADMIN' || !!user?.customRole?.isSystem;
}

async function glBalance(accountId: string) {
    const agg = await prisma.journalLine.aggregate({
        where: { accountId, entry: { status: 'POSTED' } },
        _sum: { debit: true, credit: true },
    });
    return (agg._sum.debit || 0) - (agg._sum.credit || 0);
}

const TOOLS = [
    {
        type: 'function',
        function: {
            name: 'getFinancialOverview',
            description: 'High-level snapshot: total cash & bank balance, pending payments, overdue invoices, unmatched bank transactions.',
            parameters: { type: 'object', properties: {} },
        },
    },
    {
        type: 'function',
        function: {
            name: 'listBankAndPaybillAccounts',
            description: 'List every bank and paybill account with its current GL balance.',
            parameters: { type: 'object', properties: {} },
        },
    },
    {
        type: 'function',
        function: {
            name: 'listPendingPayments',
            description: 'Payments awaiting authorization or disbursement (maker-checker queue).',
            parameters: {
                type: 'object',
                properties: { limit: { type: 'number', description: `Max rows, default 20, capped at ${MAX_ROWS}` } },
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'listOverdueInvoices',
            description: 'Vendor invoices that are past their due date and not yet fully paid.',
            parameters: {
                type: 'object',
                properties: { limit: { type: 'number', description: `Max rows, default 20, capped at ${MAX_ROWS}` } },
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'searchRequisitions',
            description: 'Search requisitions by status and/or a text match on the title.',
            parameters: {
                type: 'object',
                properties: {
                    status: { type: 'string', description: 'e.g. APPROVED, PENDING_APPROVAL, CLOSED' },
                    query: { type: 'string', description: 'Text to search for in the title' },
                    limit: { type: 'number' },
                },
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'searchExpenses',
            description: 'Search expense claims by status and/or a text match on the title.',
            parameters: {
                type: 'object',
                properties: {
                    status: { type: 'string', description: 'e.g. APPROVED, PAID, PENDING' },
                    query: { type: 'string' },
                    limit: { type: 'number' },
                },
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'listExpenseCategories',
            description: 'Spend breakdown by expense category — total amount and number of claims per category, across requisitions and expense claims, sorted by total spend descending.',
            parameters: {
                type: 'object',
                properties: { limit: { type: 'number', description: `Max categories, default 15, capped at ${MAX_ROWS}` } },
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'getVendorInfo',
            description: 'Look up a vendor by name — contact details and total outstanding (unpaid) invoice amount.',
            parameters: {
                type: 'object',
                properties: { name: { type: 'string', description: 'Vendor name, partial match is fine' } },
                required: ['name'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'getReconciliationStatus',
            description: 'Unmatched bank-transaction and book-entry counts/totals for a specific bank or paybill account.',
            parameters: {
                type: 'object',
                properties: { accountName: { type: 'string', description: 'Bank or paybill account name, partial match is fine' } },
                required: ['accountName'],
            },
        },
    },
];

async function runTool(name: string, args: any): Promise<unknown> {
    const limit = (v: unknown, fallback = 20) => Math.max(1, Math.min(Number(v) || fallback, MAX_ROWS));

    switch (name) {
        case 'getFinancialOverview': {
            const [banks, paybills, pendingPayments, overdueInvoices, unmatchedCount] = await Promise.all([
                prisma.bankAccount.findMany({ where: { isActive: true }, select: { glAccountId: true } }),
                prisma.paybillAccount.findMany({ where: { isActive: true }, select: { glAccountId: true } }),
                prisma.payment.aggregate({
                    where: { status: { in: ['PENDING_AUTHORIZATION', 'AUTHORIZED'] } },
                    _sum: { amount: true }, _count: true,
                }),
                prisma.invoice.aggregate({
                    where: { status: { not: 'PAID' }, dueDate: { lt: new Date() } },
                    _sum: { amount: true }, _count: true,
                }),
                prisma.bankStatementLine.count({ where: { isMatched: false } }),
            ]);
            const balances = await Promise.all([...banks, ...paybills].map(a => glBalance(a.glAccountId)));
            return {
                totalCashAndBankBalance: balances.reduce((s, b) => s + b, 0),
                pendingPayments: { count: pendingPayments._count, totalAmount: pendingPayments._sum.amount || 0 },
                overdueInvoices: { count: overdueInvoices._count, totalAmount: overdueInvoices._sum.amount || 0 },
                unmatchedBankTransactions: unmatchedCount,
                currency: 'KES',
            };
        }

        case 'listBankAndPaybillAccounts': {
            const [banks, paybills] = await Promise.all([
                prisma.bankAccount.findMany({ select: { name: true, bankName: true, currency: true, isActive: true, glAccountId: true } }),
                prisma.paybillAccount.findMany({ select: { name: true, paybillNumber: true, isActive: true, glAccountId: true } }),
            ]);
            const bankRows = await Promise.all(banks.map(async b => ({
                type: 'BANK', name: b.name, bank: b.bankName, currency: b.currency, active: b.isActive, balance: await glBalance(b.glAccountId),
            })));
            const paybillRows = await Promise.all(paybills.map(async p => ({
                type: 'PAYBILL', name: p.name, paybillNumber: p.paybillNumber, active: p.isActive, balance: await glBalance(p.glAccountId),
            })));
            return [...bankRows, ...paybillRows];
        }

        case 'listPendingPayments': {
            const rows = await prisma.payment.findMany({
                where: { status: { in: ['PENDING_AUTHORIZATION', 'AUTHORIZED'] } },
                take: limit(args?.limit),
                orderBy: { createdAt: 'desc' },
                include: {
                    maker: { select: { name: true } },
                    _count: { select: { invoices: true, expenses: true, requisitions: true } },
                },
            });
            return rows.map(p => ({
                reference: p.reference, amount: p.amount, currency: p.currency, status: p.status,
                maker: p.maker?.name || null,
                itemCount: (p._count.invoices || 0) + (p._count.expenses || 0) + (p._count.requisitions || 0),
                createdAt: p.createdAt,
            }));
        }

        case 'listOverdueInvoices': {
            const rows = await prisma.invoice.findMany({
                where: { status: { not: 'PAID' }, dueDate: { lt: new Date() } },
                take: limit(args?.limit),
                orderBy: { dueDate: 'asc' },
                include: { vendor: { select: { name: true } } },
            });
            return rows.map(i => ({
                invoiceNumber: i.invoiceNumber, vendor: i.vendor?.name || null,
                amount: i.amount, currency: i.currency, dueDate: i.dueDate, status: i.status,
            }));
        }

        case 'searchRequisitions': {
            const where: any = {};
            if (args?.status) where.status = { equals: String(args.status).toUpperCase() };
            if (args?.query) where.title = { contains: String(args.query), mode: 'insensitive' };
            const rows = await prisma.requisition.findMany({
                where, take: limit(args?.limit), orderBy: { updatedAt: 'desc' },
                include: { user: { select: { name: true } } },
            });
            return rows.map(r => ({
                title: r.title, amount: r.amount, currency: r.currency, status: r.status,
                requestedBy: r.user?.name || null, updatedAt: r.updatedAt,
            }));
        }

        case 'searchExpenses': {
            const where: any = {};
            if (args?.status) where.status = { equals: String(args.status).toUpperCase() };
            if (args?.query) where.title = { contains: String(args.query), mode: 'insensitive' };
            const rows = await prisma.expense.findMany({
                where, take: limit(args?.limit), orderBy: { updatedAt: 'desc' },
                include: { user: { select: { name: true } } },
            });
            return rows.map(e => ({
                title: e.title, amount: e.amount, currency: e.currency, status: e.status,
                submittedBy: e.user?.name || null, updatedAt: e.updatedAt,
            }));
        }

        case 'listExpenseCategories': {
            const [reqCats, expCats] = await Promise.all([
                prisma.requisition.groupBy({ by: ['category'], _sum: { amount: true }, _count: true }),
                prisma.expense.groupBy({ by: ['category'], _sum: { amount: true }, _count: true }),
            ]);
            const totals = new Map<string, { totalAmount: number; claimCount: number }>();
            for (const row of [...reqCats, ...expCats]) {
                const existing = totals.get(row.category) || { totalAmount: 0, claimCount: 0 };
                existing.totalAmount += row._sum.amount || 0;
                existing.claimCount += row._count;
                totals.set(row.category, existing);
            }
            return Array.from(totals.entries())
                .map(([category, v]) => ({ category, ...v }))
                .sort((a, b) => b.totalAmount - a.totalAmount)
                .slice(0, limit(args?.limit, 15));
        }

        case 'getVendorInfo': {
            const vendor = await prisma.vendor.findFirst({
                where: { name: { contains: String(args?.name || ''), mode: 'insensitive' } },
                include: { invoices: { where: { status: { not: 'PAID' } }, select: { amount: true } } },
            });
            if (!vendor) return { found: false };
            return {
                found: true, name: vendor.name, email: vendor.email, phone: vendor.phone,
                bankName: vendor.bankName, isActive: vendor.isActive,
                outstandingInvoiceCount: vendor.invoices.length,
                outstandingInvoiceTotal: vendor.invoices.reduce((s, i) => s + Number(i.amount), 0),
            };
        }

        case 'getReconciliationStatus': {
            const name = String(args?.accountName || '');
            const bank = await prisma.bankAccount.findFirst({ where: { name: { contains: name, mode: 'insensitive' } } });
            const paybill = !bank ? await prisma.paybillAccount.findFirst({ where: { name: { contains: name, mode: 'insensitive' } } }) : null;
            const account = bank || paybill;
            if (!account) return { found: false };

            const [unmatchedLines, glLines, matchedEntryIds] = await Promise.all([
                prisma.bankStatementLine.findMany({
                    where: { isMatched: false, statement: { OR: [{ bankAccountId: account.id }, { paybillAccountId: account.id }] } },
                }),
                prisma.journalLine.findMany({ where: { accountId: account.glAccountId, entry: { status: 'POSTED' } } }),
                prisma.reconciliationMatch.findMany({ select: { journalEntryId: true } }),
            ]);
            const matchedSet = new Set(matchedEntryIds.map(m => m.journalEntryId));
            const unmatchedGl = glLines.filter(l => !matchedSet.has(l.entryId));

            return {
                found: true,
                name: account.name,
                unmatchedBankTransactionCount: unmatchedLines.length,
                unmatchedBankTransactionTotal: unmatchedLines.reduce((s, l) => s + (Number(l.credit) - Number(l.debit)), 0),
                unmatchedBookEntryCount: unmatchedGl.length,
            };
        }

        default:
            return { error: `Unknown tool: ${name}` };
    }
}

export async function POST(req: Request) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!(await isAdmin(session.user.id))) {
        return NextResponse.json({ error: 'Nuri is currently available to System Admins only' }, { status: 403 });
    }

    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) return NextResponse.json({ error: 'Nuri is not configured — missing DEEPSEEK_API_KEY' }, { status: 500 });

    const body = await req.json().catch(() => ({}));
    const history = Array.isArray(body.messages)
        ? body.messages
            .filter((m: any) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
            .map((m: any) => ({ role: m.role, content: m.content }))
        : [];

    if (history.length === 0) {
        return NextResponse.json({ error: 'messages[] is required' }, { status: 400 });
    }

    const messages: any[] = [
        {
            role: 'system',
            content:
                "You are Nuri, the AI assistant built into Pesanest, a finance and accounting platform. " +
                "Answer questions about the company's live financial data using the tools provided — never guess or " +
                "invent numbers. If a question needs data you have no tool for, say so plainly rather than making " +
                "something up. Be concise, format amounts as KES with thousands separators, and cite specific figures " +
                "from tool results rather than vague summaries.\n\n" +
                "Separately, you also know your way around the app itself. When someone asks where something is or how " +
                "to do something (e.g. \"where is bank reconciliation\", \"how do I record a payable\"), answer directly " +
                "from the navigation map below — that's not a data question, so answer it from memory, don't call a tool " +
                "or say you can't help.\n\n" + NAVIGATION_GUIDE,
        },
        ...history,
    ];

    for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
        let res: Response;
        try {
            res = await fetch(DEEPSEEK_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
                body: JSON.stringify({ model: 'deepseek-chat', messages, tools: TOOLS, tool_choice: 'auto', temperature: 0.2 }),
            });
        } catch (err: any) {
            return NextResponse.json({ error: `Could not reach the AI service: ${err.message}` }, { status: 502 });
        }

        if (!res.ok) {
            const text = await res.text().catch(() => '');
            return NextResponse.json({ error: `AI request failed (${res.status}): ${text.slice(0, 300)}` }, { status: 502 });
        }

        const data = await res.json();
        const message = data.choices?.[0]?.message;
        if (!message) return NextResponse.json({ error: 'No response from AI' }, { status: 502 });

        if (Array.isArray(message.tool_calls) && message.tool_calls.length > 0) {
            messages.push(message);
            for (const call of message.tool_calls) {
                let args: any = {};
                try { args = JSON.parse(call.function?.arguments || '{}'); } catch { /* malformed args — run with defaults */ }
                const result = await runTool(call.function?.name, args);
                messages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(result) });
            }
            continue;
        }

        return NextResponse.json({ reply: message.content || "I couldn't come up with an answer to that." });
    }

    return NextResponse.json({ error: 'That took too many steps to answer — try a narrower question' }, { status: 504 });
}
