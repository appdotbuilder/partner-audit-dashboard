import { db } from '../db';
import { fxRatesTable, periodsTable } from '../db/schema';
import { type CreateFxRateInput, type FxRate } from '../schema';
import { eq, and, SQL } from 'drizzle-orm';

export const createFxRate = async (input: CreateFxRateInput, userId: number): Promise<FxRate> => {
  try {
    // Convert date to string format for database comparison
    const effectiveDateString = input.effective_date.toISOString().split('T')[0];
    
    // Check if a rate already exists for the same date and currency pair
    const existingRate = await db.select()
      .from(fxRatesTable)
      .where(
        and(
          eq(fxRatesTable.from_currency, input.from_currency),
          eq(fxRatesTable.to_currency, input.to_currency),
          eq(fxRatesTable.effective_date, effectiveDateString)
        )
      )
      .execute();

    if (existingRate.length > 0) {
      throw new Error(`FX rate already exists for ${input.from_currency}/${input.to_currency} on ${effectiveDateString}`);
    }

    // Validate that the effective date falls within an existing period
    const effectiveDate = new Date(input.effective_date);
    const year = effectiveDate.getFullYear();
    const month = effectiveDate.getMonth() + 1; // JavaScript months are 0-indexed

    const period = await db.select()
      .from(periodsTable)
      .where(
        and(
          eq(periodsTable.year, year),
          eq(periodsTable.month, month)
        )
      )
      .execute();

    if (period.length === 0) {
      throw new Error(`No accounting period found for ${year}-${month.toString().padStart(2, '0')}`);
    }

    // Check if the period is locked and the rate is being set as locked
    if (period[0].status === 'Locked' && input.is_locked) {
      throw new Error(`Cannot create locked FX rate for a locked period ${year}-${month.toString().padStart(2, '0')}`);
    }

    // Insert FX rate record
    const result = await db.insert(fxRatesTable)
      .values({
        from_currency: input.from_currency,
        to_currency: input.to_currency,
        rate: input.rate.toString(), // Convert number to string for numeric column
        effective_date: effectiveDateString, // Use string format for date column
        is_locked: input.is_locked,
        created_by: userId
      })
      .returning()
      .execute();

    // Convert numeric and date fields back to proper types before returning
    const fxRate = result[0];
    return {
      ...fxRate,
      rate: parseFloat(fxRate.rate), // Convert string back to number
      effective_date: new Date(fxRate.effective_date) // Convert string back to Date
    };
  } catch (error) {
    console.error('FX rate creation failed:', error);
    throw error;
  }
};