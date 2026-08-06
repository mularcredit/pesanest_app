/**
 * Verifies the extracted approval decision path and bulk sequencing:
 * authorisation, approval limits, already-decided guard, and that one failure
 * does not abort the rest of a batch. Creates its own throwaway approvals and
 * deletes them in a finally block.
 *   node_modules/.bin/tsx scratch/verify-bulk-approvals.ts
 */

import prisma from "../src/lib/prisma";
import { loadActor, processApprovalDecision, approvalItemLabel } from "../src/lib/approvals/process-approval";

const TAG = "__verify_bulk_appr__";
let failures = 0;
const approvalIds: string[] = [];
const reqIds: string[] = [];

function check(label: string, cond: boolean, detail = "") {
    console.log(cond ? `  PASS  ${label}` : `  FAIL  ${label} ${detail}`);
    if (!cond) failures++;
}

async function makeRequisitionApproval(ownerId: string, approverId: string, amount: number) {
    const req = await (prisma as any).requisition.create({
        data: {
            userId: ownerId, title: TAG, description: TAG, amount,
            category: "Office Supplies", businessJustification: TAG, status: "PENDING",
        },
    });
    reqIds.push(req.id);
    const appr = await prisma.approval.create({
        data: { requisitionId: req.id, approverId, status: "PENDING", level: 1 },
    });
    approvalIds.push(appr.id);
    return { req, appr };
}

(async () => {
    try {
        const users = await prisma.user.findMany({ select: { id: true, name: true, role: true }, take: 3 });
        if (users.length < 2) { console.log("need 2 users"); process.exit(0); }

        const admin = users.find(u => u.role === "SYSTEM_ADMIN") || users[0];
        const other = users.find(u => u.id !== admin.id)!;
        console.log(`admin: ${admin.name} | other: ${other.name}\n`);

        const adminActor = await loadActor(admin.id);
        const otherActor = await loadActor(other.id);
        check("actor resolves for admin", !!adminActor);
        check("admin is flagged as admin", adminActor!.isAdmin === true);
        check("actor resolves for non-admin", !!otherActor);

        // ── label helper ──
        check("labels a requisition by title",
            approvalItemLabel({ requisition: { title: "Rent" } } as any) === "Rent");
        check("labels an invoice by number",
            approvalItemLabel({ invoice: { invoiceNumber: "INV-9" } } as any) === "Invoice INV-9");
        check("falls back when nothing matches", approvalItemLabel({} as any) === "Item");

        // ── wrong approver is refused ──
        const { appr: notMine } = await makeRequisitionApproval(admin.id, other.id, 50);
        if (!adminActor!.isAdmin) {
            const wrong = await processApprovalDecision({ approvalId: notMine.id, decision: "APPROVED", actor: adminActor! });
            check("a non-approver is refused", !wrong.ok && (wrong as any).status === 403);
        } else {
            const asAdmin = await processApprovalDecision({ approvalId: notMine.id, decision: "APPROVED", actor: adminActor! });
            check("an admin may decide someone else's approval", asAdmin.ok, JSON.stringify(asAdmin));
        }

        // ── already decided is refused ──
        const again = await processApprovalDecision({ approvalId: notMine.id, decision: "APPROVED", actor: adminActor! });
        check("cannot decide the same approval twice", !again.ok, JSON.stringify(again));

        // ── unknown id ──
        const missing = await processApprovalDecision({ approvalId: "nope", decision: "APPROVED", actor: adminActor! });
        check("unknown approval is a clean 404", !missing.ok && (missing as any).status === 404);

        // ── approval limit blocks a non-admin over ceiling ──
        if (!otherActor!.isAdmin && otherActor!.approvalLimit < Number.MAX_SAFE_INTEGER) {
            const over = otherActor!.approvalLimit + 1000;
            const { appr } = await makeRequisitionApproval(admin.id, other.id, over);
            const res = await processApprovalDecision({ approvalId: appr.id, decision: "APPROVED", actor: otherActor! });
            check("over-limit approval is refused", !res.ok && (res as any).status === 403, JSON.stringify(res));
            check("the error explains the limit", String((res as any).error).includes("approval limit"));

            // rejecting is still allowed regardless of limit
            const rej = await processApprovalDecision({ approvalId: appr.id, decision: "REJECTED", actor: otherActor! });
            check("rejecting over-limit is still allowed", rej.ok, JSON.stringify(rej));
        } else {
            console.log(`  SKIP  second user has no finite approval limit (${otherActor!.approvalLimit})`);
        }

        // ── bulk: a failure mid-batch must not stop later items ──
        const a = await makeRequisitionApproval(other.id, admin.id, 100);
        const bad = { id: "definitely-not-an-id" };
        const c = await makeRequisitionApproval(other.id, admin.id, 300);

        const batch = [a.appr.id, bad.id, c.appr.id];
        const out: { id: string; ok: boolean }[] = [];
        for (const id of batch) {
            const r = await processApprovalDecision({ approvalId: id, decision: "APPROVED", actor: adminActor! });
            out.push({ id, ok: r.ok });
        }

        check("every item in the batch was attempted", out.length === 3);
        check("the bad id failed", out[1].ok === false);
        check("the item after the failure still processed", out[2].ok === true, JSON.stringify(out));
        check("two of three succeeded", out.filter(o => o.ok).length === 2);

        const finalStates = await prisma.approval.findMany({
            where: { id: { in: [a.appr.id, c.appr.id] } },
            select: { id: true, status: true },
        });
        check("both valid approvals are no longer PENDING",
            finalStates.every(s => s.status !== "PENDING"),
            JSON.stringify(finalStates));

    } catch (e: any) {
        console.log(`  FAIL  unexpected error: ${e?.message}`);
        failures++;
    } finally {
        if (approvalIds.length) await prisma.approval.deleteMany({ where: { id: { in: approvalIds } } }).catch(() => {});
        if (reqIds.length) {
            await prisma.approval.deleteMany({ where: { requisitionId: { in: reqIds } } }).catch(() => {});
            await (prisma as any).requisition.deleteMany({ where: { id: { in: reqIds } } }).catch(() => {});
        }
        const leaked = await (prisma as any).requisition.count({ where: { title: TAG } });
        check("no test rows persisted", leaked === 0, `found ${leaked}`);

        console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} CHECK(S) FAILED`);
        await prisma.$disconnect();
        process.exit(failures === 0 ? 0 : 1);
    }
})();
