/**
 * GET /api/accounting/aging?type=AR|AP&asOf=YYYY-MM-DD
 *
 * Returns aged receivables (AR) or payables (AP) bucketed into:
 *   Current (not yet due), 1-30, 31-60, 61-90, 91+ days overdue
 *
 * AR — unpaid Sales invoices (status SENT | PARTIALLY_PAID) tied to the AR
 *      control account (code 1200).
 * AP — unpaid vendor Invoices (paymentStatus UNPAID | status APPROVED) tied
 *      to the AP control account (code 2000).
 *
 * Also returns the GL control-account balance for tie-out verification.
 */

import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";

function ageBucket(dueDate: Date, asOf: Date): string {
    const days = Math.floor((asOf.getTime() - dueDate.getTime()) / 86400000);
    if (days < 0)  return 'current';
    if (days <= 30) return '1_30';
    if (days <= 60) return '31_60';
    if (days <= 90) return '61_90';
    return '91_plus';
}

export async function GET(req: Request) {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const type = (searchParams.get('type') || 'AR').toUpperCase();
    const asOf = searchParams.get('asOf') ? new Date(searchParams.get('asOf')!) : new Date();

    if (!['AR', 'AP'].includes(type)) {
        return NextResponse.json({ error: "type must be AR or AP" }, { status: 400 });
    }

    const buckets = {
        current: { count: 0, total: 0, items: [] as any[] },
        '1_30':  { count: 0, total: 0, items: [] as any[] },
        '31_60': { count: 0, total: 0, items: [] as any[] },
        '61_90': { count: 0, total: 0, items: [] as any[] },
        '91_plus': { count: 0, total: 0, items: [] as any[] }
    };

    if (type === 'AR') {
        const unpaidSales = await prisma.sale.findMany({
            where: {
                status: { in: ['SENT', 'PARTIALLY_PAID', 'OVERDUE'] },
                dueDate: { lte: asOf }
            },
            include: { customer: { select: { id: true, name: true } } },
            orderBy: { dueDate: 'asc' }
        });

        for (const sale of unpaidSales) {
            const bucket = ageBucket(sale.dueDate, asOf) as keyof typeof buckets;
            const amount = Number(sale.totalAmount);
            buckets[bucket].count++;
            buckets[bucket].total += amount;
            buckets[bucket].items.push({
                id: sale.id,
                invoiceNumber: sale.invoiceNumber,
                party: sale.customer.name,
                partyId: sale.customer.id,
                issueDate: sale.issueDate,
                dueDate: sale.dueDate,
                amount,
                currency: sale.currency
            });
        }

        // Also include not-yet-due
        const currentSales = await prisma.sale.findMany({
            where: { status: { in: ['SENT', 'PARTIALLY_PAID'] }, dueDate: { gt: asOf } },
            include: { customer: { select: { id: true, name: true } } }
        });
        for (const sale of currentSales) {
            const amount = Number(sale.totalAmount);
            buckets.current.count++;
            buckets.current.total += amount;
            buckets.current.items.push({
                id: sale.id,
                invoiceNumber: sale.invoiceNumber,
                party: sale.customer.name,
                partyId: sale.customer.id,
                issueDate: sale.issueDate,
                dueDate: sale.dueDate,
                amount,
                currency: sale.currency
            });
        }

        // GL control-account tie-out: AR = 1200
        const arAccount = await prisma.account.findFirst({ where: { code: '1200' } });
        let glBalance = 0;
        if (arAccount) {
            const agg = await prisma.journalLine.aggregate({
                where: { accountId: arAccount.id, entry: { status: 'POSTED' } },
                _sum: { debit: true, credit: true }
            });
            glBalance = (agg._sum.debit || 0) - (agg._sum.credit || 0);
        }

        const agingTotal = Object.values(buckets).reduce((s, b) => s + b.total, 0);

        return NextResponse.json({
            type: 'AR',
            asOf,
            buckets,
            agingTotal: Math.round(agingTotal * 100) / 100,
            glBalance: Math.round(glBalance * 100) / 100,
            variance: Math.round((agingTotal - glBalance) * 100) / 100
        });
    }

    // AP
    const unpaidInvoices = await prisma.invoice.findMany({
        where: {
            paymentStatus: { in: ['UNPAID', 'PARTIALLY_PAID'] },
            status: { in: ['APPROVED', 'PENDING_APPROVAL'] }
        },
        include: { vendor: { select: { id: true, name: true } } },
        orderBy: { dueDate: 'asc' }
    });

    for (const inv of unpaidInvoices) {
        const dueDate = inv.dueDate ?? inv.invoiceDate;
        const bucket = ageBucket(dueDate, asOf) as keyof typeof buckets;
        const amount = Number(inv.amount);
        buckets[bucket].count++;
        buckets[bucket].total += amount;
        buckets[bucket].items.push({
            id: inv.id,
            invoiceNumber: inv.invoiceNumber,
            party: inv.vendor.name,
            partyId: inv.vendor.id,
            invoiceDate: inv.invoiceDate,
            dueDate,
            amount,
            currency: inv.currency
        });
    }

    // GL control-account tie-out: AP = 2000
    const apAccount = await prisma.account.findFirst({ where: { code: '2000' } });
    let glBalance = 0;
    if (apAccount) {
        const agg = await prisma.journalLine.aggregate({
            where: { accountId: apAccount.id, entry: { status: 'POSTED' } },
            _sum: { debit: true, credit: true }
        });
        glBalance = (agg._sum.credit || 0) - (agg._sum.debit || 0);
    }

    const agingTotal = Object.values(buckets).reduce((s, b) => s + b.total, 0);

    return NextResponse.json({
        type: 'AP',
        asOf,
        buckets,
        agingTotal: Math.round(agingTotal * 100) / 100,
        glBalance: Math.round(glBalance * 100) / 100,
        variance: Math.round((agingTotal - glBalance) * 100) / 100
    });
}
