import { db } from '../db';
import { accountsTable, journalLinesTable, fxRatesTable } from '../db/schema';
import { type DashboardBalance } from '../schema';
import { eq, and, desc, isNull, or } from 'drizzle-orm';
import { sql } from 'drizzle-orm';

export async function getDashboardBalances(): Promise<DashboardBalance[]> {
  try {
    // Get bank account balances by currency
    const bankBalances = await db
      .select({
        currency: accountsTable.currency,
        total_debit: sql<string>`COALESCE(SUM(${journalLinesTable.debit_amount}), '0')`,
        total_credit: sql<string>`COALESCE(SUM(${journalLinesTable.credit_amount}), '0')`
      })
      .from(accountsTable)
      .leftJoin(journalLinesTable, eq(journalLinesTable.account_id, accountsTable.id))
      .where(
        and(
          eq(accountsTable.is_bank, true),
          eq(accountsTable.is_active, true)
        )
      )
      .groupBy(accountsTable.currency)
      .execute();

    // Get latest USD to PKR exchange rate
    const latestFxRate = await db
      .select({
        rate: fxRatesTable.rate
      })
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

    const usdToPkrRate = latestFxRate.length > 0 ? parseFloat(latestFxRate[0].rate) : 1;

    // Process balances and build results
    const results: DashboardBalance[] = [];
    let usdBalance = 0;
    let pkrBalance = 0;

    for (const balance of bankBalances) {
      const debit = parseFloat(balance.total_debit);
      const credit = parseFloat(balance.total_credit);
      const netBalance = debit - credit; // For bank accounts (assets), debit increases balance

      if (balance.currency === 'USD') {
        usdBalance = netBalance;
      } else if (balance.currency === 'PKR') {
        pkrBalance = netBalance;
      }
    }

    // Add USD balance entry
    results.push({
      currency: 'USD',
      balance: usdBalance,
      balance_pkr: usdBalance * usdToPkrRate
    });

    // Add PKR balance entry
    results.push({
      currency: 'PKR',
      balance: pkrBalance,
      balance_pkr: pkrBalance
    });

    return results;
  } catch (error) {
    console.error('Failed to get dashboard balances:', error);
    throw error;
  }
}