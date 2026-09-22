/**
 * POST /api/accounting/bank-accounts/[id]/parse-pdf
 *
 * Extracts a table of rows from an uploaded bank/paybill statement PDF, in
 * whatever layout the issuing bank exports it in. Returns the same shape
 * (`rawRows: any[][]`, one header row plus data rows) that BankReconciliationClient
 * already knows how to interpret for CSV/Excel imports — via the same
 * alias-based date/description/amount column detection — so a PDF import
 * feeds into the exact same preview/customize screen as any other format.
 *
 * This does not import anything into the database; it only parses. The
 * actual import still goes through POST /statements once the user confirms
 * the preview.
 *
 * Two extraction strategies, tried in order:
 *   1. pdf-parse's own getTable() — works well when the PDF has an actual
 *      ruled/structured table pdf.js's layout analysis can recognize.
 *   2. A line-based regex fallback over the extracted plain text — most
 *      "printed report" style bank statements (no real table structure,
 *      just column-aligned text) fall through to this. It looks for a
 *      leading date and 1-3 trailing money-shaped numbers per line, and
 *      treats whatever sits between them as the description. This is
 *      inherently best-effort for a truly page-per-page-different PDF —
 *      it's why the preview/customize step exists, so any row it gets
 *      wrong is easy to fix before anything is imported.
 */

import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";
import { resolveReconcilableAccount } from "@/lib/accounting/reconcilable-accounts";

async function requireAdmin(session: any) {
    if (!session?.user?.id) return false;
    const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { role: true, customRole: { select: { isSystem: true } } }
    });
    return user?.role === 'SYSTEM_ADMIN' || user?.customRole?.isSystem;
}

const DATE_RE = /^\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{4}-\d{1,2}-\d{1,2}|\d{1,2}\s+[A-Za-z]{3,9}\s+\d{2,4})/;
// Requires a decimal point — excludes bare integers like voucher/reference
// numbers ("Ref 4471") from being mistaken for a money amount.
const AMOUNT_RE = /\(?-?\d+(?:,\d{3})*\.\d{1,2}\)?/g;

function parseAmountToken(token: string): number {
    let s = token.replace(/,/g, '');
    const negative = s.startsWith('(') && s.endsWith(')');
    s = s.replace(/[()]/g, '');
    const n = parseFloat(s);
    return negative ? -n : n;
}

/** One row per transaction line: {date, description, numbers[]} (1-3 trailing amounts). */
function extractLinesFallback(text: string): { date: string; description: string; numbers: number[] }[] {
    const rows: { date: string; description: string; numbers: number[] }[] = [];
    for (const raw of text.split('\n')) {
        const line = raw.trim();
        if (!line) continue;
        const dateMatch = line.match(DATE_RE);
        if (!dateMatch) continue;

        const rest = line.slice(dateMatch[0].length);
        const amountMatches = [...rest.matchAll(AMOUNT_RE)];
        if (amountMatches.length === 0) continue;

        const trailing = amountMatches.slice(-3);
        const description = rest.slice(0, trailing[0].index).trim();
        const numbers = trailing.map(m => parseAmountToken(m[0]));
        rows.push({ date: dateMatch[1], description: description || 'Unknown', numbers });
    }
    return rows;
}

/** Builds a rawRows grid (header + data) matching the shape parseStatementRows() on the client expects. */
function buildRawRowsFromFallback(lines: { date: string; description: string; numbers: number[] }[]): any[][] {
    if (lines.length === 0) return [];

    // Most lines should agree on how many trailing amounts they carry (1 =
    // single signed Amount column, 2-3 = Debit/Credit[/Balance]) — go with
    // whichever count the majority of lines actually have.
    const counts = new Map<number, number>();
    for (const l of lines) counts.set(l.numbers.length, (counts.get(l.numbers.length) || 0) + 1);
    const modeCount = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];

    const usable = lines.filter(l => l.numbers.length >= modeCount);
    const header = modeCount >= 2 ? ['Date', 'Description', 'Debit', 'Credit'] : ['Date', 'Description', 'Amount'];

    const dataRows = usable.map(l => {
        if (modeCount >= 2) return [l.date, l.description, l.numbers[0], l.numbers[1]];
        return [l.date, l.description, l.numbers[0]];
    });

    return [header, ...dataRows];
}

export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
    const params = await props.params;
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await requireAdmin(session))) {
        return NextResponse.json({ error: "Only System Admins can import statements" }, { status: 403 });
    }

    const account = await resolveReconcilableAccount(params.id);
    if (!account) return NextResponse.json({ error: "Account not found" }, { status: 404 });

    const formData = await req.formData().catch(() => null);
    const file = formData?.get('file');
    if (!file || !(file instanceof File)) {
        return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // Imported lazily — pdf.js (which this wraps) is a large dependency with
    // its own worker assets, best kept out of the route's cold-start path
    // for every other reconciliation request.
    const { PDFParse } = await import("pdf-parse");
    let parser: any;
    try {
        parser = new PDFParse({ data: buffer });

        const tableResult = await parser.getTable();
        const tableRows: any[][] = [];
        for (const page of tableResult.pages || []) {
            for (const table of page.tables || []) {
                for (const row of table) tableRows.push(row);
            }
        }
        if (tableRows.length > 1) {
            return NextResponse.json({ rawRows: tableRows });
        }

        // Fall back to line-based text extraction.
        const textResult = await parser.getText();
        const fallbackLines = extractLinesFallback(textResult.text || '');
        const rawRows = buildRawRowsFromFallback(fallbackLines);

        if (rawRows.length === 0) {
            return NextResponse.json({
                error: "Couldn't find any recognizable date + amount pattern in that PDF. It may be scanned/image-based rather than real text — try exporting the statement as CSV or Excel instead."
            }, { status: 400 });
        }

        return NextResponse.json({ rawRows });
    } catch (error: any) {
        return NextResponse.json({ error: error.message || "Failed to parse that PDF" }, { status: 500 });
    } finally {
        if (parser) await parser.destroy().catch(() => {});
    }
}
