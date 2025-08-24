import { db } from '../db';
import { journalLinesTable, accountsTable } from '../db/schema';
import { type JournalLine } from '../schema';
import { eq, asc } from 'drizzle-orm';

export async function getJournalLines(journalId: number): Promise<JournalLine[]> {
  try {
    const results = await db.select()
      .from(journalLinesTable)
      .where(eq(journalLinesTable.journal_id, journalId))
      .orderBy(asc(journalLinesTable.line_number))
      .execute();

    // Convert numeric fields back to numbers for all journal lines
    return results.map(line => ({
      ...line,
      debit_amount: parseFloat(line.debit_amount),
      credit_amount: parseFloat(line.credit_amount),
      debit_amount_base: parseFloat(line.debit_amount_base),
      credit_amount_base: parseFloat(line.credit_amount_base)
    }));
  } catch (error) {
    console.error('Failed to fetch journal lines:', error);
    throw error;
  }
}