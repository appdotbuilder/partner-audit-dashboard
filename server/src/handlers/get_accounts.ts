import { db } from '../db';
import { accountsTable } from '../db/schema';
import { type Account, currencySchema, accountTypeSchema } from '../schema';
import { eq, and, isNull, SQL } from 'drizzle-orm';
import { z } from 'zod';

export const getAccountsInputSchema = z.object({
  currency: currencySchema.optional(),
  account_type: accountTypeSchema.optional(),
  is_bank: z.boolean().optional(),
  is_capital: z.boolean().optional(),
  is_payroll_source: z.boolean().optional(),
  is_intercompany: z.boolean().optional(),
  is_active: z.boolean().optional(),
  parent_id: z.number().nullable().optional()
});
export type GetAccountsInput = z.infer<typeof getAccountsInputSchema>;

export const getAccounts = async (input: GetAccountsInput = {}): Promise<Account[]> => {
  try {
    // Build conditions array for filtering
    const conditions: SQL<unknown>[] = [];

    if (input.currency !== undefined) {
      conditions.push(eq(accountsTable.currency, input.currency));
    }

    if (input.account_type !== undefined) {
      conditions.push(eq(accountsTable.account_type, input.account_type));
    }

    if (input.is_bank !== undefined) {
      conditions.push(eq(accountsTable.is_bank, input.is_bank));
    }

    if (input.is_capital !== undefined) {
      conditions.push(eq(accountsTable.is_capital, input.is_capital));
    }

    if (input.is_payroll_source !== undefined) {
      conditions.push(eq(accountsTable.is_payroll_source, input.is_payroll_source));
    }

    if (input.is_intercompany !== undefined) {
      conditions.push(eq(accountsTable.is_intercompany, input.is_intercompany));
    }

    if (input.is_active !== undefined) {
      conditions.push(eq(accountsTable.is_active, input.is_active));
    }

    if (input.parent_id !== undefined) {
      if (input.parent_id === null) {
        conditions.push(isNull(accountsTable.parent_id));
      } else {
        conditions.push(eq(accountsTable.parent_id, input.parent_id));
      }
    }

    // Build and execute query based on conditions
    let results;
    if (conditions.length === 0) {
      results = await db.select().from(accountsTable).execute();
    } else if (conditions.length === 1) {
      results = await db.select().from(accountsTable).where(conditions[0]).execute();
    } else {
      results = await db.select().from(accountsTable).where(and(...conditions)).execute();
    }

    // Return accounts with proper type conversion
    return results.map(account => ({
      ...account,
      // Note: All fields are already in the correct format from the database
      // No numeric conversions needed as this table doesn't have numeric() columns
    }));
  } catch (error) {
    console.error('Accounts retrieval failed:', error);
    throw error;
  }
};