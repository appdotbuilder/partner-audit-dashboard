import { db } from '../db';
import { journalLinesTable, accountsTable, fxRatesTable } from '../db/schema';
import { type DashboardSalarySplit } from '../schema';
import { eq, and, desc, sql } from 'drizzle-orm';

export async function getDashboardSalarySplit(): Promise<DashboardSalarySplit> {
  try {
    // Get current year for YTD calculation
    const currentYear = new Date().getFullYear();
    
    // Query salary expenses from payroll source accounts, grouped by currency
    const salaryQuery = db.select({
      currency: accountsTable.currency,
      total_debit: sql<string>`SUM(${journalLinesTable.debit_amount})`,
      total_credit: sql<string>`SUM(${journalLinesTable.credit_amount})`
    })
    .from(journalLinesTable)
    .innerJoin(accountsTable, eq(journalLinesTable.account_id, accountsTable.id))
    .where(
      and(
        eq(accountsTable.is_payroll_source, true),
        sql`EXTRACT(YEAR FROM (SELECT j.journal_date FROM journals j WHERE j.id = ${journalLinesTable.journal_id})) = ${currentYear}`
      )
    )
    .groupBy(accountsTable.currency);

    const salaryResults = await salaryQuery.execute();

    // Calculate net expenses by currency (debit - credit for expense accounts)
    let usd_salaries = 0;
    let pkr_salaries = 0;

    salaryResults.forEach(result => {
      const netAmount = parseFloat(result.total_debit) - parseFloat(result.total_credit);
      
      if (result.currency === 'USD') {
        usd_salaries += netAmount;
      } else if (result.currency === 'PKR') {
        pkr_salaries += netAmount;
      }
    });

    // Get latest USD to PKR rate for conversion
    let usdToPkrRate = 1;
    
    const latestFxRate = await db.select()
      .from(fxRatesTable)
      .where(
        and(
          eq(fxRatesTable.from_currency, 'USD'),
          eq(fxRatesTable.to_currency, 'PKR')
        )
      )
      .orderBy(desc(fxRatesTable.effective_date))
      .limit(1)
      .execute();

    if (latestFxRate.length > 0) {
      usdToPkrRate = parseFloat(latestFxRate[0].rate);
    }

    // Convert USD salaries to PKR and calculate total
    const usdSalariesInPkr = usd_salaries * usdToPkrRate;
    const total_pkr = pkr_salaries + usdSalariesInPkr;

    return {
      usd_salaries,
      pkr_salaries,
      total_pkr
    };
  } catch (error) {
    console.error('Dashboard salary split calculation failed:', error);
    throw error;
  }
}