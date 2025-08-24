import { db } from '../db';
import { partnersTable, capitalMovementsTable, accountsTable, journalLinesTable, journalsTable, periodsTable } from '../db/schema';
import { type DashboardPartnerCapital } from '../schema';
import { eq, and, gte, lte, sql, sum } from 'drizzle-orm';

export async function getDashboardPartnerCapital(): Promise<DashboardPartnerCapital[]> {
  try {
    // Get current date info for MTD and YTD calculations
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth() + 1;

    // Get all partners with their capital accounts
    const partners = await db.select({
      id: partnersTable.id,
      name: partnersTable.name,
      usd_account_id: partnersTable.usd_account_id,
      pkr_account_id: partnersTable.pkr_account_id
    })
    .from(partnersTable)
    .execute();

    const results: DashboardPartnerCapital[] = [];

    for (const partner of partners) {
      // Initialize capital amounts
      let capital_usd = 0;
      let capital_pkr = 0;

      // Calculate capital from USD account if exists
      if (partner.usd_account_id) {
        const usdCapitalResult = await db.select({
          balance: sql<string>`COALESCE(SUM(${journalLinesTable.credit_amount} - ${journalLinesTable.debit_amount}), 0)`
        })
        .from(journalLinesTable)
        .innerJoin(journalsTable, eq(journalLinesTable.journal_id, journalsTable.id))
        .where(
          and(
            eq(journalLinesTable.account_id, partner.usd_account_id),
            eq(journalsTable.status, 'Posted')
          )
        )
        .execute();

        if (usdCapitalResult.length > 0) {
          capital_usd = parseFloat(usdCapitalResult[0].balance);
        }
      }

      // Calculate capital from PKR account if exists
      if (partner.pkr_account_id) {
        const pkrCapitalResult = await db.select({
          balance: sql<string>`COALESCE(SUM(${journalLinesTable.credit_amount} - ${journalLinesTable.debit_amount}), 0)`
        })
        .from(journalLinesTable)
        .innerJoin(journalsTable, eq(journalLinesTable.journal_id, journalsTable.id))
        .where(
          and(
            eq(journalLinesTable.account_id, partner.pkr_account_id),
            eq(journalsTable.status, 'Posted')
          )
        )
        .execute();

        if (pkrCapitalResult.length > 0) {
          capital_pkr = parseFloat(pkrCapitalResult[0].balance);
        }
      }

      // Calculate P&L share MTD (Month-to-Date)
      const plShareMtdResult = await db.select({
        income: sql<string>`COALESCE(SUM(CASE WHEN ${accountsTable.account_type} = 'Income' THEN ${journalLinesTable.credit_amount} - ${journalLinesTable.debit_amount} ELSE 0 END), 0)`,
        expense: sql<string>`COALESCE(SUM(CASE WHEN ${accountsTable.account_type} = 'Expense' THEN ${journalLinesTable.debit_amount} - ${journalLinesTable.credit_amount} ELSE 0 END), 0)`
      })
      .from(journalLinesTable)
      .innerJoin(journalsTable, eq(journalLinesTable.journal_id, journalsTable.id))
      .innerJoin(periodsTable, eq(journalsTable.period_id, periodsTable.id))
      .innerJoin(accountsTable, eq(journalLinesTable.account_id, accountsTable.id))
      .where(
        and(
          eq(journalsTable.status, 'Posted'),
          eq(periodsTable.year, currentYear),
          eq(periodsTable.month, currentMonth)
        )
      )
      .execute();

      // Calculate P&L share YTD (Year-to-Date)
      const plShareYtdResult = await db.select({
        income: sql<string>`COALESCE(SUM(CASE WHEN ${accountsTable.account_type} = 'Income' THEN ${journalLinesTable.credit_amount} - ${journalLinesTable.debit_amount} ELSE 0 END), 0)`,
        expense: sql<string>`COALESCE(SUM(CASE WHEN ${accountsTable.account_type} = 'Expense' THEN ${journalLinesTable.debit_amount} - ${journalLinesTable.credit_amount} ELSE 0 END), 0)`
      })
      .from(journalLinesTable)
      .innerJoin(journalsTable, eq(journalLinesTable.journal_id, journalsTable.id))
      .innerJoin(periodsTable, eq(journalsTable.period_id, periodsTable.id))
      .innerJoin(accountsTable, eq(journalLinesTable.account_id, accountsTable.id))
      .where(
        and(
          eq(journalsTable.status, 'Posted'),
          eq(periodsTable.year, currentYear),
          lte(periodsTable.month, currentMonth)
        )
      )
      .execute();

      // Calculate net P&L (simplified equal partnership split)
      const totalPartners = partners.length;
      const partnershipShare = totalPartners > 0 ? 1 / totalPartners : 0;

      let pl_share_mtd = 0;
      let pl_share_ytd = 0;

      if (plShareMtdResult.length > 0) {
        const netProfitMtd = parseFloat(plShareMtdResult[0].income) - parseFloat(plShareMtdResult[0].expense);
        pl_share_mtd = netProfitMtd * partnershipShare;
      }

      if (plShareYtdResult.length > 0) {
        const netProfitYtd = parseFloat(plShareYtdResult[0].income) - parseFloat(plShareYtdResult[0].expense);
        pl_share_ytd = netProfitYtd * partnershipShare;
      }

      results.push({
        partner_id: partner.id,
        partner_name: partner.name,
        capital_usd,
        capital_pkr,
        pl_share_mtd,
        pl_share_ytd
      });
    }

    return results;
  } catch (error) {
    console.error('Dashboard partner capital calculation failed:', error);
    throw error;
  }
}