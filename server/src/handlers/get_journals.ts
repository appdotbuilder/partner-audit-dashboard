import { db } from '../db';
import { journalsTable, periodsTable, fxRatesTable, journalLinesTable } from '../db/schema';
import { type Journal } from '../schema';
import { eq, and, gte, lte, desc, SQL } from 'drizzle-orm';

export interface GetJournalsFilters {
  period_id?: number;
  status?: 'Draft' | 'Posted';
  date_from?: string;
  date_to?: string;
  limit?: number;
  offset?: number;
}

export const getJournals = async (filters: GetJournalsFilters = {}): Promise<Journal[]> => {
  try {
    // Build conditions array
    const conditions: SQL<unknown>[] = [];

    if (filters.period_id !== undefined) {
      conditions.push(eq(journalsTable.period_id, filters.period_id));
    }

    if (filters.status) {
      conditions.push(eq(journalsTable.status, filters.status));
    }

    if (filters.date_from) {
      conditions.push(gte(journalsTable.journal_date, filters.date_from));
    }

    if (filters.date_to) {
      conditions.push(lte(journalsTable.journal_date, filters.date_to));
    }

    // Apply pagination
    const limit = filters.limit ?? 50;
    const offset = filters.offset ?? 0;

    // Build and execute query without reassignment
    const baseQuery = db.select().from(journalsTable);
    
    const results = conditions.length > 0
      ? await baseQuery
          .where(conditions.length === 1 ? conditions[0] : and(...conditions))
          .orderBy(desc(journalsTable.journal_date), desc(journalsTable.id))
          .limit(limit)
          .offset(offset)
      : await baseQuery
          .orderBy(desc(journalsTable.journal_date), desc(journalsTable.id))
          .limit(limit)
          .offset(offset);

    // Convert numeric fields back to numbers and dates to Date objects
    return results.map(journal => ({
      ...journal,
      journal_date: new Date(journal.journal_date),
      total_debit: parseFloat(journal.total_debit),
      total_credit: parseFloat(journal.total_credit),
      posted_at: journal.posted_at ? new Date(journal.posted_at) : null,
      created_at: new Date(journal.created_at),
      updated_at: new Date(journal.updated_at)
    }));
  } catch (error) {
    console.error('Failed to fetch journals:', error);
    throw error;
  }
};