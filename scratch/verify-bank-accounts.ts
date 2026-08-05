/**
 * Verifies bank account provisioning and the GL code allocator, including the
 * 1199 -> 1200 collision the old "highest + 1" rule would have caused.
 * Runs inside a rolled-back transaction.
 *   node_modules/.bin/tsx scratch/verify-bank-accounts.ts
 */

import prisma from "../src/lib/prisma";
import { nextBankGlCode, BANK_GL_RANGE_START, BANK_GL_RANGE_END } from "../src/lib/accounting/bank-accounts";

const ROLLBACK = "__rollback__";
let failures = 0;

function check(label: string, cond: boolean, detail = "") {
    console.log(cond ? `  PASS  ${label}` : `  FAIL  ${label} ${detail}`);
    if (!cond) failures++;
}

// The rule the API route used before the refactor.
function oldAllocator(codes: string[]): string {
    const elevens = codes.filter(c => c.startsWith("11")).sort().reverse();
    return elevens.length ? String(parseInt(elevens[0]) + 1) : "1100";
}

(async () => {
    const existingAR = await prisma.account.findFirst({ where: { code: "1200" }, select: { name: true } });
    console.log(`\ncode 1200 currently: ${existingAR ? `"${existingAR.name}"` : "(unused)"}`);

    try {
        await prisma.$transaction(async (tx: any) => {
            // ── first allocation in an empty band ──
            const before = await tx.account.findMany({
                where: { code: { gte: String(BANK_GL_RANGE_START), lte: String(BANK_GL_RANGE_END) } },
                select: { code: true },
            });
            console.log(`bank-band codes already in use: ${before.length ? before.map((a: any) => a.code).join(", ") : "none"}`);

            const first = await nextBankGlCode(tx);
            check("allocates a code inside the bank band",
                Number(first) >= BANK_GL_RANGE_START && Number(first) <= BANK_GL_RANGE_END, `got ${first}`);
            check("allocated code is not already taken",
                !before.some((a: any) => a.code === first), `got ${first}`);

            // ── sequential allocation ──
            const glA = await tx.account.create({
                data: { code: first, name: "Bank — Test A", type: "ASSET", subtype: "BANK" },
            });
            const second = await nextBankGlCode(tx);
            check("second allocation differs from the first", second !== first, `${first} vs ${second}`);

            const bankA = await tx.bankAccount.create({
                data: { name: "Test A", bankName: "Test Bank", accountNumber: "0170000001", currency: "KES", glAccountId: glA.id },
                include: { glAccount: true },
            });
            check("bank account links to its GL sub-account", bankA.glAccount?.code === first);
            check("GL sub-account is an ASSET/BANK", glA.type === "ASSET" && glA.subtype === "BANK");
            check("bank account is active by default", bankA.isActive === true);

            // ── gap reuse: free a code in the middle, it should be handed back ──
            const gapCode = second;
            const glGap = await tx.account.create({
                data: { code: gapCode, name: "Bank — Test Gap", type: "ASSET", subtype: "BANK" },
            });
            const third = await nextBankGlCode(tx);
            check("skips both taken codes", third !== first && third !== gapCode, `got ${third}`);
            await tx.account.delete({ where: { id: glGap.id } });
            const reused = await nextBankGlCode(tx);
            check("reuses a freed code instead of leaking it", reused === gapCode, `expected ${gapCode}, got ${reused}`);

            // ── the 1199 boundary ──
            const fullBand = Array.from(
                { length: BANK_GL_RANGE_END - BANK_GL_RANGE_START },
                (_, i) => String(BANK_GL_RANGE_START + i)
            ); // 1100..1198, leaving 1199 free
            check("old allocator would jump to 1200 once 1199 is taken",
                oldAllocator([...fullBand, "1199"]) === "1200");
            check("1200 is a real account, so that would have collided", !!existingAR);

            // deactivation keeps the row
            const deactivated = await tx.bankAccount.update({ where: { id: bankA.id }, data: { isActive: false } });
            check("deactivate preserves the row and its GL link",
                deactivated.isActive === false && deactivated.glAccountId === glA.id);

            throw new Error(ROLLBACK);
        }, { timeout: 120000 });
    } catch (e: any) {
        if (e?.message !== ROLLBACK) {
            console.log(`  FAIL  unexpected error: ${e?.message}`);
            failures++;
        }
    }

    const leakedBanks = await prisma.bankAccount.count({ where: { bankName: "Test Bank" } });
    const leakedGl = await prisma.account.count({ where: { name: { startsWith: "Bank — Test " } } });
    check("no test bank accounts persisted", leakedBanks === 0, `found ${leakedBanks}`);
    check("no test GL accounts persisted", leakedGl === 0, `found ${leakedGl}`);

    console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} CHECK(S) FAILED`);
    await prisma.$disconnect();
    process.exit(failures === 0 ? 0 : 1);
})();
