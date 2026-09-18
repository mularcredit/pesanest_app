import prisma from "@/lib/prisma";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { AccountingActions } from "@/components/accounting/AccountingActions";
import { LedgerExportButton } from "@/components/accounting/LedgerExportButton";
import { LedgerAccountSelect } from "./LedgerAccountSelect";
import { LedgerEntryList } from "./LedgerEntryList";
import { LedgerPagination } from "./LedgerPagination";
import { PiBookOpenText, PiTrash } from "react-icons/pi";

const HAIRLINE = '1px solid rgba(0,0,0,0.07)';

function fmt(n: number) {
    return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

export default async function GeneralLedgerPage({
    searchParams,
}: {
    searchParams: Promise<{ p?: string; q?: string; code?: string }>;
}) {
    const session = await auth();
    if (!session?.user) return redirect("/login");

    const params      = await searchParams;
    const page        = parseInt(params.p || "1");
    const search      = params.q || "";
    const selectedCode = params.code || "";
    const pageSize    = 20;

    const allAccountsRaw = await prisma.account.findMany({
        where: { isActive: true },
        orderBy: { code: 'asc' },
        include: {
            bankAccount: { select: { bankName: true } },
            paystackAccount: { select: { name: true } },
            paybillAccount: { select: { name: true } },
        },
    });
    // Same everyday-name enrichment as /api/accounting/accounts — the GL name
    // alone (e.g. "Bank — Figbloom") doesn't match what people search for
    // (e.g. "Equity Bank"), which is shown elsewhere like Bank Reconciliation.
    const allAccounts = allAccountsRaw.map(({ bankAccount, paystackAccount, paybillAccount, ...acc }) => ({
        ...acc,
        bankLabel: bankAccount?.bankName ?? paystackAccount?.name ?? paybillAccount?.name ?? null,
    }));

    // Voided entries and their reversals are real, permanent parts of the
    // ledger (balances everywhere still depend on counting both — see the
    // POSTED+VOID convention used throughout the reports), but they're just
    // noise for someone scanning day-to-day activity. They live in Trash
    // instead; this is a display filter only; it changes nothing about how
    // any balance is calculated.
    const whereClause: any = { status: { not: 'VOID' }, reversalOfId: null };
    const orConditions: any[] = [];

    if (search) {
        orConditions.push({ description: { contains: search, mode: 'insensitive' } });
        orConditions.push({ reference:   { contains: search, mode: 'insensitive' } });
        orConditions.push({ lines: { some: { account: { code: { contains: search, mode: 'insensitive' } } } } });
    }
    if (selectedCode) {
        orConditions.push({ lines: { some: { account: { code: selectedCode } } } });
    }
    if (orConditions.length > 0) whereClause.OR = orConditions;

    const [entries, totalCount, trashCount] = await Promise.all([
        (prisma as any).journalEntry.findMany({
            where: whereClause,
            skip: (page - 1) * pageSize,
            take: pageSize,
            orderBy: { date: 'desc' },
            include: { lines: { include: { account: true } } },
        }),
        (prisma as any).journalEntry.count({ where: whereClause }),
        (prisma as any).journalEntry.count({ where: { OR: [{ status: 'VOID' }, { reversalOfId: { not: null } }] } }),
    ]);

    const totalPages = Math.ceil(totalCount / pageSize);
    const showing    = { from: (page - 1) * pageSize + 1, to: Math.min(page * pageSize, totalCount) };

    // Aggregate totals across current page
    const pageTotalDr = entries.reduce((s: number, e: any) =>
        s + e.lines.reduce((ls: number, l: any) => ls + l.debit, 0), 0);
    const pageTotalCr = entries.reduce((s: number, e: any) =>
        s + e.lines.reduce((ls: number, l: any) => ls + l.credit, 0), 0);

    const pageUrl = (p: number) =>
        `?p=${p}${search ? `&q=${encodeURIComponent(search)}` : ''}${selectedCode ? `&code=${selectedCode}` : ''}`;

    return (
        <div className="pb-20 space-y-5">

            {/* ── Header ── */}
            <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <div className="w-[30px] h-[30px] rounded-[7px] bg-[#6366F1] flex items-center justify-center shrink-0">
                            <PiBookOpenText className="text-white text-[15px]" />
                        </div>
                        <h1 className="text-[19px] font-[600] text-gray-900 tracking-tight">General Ledger</h1>
                    </div>
                    <p className="text-[12px] text-gray-400 pl-[38px]">
                        {totalCount} entr{totalCount === 1 ? 'y' : 'ies'} · voided entries and reversals are in Trash
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Link href="/dashboard/accounting/ledger/trash"
                        className="flex items-center gap-1.5 px-3.5 py-2 rounded-[8px] text-[12.5px] font-[500] text-gray-500 hover:bg-gray-50 transition-colors"
                        style={{ border: HAIRLINE }}>
                        <PiTrash className="text-[14px]" /> Trash
                        {trashCount > 0 && (
                            <span className="text-[10.5px] font-[600] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500">{trashCount}</span>
                        )}
                    </Link>
                    <LedgerExportButton />
                    <AccountingActions type="MANUAL_JOURNAL" />
                </div>
            </div>

            {/* ── KPI strip ── */}
            <div className="grid grid-cols-3 gap-3">
                <div className="bg-white rounded-[8px] px-5 py-4" style={{ border: HAIRLINE }}>
                    <p className="text-[10px] font-[600] uppercase tracking-[0.09em] text-gray-400 mb-2">Total Entries</p>
                    <p className="text-[20px] font-[700] text-gray-900 tabular-nums leading-none">{totalCount.toLocaleString()}</p>
                    <p className="text-[10.5px] text-gray-400 mt-1">journal entries</p>
                </div>
                <div className="bg-white rounded-[8px] px-5 py-4" style={{ border: HAIRLINE }}>
                    <p className="text-[10px] font-[600] uppercase tracking-[0.09em] text-rose-500 mb-2">Page Debits</p>
                    <p className="text-[20px] font-[700] font-mono tabular-nums leading-none text-gray-900">{fmt(pageTotalDr)}</p>
                    <p className="text-[10.5px] text-gray-400 mt-1">KES · this page</p>
                </div>
                <div className="bg-white rounded-[8px] px-5 py-4" style={{ border: HAIRLINE }}>
                    <p className="text-[10px] font-[600] uppercase tracking-[0.09em] text-emerald-600 mb-2">Page Credits</p>
                    <p className="text-[20px] font-[700] font-mono tabular-nums leading-none text-gray-900">{fmt(pageTotalCr)}</p>
                    <p className="text-[10.5px] text-gray-400 mt-1">KES · this page</p>
                </div>
            </div>

            {/* ── Filter bar ── */}
            <form className="bg-white rounded-[8px] flex items-center gap-0 overflow-hidden" style={{ border: HAIRLINE }}>
                {/* Search */}
                <div className="flex items-center gap-2 flex-1 px-4 py-2.5">
                    <input
                        name="q"
                        defaultValue={search}
                        type="text"
                        placeholder="Search reference, description or account code…"
                        className="flex-1 text-[12.5px] text-gray-700 placeholder:text-gray-400 outline-none bg-transparent"
                    />
                </div>

                {/* Divider */}
                <div className="w-px h-8 shrink-0" style={{ background: 'rgba(0,0,0,0.07)' }} />

                {/* Account filter */}
                <LedgerAccountSelect accounts={allAccounts} defaultValue={selectedCode} />

                {/* Divider */}
                <div className="w-px h-8 shrink-0" style={{ background: 'rgba(0,0,0,0.07)' }} />

                {/* Submit */}
                <button
                    type="submit"
                    className="px-5 py-2.5 text-[12.5px] font-[600] text-[#6366F1] hover:bg-indigo-50 transition-colors"
                >
                    Filter
                </button>
            </form>

            {/* ── Entry list ── */}
            <LedgerEntryList
                entries={entries}
                emptyTitle={search || selectedCode ? 'No entries match your filter' : 'No journal entries yet'}
                emptySubtitle={search || selectedCode ? 'Try a different search or clear the filter.' : 'Post a journal entry to get started.'}
            />

            {/* ── Pagination ── */}
            <LedgerPagination page={page} totalPages={totalPages} totalCount={totalCount} showing={showing} pageUrl={pageUrl} />
        </div>
    );
}
