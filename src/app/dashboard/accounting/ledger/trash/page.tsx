import prisma from "@/lib/prisma";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { LedgerAccountSelect } from "../LedgerAccountSelect";
import { LedgerEntryList } from "../LedgerEntryList";
import { LedgerPagination } from "../LedgerPagination";
import { PiTrash, PiArrowLeft } from "react-icons/pi";

const HAIRLINE = '1px solid rgba(0,0,0,0.07)';

export default async function LedgerTrashPage({
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
    const allAccounts = allAccountsRaw.map(({ bankAccount, paystackAccount, paybillAccount, ...acc }) => ({
        ...acc,
        bankLabel: bankAccount?.bankName ?? paystackAccount?.name ?? paybillAccount?.name ?? null,
    }));

    // Trash = voided entries themselves, plus every reversal entry (the
    // correcting postings). This is a display filter only — it doesn't
    // change how any balance is computed; every report still counts both,
    // exactly as before.
    const trashCondition = { OR: [{ status: 'VOID' }, { reversalOfId: { not: null } }] };
    const orConditions: any[] = [];

    if (search) {
        orConditions.push({ description: { contains: search, mode: 'insensitive' } });
        orConditions.push({ reference:   { contains: search, mode: 'insensitive' } });
        orConditions.push({ lines: { some: { account: { code: { contains: search, mode: 'insensitive' } } } } });
    }
    if (selectedCode) {
        orConditions.push({ lines: { some: { account: { code: selectedCode } } } });
    }
    const whereClause: any = orConditions.length > 0
        ? { AND: [trashCondition, { OR: orConditions }] }
        : trashCondition;

    const [entries, totalCount] = await Promise.all([
        (prisma as any).journalEntry.findMany({
            where: whereClause,
            skip: (page - 1) * pageSize,
            take: pageSize,
            orderBy: { date: 'desc' },
            include: { lines: { include: { account: true } } },
        }),
        (prisma as any).journalEntry.count({ where: whereClause }),
    ]);

    const totalPages = Math.ceil(totalCount / pageSize);
    const showing    = { from: (page - 1) * pageSize + 1, to: Math.min(page * pageSize, totalCount) };

    const pageUrl = (p: number) =>
        `?p=${p}${search ? `&q=${encodeURIComponent(search)}` : ''}${selectedCode ? `&code=${selectedCode}` : ''}`;

    return (
        <div className="pb-20 space-y-5">

            {/* ── Header ── */}
            <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                    <Link href="/dashboard/accounting/ledger"
                        className="flex items-center gap-1 text-[11.5px] font-[500] text-gray-400 hover:text-[#6366F1] transition-colors mb-2">
                        <PiArrowLeft className="text-[12px]" /> Back to General Ledger
                    </Link>
                    <div className="flex items-center gap-2 mb-1">
                        <div className="w-[30px] h-[30px] rounded-[7px] bg-gray-400 flex items-center justify-center shrink-0">
                            <PiTrash className="text-white text-[15px]" />
                        </div>
                        <h1 className="text-[19px] font-[600] text-gray-900 tracking-tight">Trash</h1>
                    </div>
                    <p className="text-[12px] text-gray-400 pl-[38px]">
                        {totalCount} entr{totalCount === 1 ? 'y' : 'ies'} · voided originals and their reversals, kept for audit — view only
                    </p>
                </div>
            </div>

            <div className="flex items-start gap-2.5 px-4 py-3 bg-amber-50 border border-amber-200 rounded-[8px] text-[12px] text-amber-800">
                These entries still count in every balance and report exactly as before — moving them here only
                hides them from the day-to-day General Ledger view. Nothing here can be edited or re-voided.
            </div>

            {/* ── Filter bar ── */}
            <form className="bg-white rounded-[8px] flex items-center gap-0 overflow-hidden" style={{ border: HAIRLINE }}>
                <div className="flex items-center gap-2 flex-1 px-4 py-2.5">
                    <input
                        name="q"
                        defaultValue={search}
                        type="text"
                        placeholder="Search reference, description or account code…"
                        className="flex-1 text-[12.5px] text-gray-700 placeholder:text-gray-400 outline-none bg-transparent"
                    />
                </div>
                <div className="w-px h-8 shrink-0" style={{ background: 'rgba(0,0,0,0.07)' }} />
                <LedgerAccountSelect accounts={allAccounts} defaultValue={selectedCode} />
                <div className="w-px h-8 shrink-0" style={{ background: 'rgba(0,0,0,0.07)' }} />
                <button type="submit" className="px-5 py-2.5 text-[12.5px] font-[600] text-[#6366F1] hover:bg-indigo-50 transition-colors">
                    Filter
                </button>
            </form>

            {/* ── Entry list ── */}
            <LedgerEntryList
                entries={entries}
                readOnly
                emptyTitle={search || selectedCode ? 'No trashed entries match your filter' : 'Trash is empty'}
                emptySubtitle={search || selectedCode ? 'Try a different search or clear the filter.' : 'Voided entries and their reversals will show up here.'}
            />

            {/* ── Pagination ── */}
            <LedgerPagination page={page} totalPages={totalPages} totalCount={totalCount} showing={showing} pageUrl={pageUrl} />
        </div>
    );
}
