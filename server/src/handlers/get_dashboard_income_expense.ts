import { db } from '../db';
import { journalLinesTable, accountsTable, journalsTable } from '../db/schema';
import { type DashboardIncomeExpense } from '../schema';
import { eq, and, gte, lte, sql, SQL } from 'drizzle-orm';

export async function getDashboardIncomeExpense(): Promise<DashboardIncomeExpense[]> {
  try {
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth() + 1; // getMonth() is 0-indexed

    // Get start of current month for MTD calculation (YYYY-MM-DD format)
    const monthStart = `${currentYear}-${currentMonth.toString().padStart(2, '0')}-01`;
    
    // Get start of current year for YTD calculation (YYYY-MM-DD format)
    const yearStart = `${currentYear}-01-01`;

    // Query to get income/expense data grouped by currency
    const results = await db
      .select({
        currency: accountsTable.currency,
        account_type: accountsTable.account_type,
        total_amount: sql<string>`COALESCE(SUM(${journalLinesTable.credit_amount} - ${journalLinesTable.debit_amount}), '0')`,
        journal_date: journalsTable.journal_date
      })
      .from(journalLinesTable)
      .innerJoin(accountsTable, eq(journalLinesTable.account_id, accountsTable.id))
      .innerJoin(journalsTable, eq(journalLinesTable.journal_id, journalsTable.id))
      .where(
        and(
          sql`${accountsTable.account_type} IN ('Income', 'Expense')`,
          eq(journalsTable.status, 'Posted'),
          gte(journalsTable.journal_date, yearStart)
        )
      )
      .groupBy(accountsTable.currency, accountsTable.account_type, journalsTable.journal_date)
      .execute();

    // Process results to calculate MTD and YTD totals
    const summaryData: { [key: string]: DashboardIncomeExpense } = {};

    // Initialize summaries for both currencies
    ['USD', 'PKR'].forEach(currency => {
      summaryData[currency] = {
        currency: currency as 'USD' | 'PKR',
        income_mtd: 0,
        expense_mtd: 0,
        income_ytd: 0,
        expense_ytd: 0
      };
    });

    results.forEach(row => {
      const amount = parseFloat(row.total_amount);
      const journalDate = row.journal_date; // Already a string in YYYY-MM-DD format
      const currency = row.currency;
      
      if (!summaryData[currency]) return;

      // Determine if this is MTD (current month) or just YTD
      const isMTD = journalDate >= monthStart;

      if (row.account_type === 'Income') {
        summaryData[currency].income_ytd += amount;
        if (isMTD) {
          summaryData[currency].income_mtd += amount;
        }
      } else if (row.account_type === 'Expense') {
        // For expenses, we want positive amounts to represent expenses
        const expenseAmount = Math.abs(amount);
        summaryData[currency].expense_ytd += expenseAmount;
        if (isMTD) {
          summaryData[currency].expense_mtd += expenseAmount;
        }
      }
    });

    // Convert to array and return
    return Object.values(summaryData);
  } catch (error) {
    console.error('Dashboard income/expense calculation failed:', error);
    throw error;
  }
}