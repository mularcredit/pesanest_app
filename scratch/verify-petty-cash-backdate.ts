/**
 * Verifies backdated petty cash replenishment: the ledger row and its journal
 * entry both carry the chosen date, createdAt stays honest, closed periods are
 * refused, and future dates are rejected. Rolled back.
 *   node_modules/.bin/tsx scratch/verify-petty-cash-backdate.ts
 */

import prisma from "../src/lib/prisma";
import { postPettyCashReplenish, assertPostingAllowed } from "../src/lib/accounting/cash-movement-gl";

const ROLLBACK = "__rollback__";
let failures = 0;

function check(label: string, cond: boolean, detail = "") {
    console.log(cond ? `  PASS  ${label}` : `  FAIL  ${label} ${detail}`);
    if (!cond) failures++;
}

// Mirrors parseMovementDate in the action.
function parseMovementDate(raw: string | null): { date: Date } | { error: string } {
    if (!raw || !raw.trim()) return { date: new Date() };
    const m = raw.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return { error: "Enter the date as YYYY-MM-DD" };
    const date = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0, 0);
    if (Number.isNaN(date.getTime()) || date.getMonth() !== Number(m[2]) - 1) return { error: "That date doesn't exist" };
    const end = new Date(); end.setHours(23, 59, 59, 999);
    if (date > end) return { error: "The date can't be in the future" };
    if (date.getFullYear() < 2000) return { error: "That date is too far in the past" };
    return { date };
}

(async () => {
    // ── input validation ──
    const future = new Date(Date.now() + 3 * 86400000);
    const futureIso = `${future.getFullYear()}-${String(future.getMonth() + 1).padStart(2, "0")}-${String(future.getDate()).padStart(2, "0")}`;
    check("future date rejected", "error" in parseMovementDate(futureIso));
    check("nonsense date rejected", "error" in parseMovementDate("12/03/2026"));
    check("impossible date rejected", "error" in parseMovementDate("2026-02-31"));
    check("pre-2000 date rejected", "error" in parseMovementDate("1995-06-01"));
    check("blank falls back to today", "date" in parseMovementDate(""));
    const good = parseMovementDate("2026-03-14");
    check("valid backdate accepted", "date" in good);
    if ("date" in good) {
        check("parsed at local noon, so no UTC day-shift",
            good.date.getHours() === 12 && good.date.getDate() === 14 && good.date.getMonth() === 2,
            good.date.toString());
    }

    const backdate = new Date(2026, 2, 14, 12, 0, 0, 0); // 14 Mar 2026

    try {
        await prisma.$transaction(async (tx: any) => {
            const wallet = await tx.pettyCashWallet.findFirst({ where: { isActive: true } });
            if (!wallet) throw new Error("no petty cash wallet — run the app once first");

            const before = Number(wallet.balance);
            const amount = 2500;

            await assertPostingAllowed(tx, backdate);

            const entry = await postPettyCashReplenish(tx, {
                amount,
                pettyCashGlAccountId: wallet.glAccountId,
                fundingGlAccountId: null,
                userId: undefined,
                reference: "PCV-VERIFY",
                description: "__verify_backdate__",
                date: backdate,
            });

            const je = await tx.journalEntry.findUnique({
                where: { id: entry.id },
                include: { lines: true },
            });
            check("journal entry carries the backdated date",
                je.date.getFullYear() === 2026 && je.date.getMonth() === 2 && je.date.getDate() === 14,
                je.date.toISOString());
            check("journal entry balances",
                Math.abs(je.lines.reduce((s: number, l: any) => s + Number(l.debit), 0) -
                         je.lines.reduce((s: number, l: any) => s + Number(l.credit), 0)) < 0.01);
            check("petty cash is debited",
                je.lines.some((l: any) => l.accountId === wallet.glAccountId && Number(l.debit) === amount));

            const updated = await tx.pettyCashWallet.update({
                where: { id: wallet.id },
                data: { balance: { increment: amount } },
            });

            const row = await tx.pettyCashTransaction.create({
                data: {
                    walletId: wallet.id,
                    type: "REPLENISH",
                    amount,
                    balanceAfter: updated.balance,
                    description: "__verify_backdate__",
                    voucherNumber: "PCV-VERIFY",
                    journalEntryId: entry.id,
                    occurredAt: backdate,
                },
            });

            check("ledger row stores the backdated movement date",
                row.occurredAt.getDate() === 14 && row.occurredAt.getMonth() === 2);
            check("createdAt stays today — audit trail intact",
                row.createdAt.toDateString() === new Date().toDateString(),
                row.createdAt.toISOString());
            check("occurredAt is before createdAt, so the row flags as backdated",
                row.occurredAt < row.createdAt);
            check("float still increased by the full amount",
                Math.abs(Number(updated.balance) - (before + amount)) < 0.01);

            // ── closed period is refused ──
            const fy = await tx.fiscalYear.create({
                data: { name: "__verify_fy__", startDate: new Date(2026, 0, 1), endDate: new Date(2026, 11, 31), isClosed: false },
            });
            await tx.accountingPeriod.create({
                data: {
                    fiscalYearId: fy.id, name: "__verify_closed_march__", periodType: "MONTH",
                    startDate: new Date(2026, 2, 1), endDate: new Date(2026, 2, 31), isClosed: true,
                },
            });
            let blocked = false, msg = "";
            try { await assertPostingAllowed(tx, backdate); } catch (e: any) { blocked = true; msg = e.message; }
            check("backdating into a closed period is refused", blocked, msg);
            check("and the error names the period", msg.includes("__verify_closed_march__"), msg);

            // an open date in the same year is still fine
            let openOk = true;
            try { await assertPostingAllowed(tx, new Date(2026, 5, 10, 12)); } catch { openOk = false; }
            check("a date in an open period still posts", openOk);

            throw new Error(ROLLBACK);
        }, { timeout: 120000 });
    } catch (e: any) {
        if (e?.message !== ROLLBACK) {
            console.log(`  FAIL  unexpected error: ${e?.message}`);
            failures++;
        }
    }

    const leaked = await prisma.pettyCashTransaction.count({ where: { description: "__verify_backdate__" } });
    const leakedFy = await prisma.fiscalYear.count({ where: { name: "__verify_fy__" } });
    check("no test ledger rows persisted", leaked === 0, `found ${leaked}`);
    check("no test fiscal year persisted", leakedFy === 0, `found ${leakedFy}`);

    console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} CHECK(S) FAILED`);
    await prisma.$disconnect();
    process.exit(failures === 0 ? 0 : 1);
})();
