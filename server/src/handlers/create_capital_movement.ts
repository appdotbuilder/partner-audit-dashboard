import { db } from '../db';
import { capitalMovementsTable, partnersTable, journalsTable } from '../db/schema';
import { type CreateCapitalMovementInput, type CapitalMovement } from '../schema';
import { eq, and } from 'drizzle-orm';

export async function createCapitalMovement(input: CreateCapitalMovementInput): Promise<CapitalMovement> {
  try {
    // Validate that partner exists
    const partner = await db.select()
      .from(partnersTable)
      .where(eq(partnersTable.id, input.partner_id))
      .execute();

    if (partner.length === 0) {
      throw new Error(`Partner with ID ${input.partner_id} not found`);
    }

    // Validate that journal exists and is posted
    const journal = await db.select()
      .from(journalsTable)
      .where(eq(journalsTable.id, input.journal_id))
      .execute();

    if (journal.length === 0) {
      throw new Error(`Journal with ID ${input.journal_id} not found`);
    }

    if (journal[0].status !== 'Posted') {
      throw new Error(`Journal must be Posted before creating capital movements`);
    }

    // Insert capital movement record
    const result = await db.insert(capitalMovementsTable)
      .values({
        partner_id: input.partner_id,
        movement_type: input.movement_type,
        amount: input.amount.toString(), // Convert number to string for numeric column
        currency: input.currency,
        amount_base: input.amount_base.toString(), // Convert number to string for numeric column
        journal_id: input.journal_id,
        description: input.description,
        movement_date: input.movement_date.toISOString().split('T')[0] // Convert Date to YYYY-MM-DD string for date column
      })
      .returning()
      .execute();

    // Convert numeric fields back to numbers and date string to Date object
    const capitalMovement = result[0];
    return {
      ...capitalMovement,
      amount: parseFloat(capitalMovement.amount), // Convert string back to number
      amount_base: parseFloat(capitalMovement.amount_base), // Convert string back to number
      movement_date: new Date(capitalMovement.movement_date) // Convert date string to Date object
    };
  } catch (error) {
    console.error('Capital movement creation failed:', error);
    throw error;
  }
}