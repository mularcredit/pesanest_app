/**
 * POST /api/assets/[id]/dispose
 *
 * Records the disposal of a fixed asset. Posts a journal entry:
 *
 *   Dr  Accumulated Depreciation (1600) — removes contra-asset
 *   Dr  Cash / Proceeds account         — if proceeds > 0
 *   Dr  Loss on Disposal (7000)         — if net book value > proceeds
 *   Cr  Asset Cost account              — removes asset at cost
 *   Cr  Gain on Disposal (7100)         — if proceeds > net book value
 *
 * Sets Asset.status = DISPOSED.
 * Requires SYSTEM_ADMIN.
 *
 * Body: {
 *   disposalDate: string,    // YYYY-MM-DD
 *   proceeds?: number,       // cash received (default 0)
 *   proceedsAccountId?: string,  // GL account for proceeds (defaults to code 1000)
 *   reason?: string
 * }
 */

import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { AccountingEngine } from "@/lib/accounting/accounting-engine";
import { NextResponse } from "next/server";

export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
    const params = await props.params;
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { role: true, customRole: { select: { isSystem: true } } }
    });
    if (user?.role !== 'SYSTEM_ADMIN' && !user?.customRole?.isSystem) {
        return NextResponse.json({ error: "Only System Admins can dispose assets" }, { status: 403 });
    }

    const asset = await prisma.asset.findUnique({ where: { id: params.id } });
    if (!asset) return NextResponse.json({ error: "Asset not found" }, { status: 404 });
    if (asset.status === 'DISPOSED') return NextResponse.json({ error: "Asset is already disposed" }, { status: 409 });

    const body = await req.json();
    const disposalDate = new Date(body.disposalDate || new Date());
    const proceeds = Number(body.proceeds || 0);
    const reason = body.reason?.trim() || `Disposal of asset ${asset.name}`;

    // Cost and accumulated depreciation
    const assetCost = asset.purchasePrice;
    const currentValue = asset.currentValue ?? assetCost;
    const accumulatedDepreciation = assetCost - currentValue;
    const netBookValue = currentValue;

    const gainOrLoss = proceeds - netBookValue;

    // Resolve GL accounts by code
    const [accDepAccount, cashAccount, gainAccount, lossAccount] = await Promise.all([
        prisma.account.findFirst({ where: { code: '1600' } }),
        body.proceedsAccountId
            ? prisma.account.findFirst({ where: { id: body.proceedsAccountId } })
            : prisma.account.findFirst({ where: { code: '1000' } }),
        prisma.account.findFirst({ where: { code: '7100' } }),
        prisma.account.findFirst({ where: { code: '7000' } })
    ]);

    const assetAccount = await prisma.account.findFirst({ where: { name: { contains: asset.name } } })
        || await prisma.account.findFirst({ where: { code: '1500' } });

    if (!accDepAccount || !assetAccount) {
        return NextResponse.json({ error: "Required GL accounts (1500 Asset, 1600 Accumulated Depreciation) not found" }, { status: 422 });
    }

    // Build journal lines
    const journalLines: { accountId: string; debit: number; credit: number; description: string }[] = [];

    // Remove accumulated depreciation (Dr Acc Dep)
    if (accumulatedDepreciation > 0) {
        journalLines.push({
            accountId: accDepAccount.id,
            debit: accumulatedDepreciation,
            credit: 0,
            description: `Remove acc. dep — ${asset.name}`
        });
    }

    // Record cash proceeds (Dr Cash)
    if (proceeds > 0 && cashAccount) {
        journalLines.push({
            accountId: cashAccount.id,
            debit: proceeds,
            credit: 0,
            description: `Disposal proceeds — ${asset.name}`
        });
    }

    // Remove asset at cost (Cr Asset)
    journalLines.push({
        accountId: assetAccount.id,
        debit: 0,
        credit: assetCost,
        description: `Remove asset cost — ${asset.name}`
    });

    // Gain or loss
    if (gainOrLoss > 0 && gainAccount) {
        journalLines.push({
            accountId: gainAccount.id,
            debit: 0,
            credit: gainOrLoss,
            description: `Gain on disposal — ${asset.name}`
        });
    } else if (gainOrLoss < 0 && lossAccount) {
        journalLines.push({
            accountId: lossAccount.id,
            debit: Math.abs(gainOrLoss),
            credit: 0,
            description: `Loss on disposal — ${asset.name}`
        });
    }

    const entry = await AccountingEngine.postJournalEntry({
        date: disposalDate,
        description: reason,
        reference: `DISP-${params.id}`,
        userId: session.user.id,
        lines: journalLines
    });

    await prisma.asset.update({
        where: { id: params.id },
        data: { status: 'DISPOSED', notes: `${asset.notes || ''}\n[DISPOSED ${disposalDate.toISOString().slice(0, 10)}] ${reason}`.trim() }
    });

    await (prisma as any).auditLog.create({
        data: {
            actorId: session.user.id,
            action: 'ASSET_DISPOSE',
            entity: 'Asset',
            entityId: params.id,
            before: { status: asset.status, currentValue: netBookValue },
            after: { status: 'DISPOSED', proceeds, gainOrLoss, journalEntryId: entry.id }
        }
    });

    return NextResponse.json({ entryId: entry.id, netBookValue, proceeds, gainOrLoss });
}
