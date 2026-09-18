/**
 * One-time backfill: link each Asset to its one active JournalEntry via the
 * new assetId relation, migrating off the old ASSET-<id> reference-string
 * convention. See the plan this came from for full context.
 *
 * Dry-run by default — pass --apply to actually write.
 * Safe to re-run — only ever fills in assetId where it is currently null.
 *
 * If an asset has more than one *active* (non-VOID) matching entry, that's an
 * unresolved duplicate: this script reports it and refuses to write anything
 * for that asset rather than guessing which one to keep.
 */
import prisma from '../src/lib/prisma';

const apply = process.argv.includes('--apply');

async function main() {
    const assets = await prisma.asset.findMany({ select: { id: true, name: true } });

    let backfilled = 0;
    let conflicts = 0;
    let none = 0;

    for (const asset of assets) {
        const candidates = [`ASSET-${asset.id}`, `ASSET-${asset.id.substring(0, 8)}`];
        const matches = await prisma.journalEntry.findMany({
            where: { reference: { in: candidates }, assetId: null },
            orderBy: { entryNumber: 'asc' },
        });
        const active = matches.filter(m => m.status !== 'VOID');

        if (active.length === 0) {
            none++;
            continue;
        }

        if (active.length > 1) {
            conflicts++;
            console.warn(
                `CONFLICT asset=${asset.id} (${asset.name}): ${active.map(a => `${a.entryNumber}/${a.id}`).join(', ')}`
            );
            continue;
        }

        backfilled++;
        console.log(`${apply ? 'LINKING' : 'WOULD LINK'} asset=${asset.id} (${asset.name}) -> ${active[0].entryNumber}`);
        if (apply) {
            await prisma.journalEntry.update({ where: { id: active[0].id }, data: { assetId: asset.id } });
        }
    }

    console.log(`\n${assets.length} assets: ${backfilled} backfilled, ${conflicts} conflicts, ${none} had no ledger entry to link | mode=${apply ? 'APPLY' : 'DRY-RUN'}`);
    if (conflicts > 0) {
        console.warn('Conflicts found — resolve via AccountingEngine.voidJournalEntry() on the extra duplicates, then re-run.');
        process.exitCode = 1;
    }
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
