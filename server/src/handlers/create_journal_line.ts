import { db } from '../db';
import { journalLinesTable, journalsTable, accountsTable, fxRatesTable } from '../db/schema';
import { type CreateJournalLineInput, type JournalLine } from '../schema';
import { eq, and } from 'drizzle-orm';

export const createJournalLine = async (input: CreateJournalLineInput): Promise<JournalLine> => {
  try {
    // Validate that both debit and credit amounts are not non-zero at the same time
    if (input.debit_amount > 0 && input.credit_amount > 0) {
      throw new Error('Journal line cannot have both debit and credit amounts');
    }

    // Validate that at least one amount is non-zero
    if (input.debit_amount === 0 && input.credit_amount === 0) {
      throw new Error('Journal line must have either debit or credit amount greater than zero');
    }

    // Validate that journal exists and is in Draft status
    const journalQuery = await db.select()
      .from(journalsTable)
      .leftJoin(fxRatesTable, eq(journalsTable.fx_rate_id, fxRatesTable.id))
      .where(eq(journalsTable.id, input.journal_id))
      .execute();

    if (journalQuery.length === 0) {
      throw new Error('Journal not found');
    }

    const journal = journalQuery[0].journals;
    if (journal.status !== 'Draft') {
      throw new Error('Cannot add lines to a posted journal');
    }

    // Validate that account exists and is active
    const accountQuery = await db.select()
      .from(accountsTable)
      .where(and(
        eq(accountsTable.id, input.account_id),
        eq(accountsTable.is_active, true)
      ))
      .execute();

    if (accountQuery.length === 0) {
      throw new Error('Account not found or inactive');
    }

    const account = accountQuery[0];
    const fxRate = journalQuery[0].fx_rates;

    // Calculate base currency amounts if they're not provided
    let debitAmountBase = input.debit_amount_base;
    let creditAmountBase = input.credit_amount_base;

    // If journal has FX rate and account currency differs from base, calculate base amounts
    if (fxRate && account.currency !== 'PKR') {
      const rate = parseFloat(fxRate.rate);
      if (input.debit_amount > 0) {
        debitAmountBase = input.debit_amount * rate;
      }
      if (input.credit_amount > 0) {
        creditAmountBase = input.credit_amount * rate;
      }
    } else {
      // If no FX conversion needed, base amounts should match original amounts
      debitAmountBase = input.debit_amount;
      creditAmountBase = input.credit_amount;
    }

    // Insert the journal line
    const result = await db.insert(journalLinesTable)
      .values({
        journal_id: input.journal_id,
        account_id: input.account_id,
        description: input.description,
        debit_amount: input.debit_amount.toString(),
        credit_amount: input.credit_amount.toString(),
        debit_amount_base: debitAmountBase.toString(),
        credit_amount_base: creditAmountBase.toString(),
        line_number: input.line_number
      })
      .returning()
      .execute();

    const journalLine = result[0];
    return {
      ...journalLine,
      debit_amount: parseFloat(journalLine.debit_amount),
      credit_amount: parseFloat(journalLine.credit_amount),
      debit_amount_base: parseFloat(journalLine.debit_amount_base),
      credit_amount_base: parseFloat(journalLine.credit_amount_base)
    };
  } catch (error) {
    console.error('Journal line creation failed:', error);
    throw error;
  }
};