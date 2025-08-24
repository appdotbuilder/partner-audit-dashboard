import { db } from '../db';
import { periodsTable, journalsTable, fxRatesTable } from '../db/schema';
import { type Period } from '../schema';
import { eq, and, gte, lte, isNull } from 'drizzle-orm';

export const closePeriod = async (periodId: number, userId: number): Promise<Period> => {
  try {
    // 1. Validate period exists and is open
    const periods = await db.select()
      .from(periodsTable)
      .where(eq(periodsTable.id, periodId))
      .execute();

    if (periods.length === 0) {
      throw new Error(`Period with ID ${periodId} not found`);
    }

    const period = periods[0];

    if (period.status === 'Locked') {
      throw new Error(`Period ${period.year}-${period.month} is already locked`);
    }

    // 2. Validate all journals in the period are posted
    const draftJournals = await db.select()
      .from(journalsTable)
      .where(
        and(
          eq(journalsTable.period_id, periodId),
          eq(journalsTable.status, 'Draft')
        )
      )
      .execute();

    if (draftJournals.length > 0) {
      throw new Error(`Cannot close period: ${draftJournals.length} draft journal(s) found. All journals must be posted before closing the period`);
    }

    // 3. Validate FX rates are locked for the period
    if (!period.fx_rate_locked) {
      // Get first and last date of the period
      const periodStartDate = new Date(period.year, period.month - 1, 1);
      const periodEndDate = new Date(period.year, period.month, 0); // Last day of the month

      // Check if there are any unlocked FX rates in the period
      const unlockedRates = await db.select()
        .from(fxRatesTable)
        .where(
          and(
            gte(fxRatesTable.effective_date, periodStartDate.toISOString().split('T')[0]),
            lte(fxRatesTable.effective_date, periodEndDate.toISOString().split('T')[0]),
            eq(fxRatesTable.is_locked, false)
          )
        )
        .execute();

      if (unlockedRates.length > 0) {
        throw new Error(`Cannot close period: ${unlockedRates.length} unlocked FX rate(s) found in the period. All FX rates must be locked before closing`);
      }
    }

    // 4. Update period status to Locked and set fx_rate_locked to true
    const result = await db.update(periodsTable)
      .set({
        status: 'Locked',
        fx_rate_locked: true,
        updated_at: new Date()
      })
      .where(eq(periodsTable.id, periodId))
      .returning()
      .execute();

    const updatedPeriod = result[0];
    
    return {
      ...updatedPeriod,
      created_at: updatedPeriod.created_at,
      updated_at: updatedPeriod.updated_at
    };
  } catch (error) {
    console.error('Period closing failed:', error);
    throw error;
  }
};