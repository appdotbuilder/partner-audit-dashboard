import { db } from '../db';
import { journalsTable, journalLinesTable, accountsTable, periodsTable } from '../db/schema';
import { type TrialBalanceReport } from '../schema';
import { eq, and, desc, sum, isNull } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';

export async function getTrialBalanceReport(periodId?: number): Promise<TrialBalanceReport[]> {
  try {
    let targetPeriodId = periodId;

    // If no period specified, get the most recent period
    if (!targetPeriodId) {
      const latestPeriod = await db.select({ id: periodsTable.id })
        .from(periodsTable)
        .orderBy(desc(periodsTable.year), desc(periodsTable.month))
        .limit(1)
        .execute();

      if (latestPeriod.length === 0) {
        return [];
      }
      targetPeriodId = latestPeriod[0].id;
    }

    // Build the trial balance query - aggregate journal lines by account
    const trialBalanceData = await db.select({
      account_id: accountsTable.id,
      account_code: accountsTable.code,
      account_name: accountsTable.name,
      account_type: accountsTable.account_type,
      currency: accountsTable.currency,
      total_debit: sum(journalLinesTable.debit_amount),
      total_credit: sum(journalLinesTable.credit_amount),
      total_debit_base: sum(journalLinesTable.debit_amount_base),
      total_credit_base: sum(journalLinesTable.credit_amount_base)
    })
    .from(accountsTable)
    .innerJoin(journalLinesTable, eq(accountsTable.id, journalLinesTable.account_id))
    .innerJoin(journalsTable, eq(journalLinesTable.journal_id, journalsTable.id))
    .where(
      and(
        eq(journalsTable.period_id, targetPeriodId),
        eq(journalsTable.status, 'Posted')
      )
    )
    .groupBy(
      accountsTable.id,
      accountsTable.code,
      accountsTable.name,
      accountsTable.account_type,
      accountsTable.currency
    )
    .orderBy(accountsTable.code)
    .execute();

    // Convert the results to the expected format with proper numeric conversions
    const trialBalance: TrialBalanceReport[] = trialBalanceData.map(row => {
      const totalDebit = parseFloat(row.total_debit || '0');
      const totalCredit = parseFloat(row.total_credit || '0');
      const totalDebitBase = parseFloat(row.total_debit_base || '0');
      const totalCreditBase = parseFloat(row.total_credit_base || '0');

      // Calculate net balances
      const debitBalance = totalDebit > totalCredit ? totalDebit - totalCredit : 0;
      const creditBalance = totalCredit > totalDebit ? totalCredit - totalDebit : 0;
      const debitBalanceBase = totalDebitBase > totalCreditBase ? totalDebitBase - totalCreditBase : 0;
      const creditBalanceBase = totalCreditBase > totalDebitBase ? totalCreditBase - totalDebitBase : 0;

      return {
        account_id: row.account_id,
        account_code: row.account_code,
        account_name: row.account_name,
        account_type: row.account_type,
        currency: row.currency,
        debit_balance: debitBalance,
        credit_balance: creditBalance,
        debit_balance_base: debitBalanceBase,
        credit_balance_base: creditBalanceBase
      };
    });

    return trialBalance;
  } catch (error) {
    console.error('Trial balance report generation failed:', error);
    throw error;
  }
}