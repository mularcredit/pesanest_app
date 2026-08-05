/**
 * Verifies the petty cash + transfer GL helpers against the real database.
 * Everything runs inside a transaction that is deliberately rolled back, so
 * no rows survive. Run with:
 *   node_modules/.bin/tsx scratch/verify-cash-movement.ts
 */

import prisma from "../src/lib/prisma";
import {
    postPettyCashReplenish,
    postPettyCashSpend,
    postPettyCashAdjustment,
    postTransfer,
    resolveTransferLeg,
    GL_CODES,
} from "../src/lib/accounting/cash-movement-gl";

const ROLLBACK = "__rollback__";
const results: string[] = [];
let failures = 0;

function check(label: string, cond: boolean, detail = "") {
    if (cond) results.push(`  PASS  ${label}`);
    else { results.push(`  FAIL  ${label} ${detail}`); failures++; }
}

async function linesOf(tx: any, entryId: string) {
    const lines = await tx.journalLine.findMany({ where: { entryId } });
    const debit = lines.reduce((s: number, l: any) => s + Number(l.debit), 0);
    const credit = lines.reduce((s: number, l: any) => s + Number(l.credit), 0);
    return { lines, debit, credit };
}

async function accountCode(tx: any, id: string) {
    const a = await tx.account.findUnique({ where: { id } });
    return a?.code;
}

(async () => {
    try {
        await prisma.$transaction(async (tx: any) => {
            // ── petty cash: replenish ────────────────────────────────────
            const rep = await postPettyCashReplenish(tx, {
                amount: 10000,
                userId: undefined,
                reference: "TEST-REP-1",
            });
            const r = await linesOf(tx, rep.id);
            check("replenish balances", Math.abs(r.debit - r.credit) < 0.01, `dr=${r.debit} cr=${r.credit}`);
            check("replenish debits 10000", r.debit === 10000, `got ${r.debit}`);
            const repDr = r.lines.find((l: any) => Number(l.debit) > 0);
            check("replenish debits Petty Cash (1010)",
                (await accountCode(tx, repDr.accountId)) === GL_CODES.PETTY_CASH,
                `got ${await accountCode(tx, repDr.accountId)}`);

            // ── petty cash: spend ───────────────────────────────────────
            const spend = await postPettyCashSpend(tx, {
                amount: 1500,
                reference: "TEST-SPD-1",
                description: "Taxi fare",
            });
            const s = await linesOf(tx, spend.id);
            check("spend balances", Math.abs(s.debit - s.credit) < 0.01, `dr=${s.debit} cr=${s.credit}`);
            const spendCr = s.lines.find((l: any) => Number(l.credit) > 0);
            check("spend credits Petty Cash (1010)",
                (await accountCode(tx, spendCr.accountId)) === GL_CODES.PETTY_CASH,
                `got ${await accountCode(tx, spendCr.accountId)}`);

            // ── petty cash: shortage + overage ──────────────────────────
            const short = await postPettyCashAdjustment(tx, {
                delta: -250,
                reference: "TEST-ADJ-1",
                description: "Count shortage",
            });
            const sh = await linesOf(tx, short.id);
            check("shortage balances", Math.abs(sh.debit - sh.credit) < 0.01, `dr=${sh.debit} cr=${sh.credit}`);
            const shDr = sh.lines.find((l: any) => Number(l.debit) > 0);
            check("shortage debits Cash Over & Short (6110)",
                (await accountCode(tx, shDr.accountId)) === GL_CODES.CASH_OVER_SHORT,
                `got ${await accountCode(tx, shDr.accountId)}`);

            const over = await postPettyCashAdjustment(tx, {
                delta: 400,
                reference: "TEST-ADJ-2",
                description: "Count overage",
            });
            const ov = await linesOf(tx, over.id);
            const ovDr = ov.lines.find((l: any) => Number(l.debit) > 0);
            check("overage balances", Math.abs(ov.debit - ov.credit) < 0.01, `dr=${ov.debit} cr=${ov.credit}`);
            check("overage debits Petty Cash (1010)",
                (await accountCode(tx, ovDr.accountId)) === GL_CODES.PETTY_CASH,
                `got ${await accountCode(tx, ovDr.accountId)}`);

            // ── transfer legs resolve ───────────────────────────────────
            const mobile = await resolveTransferLeg(tx, { bankAccountId: null, kind: "MOBILE" });
            check("mobile leg -> 1030", mobile.code === GL_CODES.MOBILE_MONEY, `got ${mobile.code}`);
            const paybill = await resolveTransferLeg(tx, { bankAccountId: null, kind: "PAYBILL" });
            check("paybill leg -> 1040", paybill.code === GL_CODES.PAYBILL_CLEARING, `got ${paybill.code}`);
            const bank = await resolveTransferLeg(tx, { bankAccountId: null, kind: "BANK" });
            check("bank leg fallback -> 1000", bank.code === GL_CODES.CASH_ON_HAND, `got ${bank.code}`);

            // ── transfer with charges ───────────────────────────────────
            const trf = await postTransfer(tx, {
                amount: 50000,
                charges: 120,
                fromAccountId: bank.id,
                toAccountId: mobile.id,
                reference: "TEST-TRF-1",
                description: "Bank to mobile",
            });
            const t = await linesOf(tx, trf.id);
            check("transfer with charges balances", Math.abs(t.debit - t.credit) < 0.01, `dr=${t.debit} cr=${t.credit}`);
            check("transfer debits 50120 total", Math.abs(t.debit - 50120) < 0.01, `got ${t.debit}`);
            check("transfer has 3 lines", t.lines.length === 3, `got ${t.lines.length}`);
            const srcLine = t.lines.find((l: any) => l.accountId === bank.id);
            check("source credited amount + charges",
                Math.abs(Number(srcLine.credit) - 50120) < 0.01, `got ${srcLine?.credit}`);

            // ── transfer without charges ────────────────────────────────
            const trf2 = await postTransfer(tx, {
                amount: 7500,
                fromAccountId: bank.id,
                toAccountId: paybill.id,
                reference: "TEST-TRF-2",
                description: "Bank to paybill",
            });
            const t2 = await linesOf(tx, trf2.id);
            check("transfer without charges balances", Math.abs(t2.debit - t2.credit) < 0.01, `dr=${t2.debit} cr=${t2.credit}`);
            check("transfer without charges has 2 lines", t2.lines.length === 2, `got ${t2.lines.length}`);

            // ── unbalanced posting must be rejected ────────────────────
            let rejected = false;
            try {
                await postTransfer(tx, {
                    amount: NaN,
                    fromAccountId: bank.id,
                    toAccountId: mobile.id,
                    reference: "TEST-TRF-BAD",
                    description: "should throw",
                });
            } catch { rejected = true; }
            check("NaN amount rejected by balance guard", rejected);

            throw new Error(ROLLBACK);
        }, { timeout: 120000 });
    } catch (e: any) {
        if (e?.message !== ROLLBACK) {
            console.error("\nUNEXPECTED ERROR:", e?.message || e);
            failures++;
        }
    }

    console.log("\n── cash movement GL verification ──");
    console.log(results.join("\n"));
    console.log(failures === 0 ? "\nAll checks passed. Transaction rolled back — no rows persisted." : `\n${failures} CHECK(S) FAILED`);

    // Confirm nothing survived the rollback.
    const leaked = await prisma.journalEntry.count({ where: { reference: { startsWith: "TEST-" } } });
    console.log(`Leaked test journal entries: ${leaked}`);

    await prisma.$disconnect();
    process.exit(failures === 0 && leaked === 0 ? 0 : 1);
})();
