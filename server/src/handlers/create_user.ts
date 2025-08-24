import { db } from '../db';
import { usersTable, partnersTable } from '../db/schema';
import { type CreateUserInput, type User } from '../schema';
import { eq } from 'drizzle-orm';

export const createUser = async (input: CreateUserInput): Promise<User> => {
  try {
    // Validate partner_id exists if provided
    if (input.partner_id !== null) {
      const partner = await db.select()
        .from(partnersTable)
        .where(eq(partnersTable.id, input.partner_id))
        .execute();

      if (partner.length === 0) {
        throw new Error(`Partner with id ${input.partner_id} does not exist`);
      }
    }

    // Additional validation: if role is Partner, partner_id should be provided
    if (input.role === 'Partner' && input.partner_id === null) {
      throw new Error('Partner role requires a valid partner_id');
    }

    // Insert user record
    const result = await db.insert(usersTable)
      .values({
        email: input.email,
        name: input.name,
        role: input.role,
        partner_id: input.partner_id
      })
      .returning()
      .execute();

    return result[0];
  } catch (error) {
    console.error('User creation failed:', error);
    throw error;
  }
};