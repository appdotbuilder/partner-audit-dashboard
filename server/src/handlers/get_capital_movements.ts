import { db } from '../db';
import { capitalMovementsTable, partnersTable, journalsTable } from '../db/schema';
import { type CapitalMovement } from '../schema';
import { eq, and, gte, lte, desc, SQL } from 'drizzle-orm';

export interface GetCapitalMovementsFilters {
  partner_id?: number;
  start_date?: Date;
  end_date?: Date;
  movement_type?: 'Contribution' | 'Draw';
}

export const getCapitalMovements = async (filters: GetCapitalMovementsFilters = {}): Promise<CapitalMovement[]> => {
  try {
    // Build conditions array for filtering
    const conditions: SQL<unknown>[] = [];

    if (filters.partner_id !== undefined) {
      conditions.push(eq(capitalMovementsTable.partner_id, filters.partner_id));
    }

    if (filters.start_date) {
      conditions.push(gte(capitalMovementsTable.movement_date, filters.start_date.toISOString().split('T')[0]));
    }

    if (filters.end_date) {
      conditions.push(lte(capitalMovementsTable.movement_date, filters.end_date.toISOString().split('T')[0]));
    }

    if (filters.movement_type) {
      conditions.push(eq(capitalMovementsTable.movement_type, filters.movement_type));
    }

    // Build base query
    const baseQuery = db.select({
      id: capitalMovementsTable.id,
      partner_id: capitalMovementsTable.partner_id,
      movement_type: capitalMovementsTable.movement_type,
      amount: capitalMovementsTable.amount,
      currency: capitalMovementsTable.currency,
      amount_base: capitalMovementsTable.amount_base,
      journal_id: capitalMovementsTable.journal_id,
      description: capitalMovementsTable.description,
      movement_date: capitalMovementsTable.movement_date,
      created_at: capitalMovementsTable.created_at,
      updated_at: capitalMovementsTable.updated_at
    })
    .from(capitalMovementsTable)
    .innerJoin(partnersTable, eq(capitalMovementsTable.partner_id, partnersTable.id))
    .innerJoin(journalsTable, eq(capitalMovementsTable.journal_id, journalsTable.id));

    // Execute query with or without conditions
    const results = conditions.length > 0
      ? await baseQuery
          .where(conditions.length === 1 ? conditions[0] : and(...conditions))
          .orderBy(desc(capitalMovementsTable.movement_date))
          .execute()
      : await baseQuery
          .orderBy(desc(capitalMovementsTable.movement_date))
          .execute();

    // Convert numeric fields back to numbers and dates to Date objects
    return results.map(movement => ({
      ...movement,
      amount: parseFloat(movement.amount),
      amount_base: parseFloat(movement.amount_base),
      movement_date: new Date(movement.movement_date),
      created_at: new Date(movement.created_at),
      updated_at: new Date(movement.updated_at)
    }));
  } catch (error) {
    console.error('Failed to fetch capital movements:', error);
    throw error;
  }
};