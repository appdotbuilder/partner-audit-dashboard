import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { accountsTable } from '../db/schema';
import { type CreateAccountInput } from '../schema';
import { getAccounts, type GetAccountsInput } from '../handlers/get_accounts';
import { eq, and } from 'drizzle-orm';

// Test data setup
const testAccounts: CreateAccountInput[] = [
  {
    code: 'CASH-001',
    name: 'Cash USD',
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
    code: 'CASH-002',
    name: 'Cash PKR',
    account_type: 'Asset',
    currency: 'PKR',
    is_bank: true,
    is_capital: false,
    is_payroll_source: true,
    is_intercompany: false,
    parent_id: null,
    is_active: true
  },
  {
    code: 'CAP-001',
    name: 'Partner Capital USD',
    account_type: 'Equity',
    currency: 'USD',
    is_bank: false,
    is_capital: true,
    is_payroll_source: false,
    is_intercompany: false,
    parent_id: null,
    is_active: true
  },
  {
    code: 'EXP-001',
    name: 'Office Expenses',
    account_type: 'Expense',
    currency: 'PKR',
    is_bank: false,
    is_capital: false,
    is_payroll_source: false,
    is_intercompany: true,
    parent_id: null,
    is_active: false
  }
];

const createTestAccounts = async () => {
  const results = [];
  for (const account of testAccounts) {
    const result = await db.insert(accountsTable)
      .values(account)
      .returning()
      .execute();
    results.push(result[0]);
  }
  return results;
};

