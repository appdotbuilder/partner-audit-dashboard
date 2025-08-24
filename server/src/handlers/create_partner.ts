import { db } from '../db';
import { partnersTable, accountsTable } from '../db/schema';
import { type CreatePartnerInput, type Partner } from '../schema';
import { eq } from 'drizzle-orm';

export const createPartner = async (input: CreatePartnerInput): Promise<Partner> => {
  try {
    // Validate that at least one account is provided
    if (!input.usd_account_id && !input.pkr_account_id) {
      throw new Error('At least one account (USD or PKR) must be provided');
    }

    // Validate that provided accounts exist
    if (input.usd_account_id) {
      const usdAccount = await db.select()
        .from(accountsTable)
        .where(eq(accountsTable.id, input.usd_account_id))
        .execute();
      
      if (usdAccount.length === 0) {
        throw new Error(`USD account with ID ${input.usd_account_id} not found`);
      }
    }

    if (input.pkr_account_id) {
      const pkrAccount = await db.select()
        .from(accountsTable)
        .where(eq(accountsTable.id, input.pkr_account_id))
        .execute();
      
      if (pkrAccount.length === 0) {
        throw new Error(`PKR account with ID ${input.pkr_account_id} not found`);
      }
    }

    // Insert partner record
    const result = await db.insert(partnersTable)
      .values({
        name: input.name,
        usd_account_id: input.usd_account_id,
        pkr_account_id: input.pkr_account_id
      })
      .returning()
      .execute();

    return result[0];
  } catch (error) {
    console.error('Partner creation failed:', error);
    throw error;
  }
};