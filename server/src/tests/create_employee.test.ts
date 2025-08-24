import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { employeesTable, accountsTable } from '../db/schema';
import { type CreateEmployeeInput } from '../schema';
import { createEmployee } from '../handlers/create_employee';
import { eq } from 'drizzle-orm';

// Create test payroll account first
const setupPayrollAccount = async (currency: 'USD' | 'PKR') => {
  const result = await db.insert(accountsTable)
    .values({
      code: `PAYROLL-${currency}`,
      name: `${currency} Payroll Account`,
      account_type: 'Expense',
      currency: currency,
      is_bank: false,
      is_capital: false,
      is_payroll_source: true, // This is key - must be payroll source
      is_intercompany: false,
      parent_id: null,
      is_active: true
    })
    .returning()
    .execute();
  
  return result[0];
};

// Simple test input
const testInput: CreateEmployeeInput = {
  name: 'John Doe',
  email: 'john.doe@company.com',
  payroll_currency: 'USD',
  payroll_account_id: 0 // Will be set in tests
};

describe('createEmployee', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should create an employee with valid payroll account', async () => {
    // Setup prerequisite payroll account
    const payrollAccount = await setupPayrollAccount('USD');
    
    const input = {
      ...testInput,
      payroll_account_id: payrollAccount.id
    };

    const result = await createEmployee(input);

    // Basic field validation
    expect(result.name).toEqual('John Doe');
    expect(result.email).toEqual('john.doe@company.com');
    expect(result.payroll_currency).toEqual('USD');
    expect(result.payroll_account_id).toEqual(payrollAccount.id);
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should save employee to database', async () => {
    // Setup prerequisite payroll account
    const payrollAccount = await setupPayrollAccount('PKR');
    
    const input = {
      ...testInput,
      payroll_currency: 'PKR' as const,
      payroll_account_id: payrollAccount.id
    };

    const result = await createEmployee(input);

    // Query using proper drizzle syntax
    const employees = await db.select()
      .from(employeesTable)
      .where(eq(employeesTable.id, result.id))
      .execute();

    expect(employees).toHaveLength(1);
    expect(employees[0].name).toEqual('John Doe');
    expect(employees[0].email).toEqual('john.doe@company.com');
    expect(employees[0].payroll_currency).toEqual('PKR');
    expect(employees[0].payroll_account_id).toEqual(payrollAccount.id);
    expect(employees[0].created_at).toBeInstanceOf(Date);
    expect(employees[0].updated_at).toBeInstanceOf(Date);
  });

  it('should create employee with null email', async () => {
    // Setup prerequisite payroll account
    const payrollAccount = await setupPayrollAccount('USD');
    
    const input = {
      ...testInput,
      email: null,
      payroll_account_id: payrollAccount.id
    };

    const result = await createEmployee(input);

    expect(result.name).toEqual('John Doe');
    expect(result.email).toBeNull();
    expect(result.payroll_currency).toEqual('USD');
    expect(result.payroll_account_id).toEqual(payrollAccount.id);
  });

  it('should reject non-existent payroll account', async () => {
    const input = {
      ...testInput,
      payroll_account_id: 99999 // Non-existent account
    };

    await expect(createEmployee(input)).rejects.toThrow(/Invalid payroll account/i);
  });

  it('should reject account that is not marked as payroll source', async () => {
    // Create a regular account (not payroll source)
    const regularAccount = await db.insert(accountsTable)
      .values({
        code: 'REGULAR-001',
        name: 'Regular Account',
        account_type: 'Asset',
        currency: 'USD',
        is_bank: false,
        is_capital: false,
        is_payroll_source: false, // Not a payroll source
        is_intercompany: false,
        parent_id: null,
        is_active: true
      })
      .returning()
      .execute();

    const input = {
      ...testInput,
      payroll_account_id: regularAccount[0].id
    };

    await expect(createEmployee(input)).rejects.toThrow(/Invalid payroll account.*payroll source/i);
  });

  it('should reject inactive payroll account', async () => {
    // Create an inactive payroll account
    const inactiveAccount = await db.insert(accountsTable)
      .values({
        code: 'INACTIVE-PAYROLL',
        name: 'Inactive Payroll Account',
        account_type: 'Expense',
        currency: 'USD',
        is_bank: false,
        is_capital: false,
        is_payroll_source: true,
        is_intercompany: false,
        parent_id: null,
        is_active: false // Inactive account
      })
      .returning()
      .execute();

    const input = {
      ...testInput,
      payroll_account_id: inactiveAccount[0].id
    };

    await expect(createEmployee(input)).rejects.toThrow(/Invalid payroll account.*be active/i);
  });

  it('should reject payroll account with mismatched currency', async () => {
    // Create USD payroll account but try to use with PKR employee
    const usdPayrollAccount = await setupPayrollAccount('USD');
    
    const input = {
      ...testInput,
      payroll_currency: 'PKR' as const,
      payroll_account_id: usdPayrollAccount.id
    };

    await expect(createEmployee(input)).rejects.toThrow(/currency.*does not match/i);
  });

  it('should handle PKR currency correctly', async () => {
    // Setup PKR payroll account
    const pkrPayrollAccount = await setupPayrollAccount('PKR');
    
    const input = {
      ...testInput,
      name: 'Ahmad Ali',
      email: 'ahmad.ali@company.com',
      payroll_currency: 'PKR' as const,
      payroll_account_id: pkrPayrollAccount.id
    };

    const result = await createEmployee(input);

    expect(result.name).toEqual('Ahmad Ali');
    expect(result.email).toEqual('ahmad.ali@company.com');
    expect(result.payroll_currency).toEqual('PKR');
    expect(result.payroll_account_id).toEqual(pkrPayrollAccount.id);
    
    // Verify in database
    const employees = await db.select()
      .from(employeesTable)
      .where(eq(employeesTable.id, result.id))
      .execute();

    expect(employees[0].payroll_currency).toEqual('PKR');
  });

  it('should validate account existence and properties in single query', async () => {
    // Create multiple accounts with different properties
    await db.insert(accountsTable)
      .values([
        {
          code: 'BANK-001',
          name: 'Bank Account',
          account_type: 'Asset',
          currency: 'USD',
          is_bank: true,
          is_capital: false,
          is_payroll_source: false,
          is_intercompany: false,
          parent_id: null,
          is_active: true
        },
        {
          code: 'PAYROLL-VALID',
          name: 'Valid Payroll Account',
          account_type: 'Expense',
          currency: 'USD',
          is_bank: false,
          is_capital: false,
          is_payroll_source: true,
          is_intercompany: false,
          parent_id: null,
          is_active: true
        }
      ])
      .execute();

    // Get the valid payroll account
    const validAccount = await db.select()
      .from(accountsTable)
      .where(eq(accountsTable.code, 'PAYROLL-VALID'))
      .execute();

    const input = {
      ...testInput,
      payroll_account_id: validAccount[0].id
    };

    const result = await createEmployee(input);
    expect(result.payroll_account_id).toEqual(validAccount[0].id);
  });
});