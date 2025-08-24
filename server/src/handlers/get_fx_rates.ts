import { db } from '../db';
import { fxRatesTable } from '../db/schema';
import { type FxRate, type Currency } from '../schema';
import { and, eq, gte, lte, desc, type SQL } from 'drizzle-orm';

export interface GetFxRatesFilters {
  from_currency?: Currency;
  to_currency?: Currency;
  from_date?: string; // Date string in YYYY-MM-DD format
  to_date?: string;   // Date string in YYYY-MM-DD format
  is_locked?: boolean;
}

export const getFxRates = async (filters: GetFxRatesFilters = {}): Promise<FxRate[]> => {
  try {
    // Build conditions array
    const conditions: SQL<unknown>[] = [];

    if (filters.from_currency) {
      conditions.push(eq(fxRatesTable.from_currency, filters.from_currency));
    }

    if (filters.to_currency) {
      conditions.push(eq(fxRatesTable.to_currency, filters.to_currency));
    }

    if (filters.from_date) {
      conditions.push(gte(fxRatesTable.effective_date, filters.from_date));
    }

    if (filters.to_date) {
      conditions.push(lte(fxRatesTable.effective_date, filters.to_date));
    }

    if (filters.is_locked !== undefined) {
      conditions.push(eq(fxRatesTable.is_locked, filters.is_locked));
    }

    // Build complete query in one step
    const results = conditions.length === 0
      ? await db.select()
          .from(fxRatesTable)
          .orderBy(desc(fxRatesTable.effective_date))
          .execute()
      : await db.select()
          .from(fxRatesTable)
          .where(conditions.length === 1 ? conditions[0] : and(...conditions))
          .orderBy(desc(fxRatesTable.effective_date))
          .execute();

    // Convert numeric fields and date strings to proper types
    return results.map(fxRate => ({
      ...fxRate,
      rate: parseFloat(fxRate.rate),
      effective_date: new Date(fxRate.effective_date)
    }));
  } catch (error) {
    console.error('Failed to fetch FX rates:', error);
    throw error;
  }
};