import { db } from '../db';
import { journalsTable, periodsTable, fxRatesTable } from '../db/schema';
import { type CreateJournalInput, type Journal } from '../schema';
import { eq, and } from 'drizzle-orm';

export const createJournal = async (input: CreateJournalInput, userId: number): Promise<Journal> => {
  try {
    // Validate that the period exists and is open
    const period = await db.select()
      .from(periodsTable)
      .where(eq(periodsTable.id, input.period_id))
      .execute();

    if (period.length === 0) {
      throw new Error('Period not found');
    }

    if (period[0].status === 'Locked') {
      throw new Error('Cannot create journal entry in locked period');
    }

    // Validate FX rate if provided
    if (input.fx_rate_id) {
      const fxRate = await db.select()
        .from(fxRatesTable)
        .where(eq(fxRatesTable.id, input.fx_rate_id))
        .execute();

      if (fxRate.length === 0) {
        throw new Error('FX rate not found');
      }
    }

    // Check reference uniqueness within the period
    const existingJournal = await db.select()
      .from(journalsTable)
      .where(and(
        eq(journalsTable.reference, input.reference),
        eq(journalsTable.period_id, input.period_id)
      ))
      .execute();

    if (existingJournal.length > 0) {
      throw new Error('Journal reference must be unique within the period');
    }

    // Insert journal record
    const result = await db.insert(journalsTable)
      .values({
        reference: input.reference,
        description: input.description,
        journal_date: input.journal_date.toISOString().split('T')[0], // Convert Date to YYYY-MM-DD string
        period_id: input.period_id,
        status: 'Draft',
        total_debit: '0', // Convert number to string for numeric column
        total_credit: '0', // Convert number to string for numeric column
        fx_rate_id: input.fx_rate_id,
        created_by: userId,
        posted_by: null,
        posted_at: null
      })
      .returning()
      .execute();

    // Convert numeric and date fields back to proper types before returning
    const journal = result[0];
    return {
      ...journal,
      journal_date: new Date(journal.journal_date), // Convert string back to Date
      total_debit: parseFloat(journal.total_debit), // Convert string back to number
      total_credit: parseFloat(journal.total_credit) // Convert string back to number
    };
  } catch (error) {
    console.error('Journal creation failed:', error);
    throw error;
  }
};