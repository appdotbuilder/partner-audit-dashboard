import { db } from '../db';
import { partnersTable } from '../db/schema';
import { type Partner } from '../schema';

export const getPartners = async (): Promise<Partner[]> => {
  try {
    // Fetch all partners from the database
    const results = await db.select()
      .from(partnersTable)
      .execute();

    // Return partners (no numeric conversions needed for this table)
    return results;
  } catch (error) {
    console.error('Failed to fetch partners:', error);
    throw error;
  }
};