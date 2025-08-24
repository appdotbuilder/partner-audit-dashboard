import { db } from '../db';
import { periodsTable } from '../db/schema';
import { type Period, type PeriodStatus } from '../schema';
import { desc, eq, and, SQL } from 'drizzle-orm';

export interface GetPeriodsFilters {
  status?: PeriodStatus;
  year?: number;
}

export const getPeriods = async (filters?: GetPeriodsFilters): Promise<Period[]> => {
  try {
    // Build conditions array
    const conditions: SQL<unknown>[] = [];

    if (filters?.status) {
      conditions.push(eq(periodsTable.status, filters.status));
    }

    if (filters?.year) {
      conditions.push(eq(periodsTable.year, filters.year));
    }

    // Build query with all clauses at once
    const baseQuery = db.select().from(periodsTable);
    
    const query = conditions.length > 0
      ? baseQuery
          .where(conditions.length === 1 ? conditions[0] : and(...conditions))
          .orderBy(desc(periodsTable.year), desc(periodsTable.month))
      : baseQuery
          .orderBy(desc(periodsTable.year), desc(periodsTable.month));

    const results = await query.execute();

    // Return with proper type conversion (no numeric fields in periods table)
    return results;
  } catch (error) {
    console.error('Failed to fetch periods:', error);
    throw error;
  }
};