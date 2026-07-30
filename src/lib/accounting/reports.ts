
import prisma from "@/lib/prisma";

export class FinancialReports {

    /**
     * Generates a Profit & Loss for a date range.
     * Returns revenue, expenses, and net income grouped by account.
     */
    static async getProfitAndLoss(startDate: Date, endDate: Date) {
        const accounts = await prisma.account.findMany({
            where: { type: { in: ['REVENUE', 'EXPENSE'] } },
            include: {
                journalLines: {
                    where: {
                        entry: {
                            date: { gte: startDate, lte: endDate },
                            status: 'POSTED'
                        }
                    }
                }
            }
        });

        const revenue: { code: string; name: string; balance: number }[] = [];
        const expenses: { code: string; name: string; balance: number }[] = [];
        let totalRevenue = 0;
        let totalExpenses = 0;

        for (const account of accounts) {
            const debit = account.journalLines.reduce((s, l) => s + l.debit, 0);
            const credit = account.journalLines.reduce((s, l) => s + l.credit, 0);
            const balance = account.type === 'REVENUE' ? credit - debit : debit - credit;
            if (balance === 0) continue;

            const entry = { code: account.code, name: account.name, balance };
            if (account.type === 'REVENUE') {
                revenue.push(entry);
                totalRevenue += balance;
            } else {
                expenses.push(entry);
                totalExpenses += balance;
            }
        }

        revenue.sort((a, b) => a.code.localeCompare(b.code));
        expenses.sort((a, b) => a.code.localeCompare(b.code));

        return {
            startDate, endDate,
            revenue: { accounts: revenue, total: totalRevenue },
            expenses: { accounts: expenses, total: totalExpenses },
            netIncome: totalRevenue - totalExpenses
        };
    }

    /**
     * Generates a comparative report for two periods side-by-side.
     * reportType: 'PL' (Profit & Loss) | 'BS' (Balance Sheet)
     */
    static async getComparative(
        period1: { start: Date; end: Date; label?: string },
        period2: { start: Date; end: Date; label?: string },
        reportType: 'PL' | 'BS' = 'PL'
    ) {
        if (reportType === 'PL') {
            const [p1, p2] = await Promise.all([
                FinancialReports.getProfitAndLoss(period1.start, period1.end),
                FinancialReports.getProfitAndLoss(period2.start, period2.end)
            ]);

            // Merge all account codes from both periods
            const allCodes = new Set([
                ...p1.revenue.accounts.map(a => a.code),
                ...p2.revenue.accounts.map(a => a.code),
                ...p1.expenses.accounts.map(a => a.code),
                ...p2.expenses.accounts.map(a => a.code)
            ]);

            const p1Map: Record<string, any> = {};
            const p2Map: Record<string, any> = {};
            [...p1.revenue.accounts, ...p1.expenses.accounts].forEach(a => { p1Map[a.code] = a; });
            [...p2.revenue.accounts, ...p2.expenses.accounts].forEach(a => { p2Map[a.code] = a; });

            const rows = Array.from(allCodes).sort().map(code => ({
                code,
                name: (p1Map[code] || p2Map[code])?.name || code,
                period1: p1Map[code]?.balance ?? 0,
                period2: p2Map[code]?.balance ?? 0,
                variance: (p1Map[code]?.balance ?? 0) - (p2Map[code]?.balance ?? 0)
            }));

            return {
                reportType: 'PL',
                period1: { label: period1.label || period1.start.toISOString().slice(0, 10), ...period1 },
                period2: { label: period2.label || period2.start.toISOString().slice(0, 10), ...period2 },
                rows,
                summary: {
                    period1: { revenue: p1.revenue.total, expenses: p1.expenses.total, netIncome: p1.netIncome },
                    period2: { revenue: p2.revenue.total, expenses: p2.expenses.total, netIncome: p2.netIncome },
                    variance: { revenue: p1.revenue.total - p2.revenue.total, expenses: p1.expenses.total - p2.expenses.total, netIncome: p1.netIncome - p2.netIncome }
                }
            };
        }

        // BS comparison
        const [p1, p2] = await Promise.all([
            FinancialReports.getBalanceSheet(period1.end),
            FinancialReports.getBalanceSheet(period2.end)
        ]);

        return {
            reportType: 'BS',
            period1: { label: period1.label || period1.end.toISOString().slice(0, 10), asOf: period1.end, data: p1 },
            period2: { label: period2.label || period2.end.toISOString().slice(0, 10), asOf: period2.end, data: p2 }
        };
    }

    /**
     * Generates a Balance Sheet
     * Assets = Liabilities + Equity
     */
    static async getBalanceSheet(asOfDate: Date = new Date()) {
        // Fetch all accounts with their types
        const accounts = await prisma.account.findMany({
            include: {
                journalLines: {
                    where: {
                        entry: {
                            date: { lte: asOfDate },
                            status: 'POSTED'
                        }
                    }
                }
            }
        });

        const report = {
            assets: { total: 0, accounts: [] as any[] },
            liabilities: { total: 0, accounts: [] as any[] },
            equity: { total: 0, accounts: [] as any[] }
        };

        for (const account of accounts) {
            // Calculate Net Balance: Debits - Credits (Asset/Expense) or Credits - Debits (Liability/Equity/Revenue)
            const totalDebit = account.journalLines.reduce((sum, line) => sum + line.debit, 0);
            const totalCredit = account.journalLines.reduce((sum, line) => sum + line.credit, 0);

            let balance = 0;
            // Normal Balance Logic
            if (['ASSET', 'EXPENSE'].includes(account.type)) {
                balance = totalDebit - totalCredit;
            } else {
                balance = totalCredit - totalDebit;
            }

            if (balance === 0) continue;

            const entry = { code: account.code, name: account.name, balance };

            if (account.type === 'ASSET') {
                report.assets.accounts.push(entry);
                report.assets.total += balance;
            } else if (account.type === 'LIABILITY') {
                report.liabilities.accounts.push(entry);
                report.liabilities.total += balance;
            } else if (account.type === 'EQUITY') {
                report.equity.accounts.push(entry);
                report.equity.total += balance;
            }
            // Revenue/Expenses roll into Retained Earnings (Equity) for Balance Sheet
            // Simplified here: You usually calculate Net Income and add to Equity
        }

        // Calculate Net Income (Revenue - Expenses) to add to Equity (Retained Earnings)
        const revenue = accounts.filter(a => a.type === 'REVENUE').reduce((sum, a) => {
            const debits = a.journalLines.reduce((s, l) => s + l.debit, 0);
            const credits = a.journalLines.reduce((s, l) => s + l.credit, 0);
            return sum + (credits - debits);
        }, 0);

        const expenses = accounts.filter(a => a.type === 'EXPENSE').reduce((sum, a) => {
            const debits = a.journalLines.reduce((s, l) => s + l.debit, 0);
            const credits = a.journalLines.reduce((s, l) => s + l.credit, 0);
            return sum + (debits - credits);
        }, 0);

        const netIncome = revenue - expenses;

        // Add Net Income to Equity
        report.equity.accounts.push({ code: '9999', name: 'Net Income (Current Year)', balance: netIncome });
        report.equity.total += netIncome;

        return report;
    }
}
