/**
 * The petty cash page fires several actions in parallel, each of which will
 * lazily create the float. This drives that path concurrently to prove the
 * unique-constraint race resolves to a single wallet instead of a 500.
 *   node_modules/.bin/tsx scratch/verify-petty-cash-init.ts
 */

import prisma from "../src/lib/prisma";

const PETTY_CASH_CODE = "1010";

// Mirrors getPettyCashWallet() in src/app/dashboard/petty-cash/actions.ts
async function getOrCreateWallet() {
    let wallet = await prisma.pettyCashWallet.findFirst({
        where: { isActive: true },
        orderBy: { createdAt: "asc" },
    });
    if (wallet) return wallet;

    let gl = await prisma.account.findFirst({ where: { code: PETTY_CASH_CODE } });
    if (!gl) {
        gl = await prisma.account.create({
            data: { code: PETTY_CASH_CODE, name: "Petty Cash", type: "ASSET", subtype: "CURRENT_ASSET" },
        });
    }

    try {
        return await prisma.pettyCashWallet.create({
            data: { name: "Petty Cash", glAccountId: gl.id },
        });
    } catch {
        wallet = await prisma.pettyCashWallet.findFirst({
            where: { isActive: true },
            orderBy: { createdAt: "asc" },
        });
        if (!wallet) throw new Error("Could not initialise the petty cash float");
        return wallet;
    }
}

(async () => {
    let failures = 0;
    const before = await prisma.pettyCashWallet.count();
    console.log(`wallets before: ${before}`);

    // Six simultaneous callers, as the page's Promise.all would produce.
    const settled = await Promise.allSettled(Array.from({ length: 6 }, () => getOrCreateWallet()));

    const rejected = settled.filter(s => s.status === "rejected");
    if (rejected.length) {
        failures++;
        console.log(`  FAIL  ${rejected.length}/6 concurrent callers threw`);
        rejected.slice(0, 2).forEach(r => console.log(`        ${(r as PromiseRejectedResult).reason?.message}`));
    } else {
        console.log("  PASS  all 6 concurrent callers resolved");
    }

    const ids = new Set(
        settled.filter(s => s.status === "fulfilled").map(s => (s as PromiseFulfilledResult<any>).value.id)
    );
    if (ids.size === 1) console.log("  PASS  all callers agree on one wallet id");
    else { failures++; console.log(`  FAIL  ${ids.size} distinct wallet ids returned`); }

    const after = await prisma.pettyCashWallet.count();
    if (after === 1) console.log(`  PASS  exactly one wallet row exists`);
    else { failures++; console.log(`  FAIL  ${after} wallet rows exist`); }

    const w = await prisma.pettyCashWallet.findFirst({ include: { glAccount: true } });
    if (w?.glAccount?.code === PETTY_CASH_CODE) console.log(`  PASS  linked to GL ${w.glAccount.code} "${w.glAccount.name}"`);
    else { failures++; console.log(`  FAIL  GL link is ${w?.glAccount?.code ?? "missing"}`); }

    console.log(`\nbalance: ${w?.currency} ${Number(w?.balance ?? 0).toFixed(2)} | float limit: ${Number(w?.floatLimit ?? 0).toFixed(2)}`);
    console.log(failures === 0 ? "All checks passed." : `${failures} CHECK(S) FAILED`);

    await prisma.$disconnect();
    process.exit(failures === 0 ? 0 : 1);
})();
