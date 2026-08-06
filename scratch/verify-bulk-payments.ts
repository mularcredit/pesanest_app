/**
 * Verifies the extracted payment state machine and bulk sequencing.
 *
 * Deliberately exercises only the non-gateway actions (AUTHORIZE / REJECT /
 * CLOSE guards) — DISBURSE would hit Paystack and move real money.
 * Creates its own throwaway payments and deletes them in a finally block.
 *   node_modules/.bin/tsx scratch/verify-bulk-payments.ts
 */

import prisma from "../src/lib/prisma";
import { processPaymentAction } from "../src/lib/payments/process-payment-action";

const TAG = "__verify_bulk__";
let failures = 0;
const madeIds: string[] = [];

function check(label: string, cond: boolean, detail = "") {
    console.log(cond ? `  PASS  ${label}` : `  FAIL  ${label} ${detail}`);
    if (!cond) failures++;
}

async function makePayment(makerId: string, status: string, amount = 1000) {
    const p = await (prisma as any).payment.create({
        data: { amount, currency: "KES", status, makerId, notes: TAG },
    });
    madeIds.push(p.id);
    return p;
}

(async () => {
    try {
        const users = await prisma.user.findMany({ select: { id: true, name: true }, take: 2 });
        if (users.length < 2) { console.log("need 2 users in db"); process.exit(0); }
        const [actor, other] = users;
        console.log(`actor: ${actor.name} | other maker: ${other.name}\n`);

        // ── guard: maker cannot authorise their own payment ──
        const own = await makePayment(actor.id, "PENDING_AUTHORIZATION");
        const ownRes = await processPaymentAction({ paymentId: own.id, action: "AUTHORIZE", userId: actor.id });
        check("maker cannot authorise their own payment", !ownRes.ok && (ownRes as any).status === 403,
            JSON.stringify(ownRes));
        const ownAfter = await (prisma as any).payment.findUnique({ where: { id: own.id } });
        check("rejected attempt leaves status untouched", ownAfter.status === "PENDING_AUTHORIZATION", ownAfter.status);

        // ── happy path: someone else's payment authorises ──
        const theirs = await makePayment(other.id, "PENDING_AUTHORIZATION");
        const okRes = await processPaymentAction({ paymentId: theirs.id, action: "AUTHORIZE", userId: actor.id });
        check("another maker's payment authorises", okRes.ok, JSON.stringify(okRes));
        const theirsAfter = await (prisma as any).payment.findUnique({ where: { id: theirs.id } });
        check("status moves to AUTHORIZED", theirsAfter.status === "AUTHORIZED", theirsAfter.status);
        check("checker is stamped", theirsAfter.checkerId === actor.id);
        check("authorizedAt is set", !!theirsAfter.authorizedAt);

        // ── guard: cannot re-authorise ──
        const twice = await processPaymentAction({ paymentId: theirs.id, action: "AUTHORIZE", userId: actor.id });
        check("cannot authorise twice", !twice.ok, JSON.stringify(twice));

        // ── guard: cannot close something that was never paid ──
        const closeEarly = await processPaymentAction({ paymentId: theirs.id, action: "CLOSE", userId: actor.id });
        check("cannot close before disbursement", !closeEarly.ok && (closeEarly as any).status === 400);

        // ── guard: cannot disburse a pending payment ──
        const pend = await makePayment(other.id, "PENDING_AUTHORIZATION");
        const disbEarly = await processPaymentAction({ paymentId: pend.id, action: "DISBURSE", userId: actor.id, paymentMethod: "CASH" });
        check("cannot disburse before authorisation", !disbEarly.ok && (disbEarly as any).status === 400);

        // ── unknown payment ──
        const missing = await processPaymentAction({ paymentId: "does-not-exist", action: "AUTHORIZE", userId: actor.id });
        check("unknown payment is a clean 404", !missing.ok && (missing as any).status === 404);

        // ── CLOSE works once PAID ──
        const paid = await makePayment(other.id, "PAID");
        const closeRes = await processPaymentAction({ paymentId: paid.id, action: "CLOSE", userId: actor.id });
        check("a PAID payment closes", closeRes.ok, JSON.stringify(closeRes));
        const paidAfter = await (prisma as any).payment.findUnique({ where: { id: paid.id } });
        check("status moves to CLOSED", paidAfter.status === "CLOSED", paidAfter.status);

        // ── bulk: mixed batch, one failure must not abort the rest ──
        const a = await makePayment(other.id, "PENDING_AUTHORIZATION", 500);
        const mine = await makePayment(actor.id, "PENDING_AUTHORIZATION", 700); // will fail: own payment
        const c = await makePayment(other.id, "PENDING_AUTHORIZATION", 900);

        const ids = [a.id, mine.id, c.id];
        const results: { id: string; ok: boolean }[] = [];
        for (const id of ids) {
            const r = await processPaymentAction({ paymentId: id, action: "AUTHORIZE", userId: actor.id });
            results.push({ id, ok: r.ok });
        }

        check("bulk attempted every payment", results.length === 3);
        check("the two valid ones succeeded",
            results.filter(r => r.ok).length === 2, JSON.stringify(results));
        check("the maker's own one failed", results.find(r => r.id === mine.id)?.ok === false);
        check("a failure did not stop later payments", results[2].ok === true);

        const states = await (prisma as any).payment.findMany({
            where: { id: { in: ids } }, select: { id: true, status: true },
        });
        const byId = new Map(states.map((s: any) => [s.id, s.status]));
        check("first is AUTHORIZED", byId.get(a.id) === "AUTHORIZED", String(byId.get(a.id)));
        check("own one stays PENDING_AUTHORIZATION", byId.get(mine.id) === "PENDING_AUTHORIZATION", String(byId.get(mine.id)));
        check("third is AUTHORIZED", byId.get(c.id) === "AUTHORIZED", String(byId.get(c.id)));

        // ── REJECT detaches items so they return to the payables queue ──
        const rej = await makePayment(other.id, "PENDING_AUTHORIZATION");
        const rejRes = await processPaymentAction({ paymentId: rej.id, action: "REJECT", userId: actor.id });
        check("reject succeeds", rejRes.ok);
        const rejAfter = await (prisma as any).payment.findUnique({ where: { id: rej.id } });
        check("status moves to REJECTED", rejAfter.status === "REJECTED", rejAfter.status);
        const stillLinked = await (prisma as any).requisition.count({ where: { paymentId: rej.id } });
        check("no items left attached after reject", stillLinked === 0, `found ${stillLinked}`);

    } catch (e: any) {
        console.log(`  FAIL  unexpected error: ${e?.message}`);
        failures++;
    } finally {
        if (madeIds.length) {
            await (prisma as any).requisition.updateMany({ where: { paymentId: { in: madeIds } }, data: { paymentId: null } }).catch(() => {});
            await prisma.expense.updateMany({ where: { paymentId: { in: madeIds } }, data: { paymentId: null } }).catch(() => {});
            await prisma.invoice.updateMany({ where: { paymentId: { in: madeIds } }, data: { paymentId: null } }).catch(() => {});
            await (prisma as any).payment.deleteMany({ where: { id: { in: madeIds } } });
        }
        const leaked = await (prisma as any).payment.count({ where: { notes: TAG } });
        check("no test payments persisted", leaked === 0, `found ${leaked}`);

        console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} CHECK(S) FAILED`);
        await prisma.$disconnect();
        process.exit(failures === 0 ? 0 : 1);
    }
})();
