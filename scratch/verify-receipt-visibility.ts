/**
 * Proves the receipt-visibility fix against real data, then exercises attach and
 * replace on a throwaway requisition inside a rolled-back transaction.
 *   node_modules/.bin/tsx scratch/verify-receipt-visibility.ts
 */

import prisma from "../src/lib/prisma";

const ROLLBACK = "__rollback__";
let failures = 0;

function check(label: string, cond: boolean, detail = "") {
    console.log(cond ? `  PASS  ${label}` : `  FAIL  ${label} ${detail}`);
    if (!cond) failures++;
}

// The mapping in requisitions/page.tsx, before and after the fix.
const oldMapping = (r: any) => r.expenses?.[0]?.receiptUrl || null;
const newMapping = (r: any) => r.receiptUrl || r.expenses?.[0]?.receiptUrl || null;

(async () => {
    // ── 1. Real data: how many receipts were invisible before the fix? ──
    const all = await prisma.requisition.findMany({
        include: { expenses: { select: { receiptUrl: true } } },
    });

    const hiddenBefore = all.filter(r => !oldMapping(r) && newMapping(r));
    const visibleAfter = all.filter(r => newMapping(r));

    console.log(`\nrequisitions in db: ${all.length}`);
    console.log(`receipts visible with old mapping: ${all.filter(r => oldMapping(r)).length}`);
    console.log(`receipts visible with new mapping: ${visibleAfter.length}`);
    console.log(`previously hidden receipts recovered: ${hiddenBefore.length}`);
    if (hiddenBefore.length) {
        hiddenBefore.slice(0, 5).forEach(r =>
            console.log(`   • "${r.title.slice(0, 46)}" (${r.status})`)
        );
    }
    check("new mapping never loses a receipt the old one found",
        all.every(r => !oldMapping(r) || !!newMapping(r)));

    // ── 2. Attach + replace on a throwaway record, then roll back ──
    const someUser = await prisma.user.findFirst({ select: { id: true } });
    if (!someUser) {
        console.log("  SKIP  no users in db — cannot exercise attach/replace");
    } else {
        try {
            await prisma.$transaction(async (tx: any) => {
                const req = await tx.requisition.create({
                    data: {
                        userId: someUser.id,
                        title: "__verify_receipt_attach__",
                        description: "temporary",
                        amount: 100,
                        category: "Office Supplies",
                        businessJustification: "verification",
                    },
                });
                check("new requisition starts with no receipt", req.receiptUrl === null);
                check("and is invisible under both mappings",
                    newMapping({ ...req, expenses: [] }) === null);

                // attach
                const attached = await tx.requisition.update({
                    where: { id: req.id },
                    data: { receiptUrl: "/api/uploads/receipts/fake-id-1", etrNumber: "ETR123", etrVerified: false },
                });
                check("attach sets receiptUrl", attached.receiptUrl === "/api/uploads/receipts/fake-id-1");
                check("attach stores ETR number", attached.etrNumber === "ETR123");
                check("attached receipt is visible in the list mapping",
                    newMapping({ ...attached, expenses: [] }) === "/api/uploads/receipts/fake-id-1");
                check("old mapping would still have hidden it",
                    oldMapping({ ...attached, expenses: [] }) === null);
                check("attach does not change status", attached.status === req.status,
                    `${req.status} -> ${attached.status}`);

                // replace
                const replaced = await tx.requisition.update({
                    where: { id: req.id },
                    data: { receiptUrl: "/api/uploads/receipts/fake-id-2" },
                });
                check("replace swaps the url", replaced.receiptUrl === "/api/uploads/receipts/fake-id-2");
                check("replace keeps the ETR number", replaced.etrNumber === "ETR123");

                // a fulfilment receipt still wins when nothing is attached directly
                check("fulfilment receipt used as fallback",
                    newMapping({ receiptUrl: null, expenses: [{ receiptUrl: "/from-fulfilment" }] }) === "/from-fulfilment");

                throw new Error(ROLLBACK);
            }, { timeout: 60000 });
        } catch (e: any) {
            if (e?.message !== ROLLBACK) {
                console.log(`  FAIL  unexpected error: ${e?.message}`);
                failures++;
            }
        }
    }

    const leaked = await prisma.requisition.count({ where: { title: "__verify_receipt_attach__" } });
    check("no test rows persisted", leaked === 0, `found ${leaked}`);

    console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} CHECK(S) FAILED`);
    await prisma.$disconnect();
    process.exit(failures === 0 ? 0 : 1);
})();
