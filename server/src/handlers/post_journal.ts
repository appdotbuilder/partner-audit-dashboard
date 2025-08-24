import { db } from '../db';
import { journalsTable, journalLinesTable, periodsTable } from '../db/schema';
import { type Journal } from '../schema';
import { eq, sum } from 'drizzle-orm';

export async function postJournal(journalId: number, userId: number): Promise<Journal> {
  try {
    // First, fetch the journal to validate it exists and is in draft status
    const journals = await db.select()
      .from(journalsTable)
      .where(eq(journalsTable.id, journalId))
      .execute();

    if (journals.length === 0) {
      throw new Error(`Journal with id ${journalId} not found`);
    }

    const journal = journals[0];

    // Validate journal is in Draft status
    if (journal.status !== 'Draft') {
      throw new Error(`Journal is already posted and cannot be modified`);
    }

    // Check if the period is locked
    const periods = await db.select()
      .from(periodsTable)
      .where(eq(periodsTable.id, journal.period_id))
      .execute();

    if (periods.length === 0) {
      throw new Error(`Period with id ${journal.period_id} not found`);
    }

    const period = periods[0];
    if (period.status === 'Locked') {
      throw new Error(`Cannot post journal to locked period`);
    }

    // Fetch journal lines to validate balancing and amounts
    const journalLines = await db.select()
      .from(journalLinesTable)
      .where(eq(journalLinesTable.journal_id, journalId))
      .execute();

    if (journalLines.length === 0) {
      throw new Error(`Journal must have at least one journal line`);
    }

    // Calculate totals for validation
    let totalDebit = 0;
    let totalCredit = 0;
    let totalDebitBase = 0;
    let totalCreditBase = 0;

    for (const line of journalLines) {
      const debitAmount = parseFloat(line.debit_amount);
      const creditAmount = parseFloat(line.credit_amount);
      const debitAmountBase = parseFloat(line.debit_amount_base);
      const creditAmountBase = parseFloat(line.credit_amount_base);

      totalDebit += debitAmount;
      totalCredit += creditAmount;
      totalDebitBase += debitAmountBase;
      totalCreditBase += creditAmountBase;

      // Validate that each line has either debit or credit (but not both)
      if (debitAmount > 0 && creditAmount > 0) {
        throw new Error(`Journal line ${line.line_number} cannot have both debit and credit amounts`);
      }

      if (debitAmount === 0 && creditAmount === 0) {
        throw new Error(`Journal line ${line.line_number} must have either debit or credit amount`);
      }

      // Validate that base currency amounts are present
      if (debitAmount > 0 && debitAmountBase === 0) {
        throw new Error(`Journal line ${line.line_number} missing base currency debit amount`);
      }

      if (creditAmount > 0 && creditAmountBase === 0) {
        throw new Error(`Journal line ${line.line_number} missing base currency credit amount`);
      }
    }

    // Validate journal is balanced
    const tolerance = 0.01; // Allow small rounding differences
    if (Math.abs(totalDebit - totalCredit) > tolerance) {
      throw new Error(`Journal is not balanced: total debits ${totalDebit.toFixed(2)} != total credits ${totalCredit.toFixed(2)}`);
    }

    if (Math.abs(totalDebitBase - totalCreditBase) > tolerance) {
      throw new Error(`Journal is not balanced in base currency: total debits ${totalDebitBase.toFixed(2)} != total credits ${totalCreditBase.toFixed(2)}`);
    }

    // Post the journal - update status, totals, posted_by, and posted_at
    const result = await db.update(journalsTable)
      .set({
        status: 'Posted',
        total_debit: totalDebit.toString(),
        total_credit: totalCredit.toString(),
        posted_by: userId,
        posted_at: new Date(),
        updated_at: new Date()
      })
      .where(eq(journalsTable.id, journalId))
      .returning()
      .execute();

    const postedJournal = result[0];
    return {
      ...postedJournal,
      journal_date: new Date(postedJournal.journal_date),
      total_debit: parseFloat(postedJournal.total_debit),
      total_credit: parseFloat(postedJournal.total_credit)
    };
  } catch (error) {
    console.error('Journal posting failed:', error);
    throw error;
  }
}