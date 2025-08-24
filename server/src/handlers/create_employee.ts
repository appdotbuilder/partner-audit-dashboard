import { db } from '../db';
import { employeesTable, accountsTable } from '../db/schema';
import { type CreateEmployeeInput, type Employee } from '../schema';
import { eq, and } from 'drizzle-orm';

export const createEmployee = async (input: CreateEmployeeInput): Promise<Employee> => {
  try {
    // Validate that payroll account exists and is a valid payroll source account
    const payrollAccount = await db.select()
      .from(accountsTable)
      .where(
        and(
          eq(accountsTable.id, input.payroll_account_id),
          eq(accountsTable.is_payroll_source, true),
          eq(accountsTable.is_active, true)
        )
      )
      .execute();

    if (payrollAccount.length === 0) {
      throw new Error('Invalid payroll account: account must exist, be active, and be marked as a payroll source');
    }

    // Validate that payroll account currency matches employee's payroll currency
    if (payrollAccount[0].currency !== input.payroll_currency) {
      throw new Error(`Payroll account currency (${payrollAccount[0].currency}) does not match employee payroll currency (${input.payroll_currency})`);
    }

    // Insert employee record
    const result = await db.insert(employeesTable)
      .values({
        name: input.name,
        email: input.email,
        payroll_currency: input.payroll_currency,
        payroll_account_id: input.payroll_account_id
      })
      .returning()
      .execute();

    return result[0];
  } catch (error) {
    console.error('Employee creation failed:', error);
    throw error;
  }
};