describe('getAccounts', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should fetch all accounts when no filters applied', async () => {
    await createTestAccounts();

    const result = await getAccounts();

    expect(result).toHaveLength(4);
    expect(result[0].code).toEqual('CASH-001');
    expect(result[0].name).toEqual('Cash USD');
    expect(result[0].account_type).toEqual('Asset');
    expect(result[0].currency).toEqual('USD');
    expect(result[0].is_bank).toBe(true);
    expect(result[0].created_at).toBeInstanceOf(Date);
  });

  it('should filter accounts by currency', async () => {
    await createTestAccounts();

    const usdAccounts = await getAccounts({ currency: 'USD' });
    const pkrAccounts = await getAccounts({ currency: 'PKR' });

    expect(usdAccounts).toHaveLength(2);
    expect(pkrAccounts).toHaveLength(2);
    
    usdAccounts.forEach(account => {
      expect(account.currency).toEqual('USD');
    });
    
    pkrAccounts.forEach(account => {
      expect(account.currency).toEqual('PKR');
    });
  });

  it('should filter accounts by account type', async () => {
    await createTestAccounts();

    const assetAccounts = await getAccounts({ account_type: 'Asset' });
    const equityAccounts = await getAccounts({ account_type: 'Equity' });
    const expenseAccounts = await getAccounts({ account_type: 'Expense' });

    expect(assetAccounts).toHaveLength(2);
    expect(equityAccounts).toHaveLength(1);
    expect(expenseAccounts).toHaveLength(1);
    
    assetAccounts.forEach(account => {
      expect(account.account_type).toEqual('Asset');
    });
    
    expect(equityAccounts[0].account_type).toEqual('Equity');
    expect(expenseAccounts[0].account_type).toEqual('Expense');
  });

  it('should filter accounts by boolean flags', async () => {
    await createTestAccounts();

    const bankAccounts = await getAccounts({ is_bank: true });
    const capitalAccounts = await getAccounts({ is_capital: true });
    const payrollAccounts = await getAccounts({ is_payroll_source: true });
    const intercompanyAccounts = await getAccounts({ is_intercompany: true });

    expect(bankAccounts).toHaveLength(2);
    expect(capitalAccounts).toHaveLength(1);
    expect(payrollAccounts).toHaveLength(1);
    expect(intercompanyAccounts).toHaveLength(1);
    
    bankAccounts.forEach(account => {
      expect(account.is_bank).toBe(true);
    });
    
    expect(capitalAccounts[0].is_capital).toBe(true);
    expect(payrollAccounts[0].is_payroll_source).toBe(true);
    expect(intercompanyAccounts[0].is_intercompany).toBe(true);
  });

  it('should filter accounts by active status', async () => {
    await createTestAccounts();

    const activeAccounts = await getAccounts({ is_active: true });
    const inactiveAccounts = await getAccounts({ is_active: false });

    expect(activeAccounts).toHaveLength(3);
    expect(inactiveAccounts).toHaveLength(1);
    
    activeAccounts.forEach(account => {
      expect(account.is_active).toBe(true);
    });
    
    expect(inactiveAccounts[0].is_active).toBe(false);
  });

  it('should filter accounts with multiple conditions', async () => {
    await createTestAccounts();

    const result = await getAccounts({
      currency: 'USD',
      account_type: 'Asset',
      is_bank: true
    });

    expect(result).toHaveLength(1);
    expect(result[0].code).toEqual('CASH-001');
    expect(result[0].currency).toEqual('USD');
    expect(result[0].account_type).toEqual('Asset');
    expect(result[0].is_bank).toBe(true);
  });

  it('should handle parent-child relationships', async () => {
    // Create parent account first
    const parentResult = await db.insert(accountsTable)
      .values({
        code: 'PARENT-001',
        name: 'Parent Account',
        account_type: 'Asset',
        currency: 'USD',
        is_bank: false,
        is_capital: false,
        is_payroll_source: false,
        is_intercompany: false,
        parent_id: null,
        is_active: true
      })
      .returning()
      .execute();
    
    const parentAccount = parentResult[0];

    // Create child account
    const childResult = await db.insert(accountsTable)
      .values({
        code: 'CHILD-001',
        name: 'Child Account',
        account_type: 'Asset',
        currency: 'USD',
        is_bank: false,
        is_capital: false,
        is_payroll_source: false,
        is_intercompany: false,
        parent_id: parentAccount.id,
        is_active: true
      })
      .returning()
      .execute();

    const childAccount = childResult[0];

    // Test filtering by parent_id
    const parentAccounts = await getAccounts({ parent_id: null });
    const childAccounts = await getAccounts({ parent_id: parentAccount.id });

    expect(parentAccounts).toHaveLength(1);
    expect(childAccounts).toHaveLength(1);
    expect(parentAccounts[0].id).toEqual(parentAccount.id);
    expect(parentAccounts[0].parent_id).toBeNull();
    expect(childAccounts[0].id).toEqual(childAccount.id);
    expect(childAccounts[0].parent_id).toEqual(parentAccount.id);
  });

  it('should return empty array when no accounts match filters', async () => {
    await createTestAccounts();

    const result = await getAccounts({
      currency: 'USD',
      account_type: 'Income' // No accounts with this combination exist
    });

    expect(result).toHaveLength(0);
  });

  it('should verify accounts are saved to database correctly', async () => {
    const createdAccounts = await createTestAccounts();

    // Query database directly to verify storage
    const storedAccounts = await db.select()
      .from(accountsTable)
      .where(eq(accountsTable.code, 'CASH-001'))
      .execute();

    expect(storedAccounts).toHaveLength(1);
    expect(storedAccounts[0].name).toEqual('Cash USD');
    expect(storedAccounts[0].account_type).toEqual('Asset');
    expect(storedAccounts[0].currency).toEqual('USD');
    expect(storedAccounts[0].is_bank).toBe(true);
    expect(storedAccounts[0].created_at).toBeInstanceOf(Date);
  });

  it('should handle complex filtering scenarios', async () => {
    await createTestAccounts();

    // Test filtering for active, USD, non-bank accounts
    const result = await getAccounts({
      currency: 'USD',
      is_active: true,
      is_bank: false
    });

    expect(result).toHaveLength(1);
    expect(result[0].code).toEqual('CAP-001');
    expect(result[0].currency).toEqual('USD');
    expect(result[0].is_active).toBe(true);
    expect(result[0].is_bank).toBe(false);
  });
});