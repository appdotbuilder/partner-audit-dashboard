import { db } from '../db';
import { journalLinesTable, journalsTable, accountsTable } from '../db/schema';
import { type GeneralLedgerReport } from '../schema';
import { eq, and, gte, lte, asc, SQL } from 'drizzle-orm';

export async function getGeneralLedgerReport(accountId?: number, fromDate?: Date, toDate?: Date): Promise<GeneralLedgerReport[]> {
  try {
    // Build base query
    const baseQuery = db.select({
      account_id: accountsTable.id,
      account_code: accountsTable.code,
      account_name: accountsTable.name,
      journal_date: journalsTable.journal_date,
      journal_reference: journalsTable.reference,
      description: journalLinesTable.description,
      debit_amount: journalLinesTable.debit_amount,
      credit_amount: journalLinesTable.credit_amount,
      line_number: journalLinesTable.line_number
    })
    .from(journalLinesTable)
    .innerJoin(journalsTable, eq(journalLinesTable.journal_id, journalsTable.id))
    .innerJoin(accountsTable, eq(journalLinesTable.account_id, accountsTable.id));

    // Build conditions array
    const conditions: SQL<unknown>[] = [];

    if (accountId !== undefined) {
      conditions.push(eq(accountsTable.id, accountId));
    }

    if (fromDate !== undefined) {
      // Convert Date to ISO date string for comparison with database date field
      const fromDateStr = fromDate.toISOString().split('T')[0];
      conditions.push(gte(journalsTable.journal_date, fromDateStr));
    }

    if (toDate !== undefined) {
      // Convert Date to ISO date string for comparison with database date field  
      const toDateStr = toDate.toISOString().split('T')[0];
      conditions.push(lte(journalsTable.journal_date, toDateStr));
    }

    // Build final query with all conditions and ordering
    const finalQuery = conditions.length > 0
      ? baseQuery
          .where(conditions.length === 1 ? conditions[0] : and(...conditions))
          .orderBy(
            asc(accountsTable.id),
            asc(journalsTable.journal_date),
            asc(journalLinesTable.line_number)
          )
      : baseQuery
          .orderBy(
            asc(accountsTable.id),
            asc(journalsTable.journal_date),
            asc(journalLinesTable.line_number)
          );

    const results = await finalQuery.execute();

    // Calculate running balances for each account
    const reportData: GeneralLedgerReport[] = [];
    const accountBalances: Record<number, number> = {};

    for (const result of results) {
      // Initialize account balance if not exists
      if (!(result.account_id in accountBalances)) {
        accountBalances[result.account_id] = 0;
      }

      // Calculate net amount for this line (debit - credit)
      const debitAmount = parseFloat(result.debit_amount);
      const creditAmount = parseFloat(result.credit_amount);
      const netAmount = debitAmount - creditAmount;

      // Update running balance
      accountBalances[result.account_id] += netAmount;

      // Add to report data
      reportData.push({
        account_id: result.account_id,
        account_code: result.account_code,
        account_name: result.account_name,
        journal_date: new Date(result.journal_date), // Convert string to Date
        journal_reference: result.journal_reference,
        description: result.description,
        debit_amount: debitAmount,
        credit_amount: creditAmount,
        running_balance: accountBalances[result.account_id]
      });
    }

    return reportData;
  } catch (error) {
    console.error('General ledger report generation failed:', error);
    throw error;
  }
}