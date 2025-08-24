import { db } from '../db';
import { periodsTable } from '../db/schema';
import { type CreatePeriodInput, type Period } from '../schema';
import { eq, and, desc, SQL } from 'drizzle-orm';

export const createPeriod = async (input: CreatePeriodInput): Promise<Period> => {
  try {
    // Check if period already exists for this year/month combination
    const existingPeriod = await db.select()
      .from(periodsTable)
      .where(and(
        eq(periodsTable.year, input.year),
        eq(periodsTable.month, input.month)
      ))
      .execute();

    if (existingPeriod.length > 0) {
      throw new Error(`Period for ${input.year}-${String(input.month).padStart(2, '0')} already exists`);
    }

    // Validate sequential period creation (can't skip months)
    // Get the latest existing period
    const latestPeriod = await db.select()
      .from(periodsTable)
      .orderBy(desc(periodsTable.year), desc(periodsTable.month))
      .limit(1)
      .execute();

    if (latestPeriod.length > 0) {
      const latest = latestPeriod[0];
      let expectedNextYear = latest.year;
      let expectedNextMonth = latest.month + 1;

      // Handle year rollover
      if (expectedNextMonth > 12) {
        expectedNextYear += 1;
        expectedNextMonth = 1;
      }

      // Check if trying to create a non-sequential period
      if (input.year !== expectedNextYear || input.month !== expectedNextMonth) {
        throw new Error(`Periods must be created sequentially. Expected next period: ${expectedNextYear}-${String(expectedNextMonth).padStart(2, '0')}, but got: ${input.year}-${String(input.month).padStart(2, '0')}`);
      }
    } else {
      // If no periods exist, this is the first period - no validation needed
      console.log('Creating first period in the system');
    }

    // Insert the new period
    const result = await db.insert(periodsTable)
      .values({
        year: input.year,
        month: input.month,
        status: input.status,
        fx_rate_locked: input.fx_rate_locked
      })
      .returning()
      .execute();

    return result[0];
  } catch (error) {
    console.error('Period creation failed:', error);
    throw error;
  }
};