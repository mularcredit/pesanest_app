import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import prisma from '@/lib/prisma';

// Account type → code range (start, end)
const TYPE_RANGES: Record<string, [number, number]> = {
    ASSET:     [1000, 1999],
    LIABILITY: [2000, 2999],
    EQUITY:    [3000, 3999],
    REVENUE:   [4000, 4999],
    EXPENSE:   [5000, 5999],
};

export async function GET(req: NextRequest) {
    const session = await auth();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const type = (searchParams.get('type') || 'EXPENSE').toUpperCase();
    const query = searchParams.get('query') || '';   // partial code user is typing

    const range = TYPE_RANGES[type] ?? TYPE_RANGES.EXPENSE;
    const [rangeStart, rangeEnd] = range;

    // Fetch all existing codes in this range
    const existing = await prisma.account.findMany({
        where: {
            code: {
                gte: String(rangeStart),
                lte: String(rangeEnd),
            },
        },
        select: { code: true, name: true },
        orderBy: { code: 'asc' },
    });

    const existingCodes = new Set(existing.map(a => a.code));

    // Find the next available code (gaps first, then after max)
    let nextCode = String(rangeStart);
    for (let c = rangeStart; c <= rangeEnd; c++) {
        if (!existingCodes.has(String(c))) {
            nextCode = String(c);
            break;
        }
    }

    // If the user is typing a custom query, return nearby suggestions
    let suggestions: { code: string; name: string; available: boolean }[] = [];
    if (query.trim()) {
        const prefix = query.trim();
        // Show codes in range that start with the typed prefix
        for (let c = rangeStart; c <= rangeEnd; c++) {
            const cStr = String(c);
            if (cStr.startsWith(prefix)) {
                suggestions.push({
                    code: cStr,
                    name: existing.find(e => e.code === cStr)?.name || '',
                    available: !existingCodes.has(cStr),
                });
            }
            if (suggestions.length >= 6) break;
        }
    } else {
        // Return a few nearby available codes as quick picks
        let count = 0;
        for (let c = rangeStart; c <= rangeEnd && count < 5; c++) {
            const cStr = String(c);
            if (!existingCodes.has(cStr)) {
                suggestions.push({ code: cStr, name: '', available: true });
                count++;
            }
        }
    }

    return NextResponse.json({ nextCode, suggestions, range: [rangeStart, rangeEnd] });
}
