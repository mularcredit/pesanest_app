import prisma from "@/lib/prisma";

export type DuplicateEntrySummary = {
    id: string;
    entryNumber: string | null;
    date: Date;
    createdAt: Date;
    reference: string | null;
    amount: number;
};

export type DuplicateGroup = {
    key: string;
    description: string;
    amount: number;
    entries: DuplicateEntrySummary[];
    /** Only set for high-confidence groups: the entry to keep and the ones safe to void. */
    keepId?: string;
    voidCandidateIds?: string[];
};

// Reference formats in use: REQ-<id8>, ASSET-<id8|fullId>, EXP-<id8>, REV-<original ref>.
// A re-run/backfill script can end up posting the full asset id where the normal
// path posts only its first 8 chars, so entries are matched on that common prefix
// rather than requiring an exact string match — see the 2026-08-06 asset re-sync
// incident this module was built to catch a recurrence of.
const REF_PATTERN = /^([A-Za-z]+)-(.+)$/;

function normalizeRef(reference: string | null): string | null {
    if (!reference) return null;
    const match = reference.match(REF_PATTERN);
    if (!match) return null;
    const [, type, idPart] = match;
    if (type.toUpperCase() === "REV") return null; // reversal refs are corrections, not source-document dupes
    return `${type.toUpperCase()}:${idPart.slice(0, 8)}`;
}

function lineSignature(lines: { accountId: string; debit: number; credit: number }[]): string {
    return lines.map(l => `${l.accountId}:${l.debit}:${l.credit}`).sort().join("|");
}

function summarize(entry: { id: string; entryNumber: string | null; date: Date; createdAt: Date; reference: string | null; lines: { debit: number }[] }): DuplicateEntrySummary {
    return {
        id: entry.id,
        entryNumber: entry.entryNumber,
        date: entry.date,
        createdAt: entry.createdAt,
        reference: entry.reference,
        amount: entry.lines.reduce((s, l) => s + l.debit, 0),
    };
}

/**
 * Scans posted journal entries for duplicate postings.
 *
 * - `highConfidence`: entries whose reference points to the same source
 *   document (same requisition/asset/expense id) posted more than once.
 *   Safe to void automatically, keeping the earliest posting.
 * - `needsReview`: entries that merely share the same description and GL
 *   lines. This is NOT auto-actionable — recurring small expenses (airtime,
 *   transport, refreshments) routinely produce identical amount+description
 *   pairs that are genuinely separate transactions; only a human comparing
 *   the underlying requisition/expense justification can tell.
 */
export async function findDuplicateJournalEntries() {
    const entries = await prisma.journalEntry.findMany({
        where: { status: "POSTED", reversalOfId: null },
        include: { lines: { select: { accountId: true, debit: true, credit: true } } },
        orderBy: { createdAt: "asc" },
    });

    const byRef = new Map<string, typeof entries>();
    for (const e of entries) {
        const key = normalizeRef(e.reference);
        if (!key) continue;
        const arr = byRef.get(key);
        if (arr) arr.push(e); else byRef.set(key, [e]);
    }

    const highConfidenceIds = new Set<string>();
    const highConfidence: DuplicateGroup[] = [];
    for (const [key, group] of byRef.entries()) {
        if (group.length < 2) continue;
        const sorted = [...group].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
        for (const e of sorted) highConfidenceIds.add(e.id);
        highConfidence.push({
            key,
            description: sorted[0].description,
            amount: sorted[0].lines.reduce((s, l) => s + l.debit, 0),
            entries: sorted.map(summarize),
            keepId: sorted[0].id,
            voidCandidateIds: sorted.slice(1).map(e => e.id),
        });
    }

    const bySig = new Map<string, typeof entries>();
    for (const e of entries) {
        if (highConfidenceIds.has(e.id)) continue;
        const key = `${(e.description || "").trim().toLowerCase()}::${lineSignature(e.lines)}`;
        const arr = bySig.get(key);
        if (arr) arr.push(e); else bySig.set(key, [e]);
    }

    const needsReview: DuplicateGroup[] = [];
    for (const [key, group] of bySig.entries()) {
        if (group.length < 2) continue;
        const sorted = [...group].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
        needsReview.push({
            key,
            description: sorted[0].description,
            amount: sorted[0].lines.reduce((s, l) => s + l.debit, 0),
            entries: sorted.map(summarize),
        });
    }

    highConfidence.sort((a, b) => (b.amount * (b.entries.length - 1)) - (a.amount * (a.entries.length - 1)));
    needsReview.sort((a, b) => (b.amount * (b.entries.length - 1)) - (a.amount * (a.entries.length - 1)));

    return { highConfidence, needsReview };
}
