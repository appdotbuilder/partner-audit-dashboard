import { db } from '../db';
import { accountsTable } from '../db/schema';
import { type CreateAccountInput, type Account } from '../schema';
import { eq } from 'drizzle-orm';

export const createAccount = async (input: CreateAccountInput): Promise<Account> => {
  try {
    // Validate account code uniqueness
    const existingAccount = await db.select()
      .from(accountsTable)
      .where(eq(accountsTable.code, input.code))
      .execute();

    if (existingAccount.length > 0) {
      throw new Error(`Account code '${input.code}' already exists`);
    }

    // Validate parent account exists if parent_id is provided
    if (input.parent_id !== null && input.parent_id !== undefined) {
      const parentAccount = await db.select()
        .from(accountsTable)
        .where(eq(accountsTable.id, input.parent_id))
        .execute();

      if (parentAccount.length === 0) {
        throw new Error(`Parent account with ID ${input.parent_id} does not exist`);
      }
    }

    // Insert account record
    const result = await db.insert(accountsTable)
      .values({
        code: input.code,
        name: input.name,
        account_type: input.account_type,
        currency: input.currency,
        is_bank: input.is_bank,
        is_capital: input.is_capital,
        is_payroll_source: input.is_payroll_source,
        is_intercompany: input.is_intercompany,
        parent_id: input.parent_id,
        is_active: input.is_active
      })
      .returning()
      .execute();

    return result[0];
  } catch (error) {
    console.error('Account creation failed:', error);
    throw error;
  }
};