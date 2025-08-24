import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { accountsTable } from '../db/schema';
import { type CreateAccountInput } from '../schema';
import { createAccount } from '../handlers/create_account';
import { eq } from 'drizzle-orm';

// Test input with all required fields
const testInput: CreateAccountInput = {
  code: 'TEST001',
  name: 'Test Account',
  account_type: 'Asset',
  currency: 'USD',
  is_bank: false,
  is_capital: false,
  is_payroll_source: false,
  is_intercompany: false,
  parent_id: null,
  is_active: true
};

describe('createAccount', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should create an account with all fields', async () => {
    const result = await createAccount(testInput);

    // Validate all fields
    expect(result.code).toEqual('TEST001');
    expect(result.name).toEqual('Test Account');
    expect(result.account_type).toEqual('Asset');
    expect(result.currency).toEqual('USD');
    expect(result.is_bank).toEqual(false);
    expect(result.is_capital).toEqual(false);
    expect(result.is_payroll_source).toEqual(false);
    expect(result.is_intercompany).toEqual(false);
    expect(result.parent_id).toBeNull();
    expect(result.is_active).toEqual(true);
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should save account to database', async () => {
    const result = await createAccount(testInput);

    // Verify account was saved in database
    const accounts = await db.select()
      .from(accountsTable)
      .where(eq(accountsTable.id, result.id))
      .execute();

    expect(accounts).toHaveLength(1);
    expect(accounts[0].code).toEqual('TEST001');
    expect(accounts[0].name).toEqual('Test Account');
    expect(accounts[0].account_type).toEqual('Asset');
    expect(accounts[0].currency).toEqual('USD');
    expect(accounts[0].is_bank).toEqual(false);
    expect(accounts[0].is_capital).toEqual(false);
    expect(accounts[0].is_payroll_source).toEqual(false);
    expect(accounts[0].is_intercompany).toEqual(false);
    expect(accounts[0].parent_id).toBeNull();
    expect(accounts[0].is_active).toEqual(true);
    expect(accounts[0].created_at).toBeInstanceOf(Date);
    expect(accounts[0].updated_at).toBeInstanceOf(Date);
  });

  it('should create account with parent_id reference', async () => {
    // First create a parent account
    const parentAccount = await createAccount({
      code: 'PARENT001',
      name: 'Parent Account',
      account_type: 'Asset',
      currency: 'USD',
      is_bank: false,
      is_capital: false,
      is_payroll_source: false,
      is_intercompany: false,
      parent_id: null,
      is_active: true
    });

    // Create child account with parent reference
    const childInput: CreateAccountInput = {
      ...testInput,
      code: 'CHILD001',
      name: 'Child Account',
      parent_id: parentAccount.id
    };

    const result = await createAccount(childInput);

    expect(result.parent_id).toEqual(parentAccount.id);
    expect(result.code).toEqual('CHILD001');
    expect(result.name).toEqual('Child Account');

    // Verify in database
    const accounts = await db.select()
      .from(accountsTable)
      .where(eq(accountsTable.id, result.id))
      .execute();

    expect(accounts[0].parent_id).toEqual(parentAccount.id);
  });

  it('should create account with special flags enabled', async () => {
    const specialInput: CreateAccountInput = {
      code: 'SPECIAL001',
      name: 'Special Account',
      account_type: 'Asset',
      currency: 'USD',
      is_bank: true,
      is_capital: true,
      is_payroll_source: true,
      is_intercompany: true,
      parent_id: null,
      is_active: true
    };

    const result = await createAccount(specialInput);

    expect(result.is_bank).toEqual(true);
    expect(result.is_capital).toEqual(true);
    expect(result.is_payroll_source).toEqual(true);
    expect(result.is_intercompany).toEqual(true);

    // Verify in database
    const accounts = await db.select()
      .from(accountsTable)
      .where(eq(accountsTable.id, result.id))
      .execute();

    expect(accounts[0].is_bank).toEqual(true);
    expect(accounts[0].is_capital).toEqual(true);
    expect(accounts[0].is_payroll_source).toEqual(true);
    expect(accounts[0].is_intercompany).toEqual(true);
  });

  it('should create account with PKR currency', async () => {
    const pkrInput: CreateAccountInput = {
      ...testInput,
      code: 'PKR001',
      currency: 'PKR'
    };

    const result = await createAccount(pkrInput);

    expect(result.currency).toEqual('PKR');
    expect(result.code).toEqual('PKR001');
  });

  it('should create account with different account types', async () => {
    const accountTypes = ['Asset', 'Liability', 'Equity', 'Income', 'Expense', 'Other'] as const;

    for (const accountType of accountTypes) {
      const input: CreateAccountInput = {
        ...testInput,
        code: `TYPE_${accountType}`,
        account_type: accountType
      };

      const result = await createAccount(input);

      expect(result.account_type).toEqual(accountType);
      expect(result.code).toEqual(`TYPE_${accountType}`);
    }
  });

  it('should reject duplicate account codes', async () => {
    // Create first account
    await createAccount(testInput);

    // Try to create another account with same code
    await expect(createAccount(testInput)).rejects.toThrow(/already exists/i);
  });

  it('should reject invalid parent_id', async () => {
    const invalidParentInput: CreateAccountInput = {
      ...testInput,
      code: 'INVALID001',
      parent_id: 99999 // Non-existent parent ID
    };

    await expect(createAccount(invalidParentInput)).rejects.toThrow(/does not exist/i);
  });

  it('should create inactive account', async () => {
    const inactiveInput: CreateAccountInput = {
      ...testInput,
      code: 'INACTIVE001',
      is_active: false
    };

    const result = await createAccount(inactiveInput);

    expect(result.is_active).toEqual(false);

    // Verify in database
    const accounts = await db.select()
      .from(accountsTable)
      .where(eq(accountsTable.id, result.id))
      .execute();

    expect(accounts[0].is_active).toEqual(false);
  });

  it('should handle multiple accounts with different codes', async () => {
    const accounts = [
      { ...testInput, code: 'MULTI001', name: 'Multi Account 1' },
      { ...testInput, code: 'MULTI002', name: 'Multi Account 2' },
      { ...testInput, code: 'MULTI003', name: 'Multi Account 3' }
    ];

    const results = await Promise.all(
      accounts.map(account => createAccount(account))
    );

    expect(results).toHaveLength(3);
    expect(results[0].code).toEqual('MULTI001');
    expect(results[1].code).toEqual('MULTI002');
    expect(results[2].code).toEqual('MULTI003');

    // Verify all accounts exist in database
    const dbAccounts = await db.select()
      .from(accountsTable)
      .execute();

    expect(dbAccounts.length).toBeGreaterThanOrEqual(3);
    const codes = dbAccounts.map(acc => acc.code);
    expect(codes).toContain('MULTI001');
    expect(codes).toContain('MULTI002');
    expect(codes).toContain('MULTI003');
  });
});