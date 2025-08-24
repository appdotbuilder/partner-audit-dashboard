import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { accountsTable, journalLinesTable, journalsTable, fxRatesTable, usersTable, periodsTable } from '../db/schema';
import { getDashboardBalances } from '../handlers/get_dashboard_balances';

describe('getDashboardBalances', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return empty balances when no bank accounts exist', async () => {
    const result = await getDashboardBalances();

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      currency: 'USD',
      balance: 0,
      balance_pkr: 0
    });
    expect(result[1]).toEqual({
      currency: 'PKR',
      balance: 0,
      balance_pkr: 0
    });
  });

  it('should calculate bank balances correctly with journal entries', async () => {
    // Create test user and period first
    const [user] = await db.insert(usersTable)
      .values({
        email: 'test@example.com',
        name: 'Test User',
        role: 'Admin',
        partner_id: null
      })
      .returning()
      .execute();

    const [period] = await db.insert(periodsTable)
      .values({
        year: 2024,
        month: 1,
        status: 'Open',
        fx_rate_locked: false
      })
      .returning()
      .execute();

    // Create bank accounts
    const [usdBankAccount] = await db.insert(accountsTable)
      .values({
        code: '1001',
        name: 'USD Cash Account',
        account_type: 'Asset',
        currency: 'USD',
        is_bank: true,
        is_active: true
      })
      .returning()
      .execute();

    const [pkrBankAccount] = await db.insert(accountsTable)
      .values({
        code: '1002',
        name: 'PKR Cash Account',
        account_type: 'Asset',
        currency: 'PKR',
        is_bank: true,
        is_active: true
      })
      .returning()
      .execute();

    // Create a journal entry
    const [journal] = await db.insert(journalsTable)
      .values({
        reference: 'TEST001',
        description: 'Test Journal Entry',
        journal_date: '2024-01-15',
        period_id: period.id,
        status: 'Draft',
        total_debit: '15000.00',
        total_credit: '15000.00',
        created_by: user.id
      })
      .returning()
      .execute();

    // Add journal lines - debit increases bank balance (assets)
    await db.insert(journalLinesTable)
      .values([
        {
          journal_id: journal.id,
          account_id: usdBankAccount.id,
          description: 'USD Bank Deposit',
          debit_amount: '10000.00',
          credit_amount: '0.00',
          debit_amount_base: '10000.00',
          credit_amount_base: '0.00',
          line_number: 1
        },
        {
          journal_id: journal.id,
          account_id: pkrBankAccount.id,
          description: 'PKR Bank Deposit',
          debit_amount: '5000.00',
          credit_amount: '0.00',
          debit_amount_base: '5000.00',
          credit_amount_base: '0.00',
          line_number: 2
        }
      ])
      .execute();

    // Create FX rate
    await db.insert(fxRatesTable)
      .values({
        from_currency: 'USD',
        to_currency: 'PKR',
        rate: '280.50',
        effective_date: '2024-01-01',
        is_locked: false,
        created_by: user.id
      })
      .execute();

    const result = await getDashboardBalances();

    expect(result).toHaveLength(2);
    
    // Check USD balance
    const usdResult = result.find(r => r.currency === 'USD');
    expect(usdResult).toBeDefined();
    expect(usdResult!.balance).toEqual(10000);
    expect(usdResult!.balance_pkr).toBeCloseTo(2805000, 2); // 10000 * 280.50

    // Check PKR balance
    const pkrResult = result.find(r => r.currency === 'PKR');
    expect(pkrResult).toBeDefined();
    expect(pkrResult!.balance).toEqual(5000);
    expect(pkrResult!.balance_pkr).toEqual(5000); // PKR balance remains same in PKR
  });

  it('should handle multiple journal entries and calculate net balance', async () => {
    // Create prerequisites
    const [user] = await db.insert(usersTable)
      .values({
        email: 'test@example.com',
        name: 'Test User',
        role: 'Admin',
        partner_id: null
      })
      .returning()
      .execute();

    const [period] = await db.insert(periodsTable)
      .values({
        year: 2024,
        month: 1,
        status: 'Open',
        fx_rate_locked: false
      })
      .returning()
      .execute();

    const [bankAccount] = await db.insert(accountsTable)
      .values({
        code: '1001',
        name: 'Main Bank Account',
        account_type: 'Asset',
        currency: 'USD',
        is_bank: true,
        is_active: true
      })
      .returning()
      .execute();

    const [journal] = await db.insert(journalsTable)
      .values({
        reference: 'TEST001',
        description: 'Test Journal',
        journal_date: '2024-01-15',
        period_id: period.id,
        status: 'Draft',
        total_debit: '3000.00',
        total_credit: '3000.00',
        created_by: user.id
      })
      .returning()
      .execute();

    // Multiple journal lines - some debits, some credits
    await db.insert(journalLinesTable)
      .values([
        {
          journal_id: journal.id,
          account_id: bankAccount.id,
          description: 'Deposit',
          debit_amount: '5000.00',
          credit_amount: '0.00',
          debit_amount_base: '5000.00',
          credit_amount_base: '0.00',
          line_number: 1
        },
        {
          journal_id: journal.id,
          account_id: bankAccount.id,
          description: 'Withdrawal',
          debit_amount: '0.00',
          credit_amount: '2000.00',
          debit_amount_base: '0.00',
          credit_amount_base: '2000.00',
          line_number: 2
        }
      ])
      .execute();

    const result = await getDashboardBalances();

    const usdResult = result.find(r => r.currency === 'USD');
    expect(usdResult!.balance).toEqual(3000); // 5000 debit - 2000 credit = 3000 net
  });

  it('should use default exchange rate when no FX rate exists', async () => {
    // Create test data without FX rate
    const [user] = await db.insert(usersTable)
      .values({
        email: 'test@example.com',
        name: 'Test User',
        role: 'Admin',
        partner_id: null
      })
      .returning()
      .execute();

    const [period] = await db.insert(periodsTable)
      .values({
        year: 2024,
        month: 1,
        status: 'Open',
        fx_rate_locked: false
      })
      .returning()
      .execute();

    const [usdAccount] = await db.insert(accountsTable)
      .values({
        code: '1001',
        name: 'USD Bank',
        account_type: 'Asset',
        currency: 'USD',
        is_bank: true,
        is_active: true
      })
      .returning()
      .execute();

    const [journal] = await db.insert(journalsTable)
      .values({
        reference: 'TEST001',
        description: 'Test',
        journal_date: '2024-01-15',
        period_id: period.id,
        status: 'Draft',
        total_debit: '1000.00',
        total_credit: '1000.00',
        created_by: user.id
      })
      .returning()
      .execute();

    await db.insert(journalLinesTable)
      .values({
        journal_id: journal.id,
        account_id: usdAccount.id,
        description: 'Test entry',
        debit_amount: '1000.00',
        credit_amount: '0.00',
        debit_amount_base: '1000.00',
        credit_amount_base: '0.00',
        line_number: 1
      })
      .execute();

    const result = await getDashboardBalances();

    const usdResult = result.find(r => r.currency === 'USD');
    expect(usdResult!.balance).toEqual(1000);
    expect(usdResult!.balance_pkr).toEqual(1000); // Default rate of 1
  });

  it('should exclude inactive bank accounts', async () => {
    // Create prerequisites
    const [user] = await db.insert(usersTable)
      .values({
        email: 'test@example.com',
        name: 'Test User',
        role: 'Admin',
        partner_id: null
      })
      .returning()
      .execute();

    const [period] = await db.insert(periodsTable)
      .values({
        year: 2024,
        month: 1,
        status: 'Open',
        fx_rate_locked: false
      })
      .returning()
      .execute();

    // Create active and inactive bank accounts
    const [activeBankAccount] = await db.insert(accountsTable)
      .values({
        code: '1001',
        name: 'Active Bank',
        account_type: 'Asset',
        currency: 'USD',
        is_bank: true,
        is_active: true
      })
      .returning()
      .execute();

    const [inactiveBankAccount] = await db.insert(accountsTable)
      .values({
        code: '1002',
        name: 'Inactive Bank',
        account_type: 'Asset',
        currency: 'USD',
        is_bank: true,
        is_active: false
      })
      .returning()
      .execute();

    const [journal] = await db.insert(journalsTable)
      .values({
        reference: 'TEST001',
        description: 'Test',
        journal_date: '2024-01-15',
        period_id: period.id,
        status: 'Draft',
        total_debit: '3000.00',
        total_credit: '3000.00',
        created_by: user.id
      })
      .returning()
      .execute();

    // Add entries to both accounts
    await db.insert(journalLinesTable)
      .values([
        {
          journal_id: journal.id,
          account_id: activeBankAccount.id,
          description: 'Active account entry',
          debit_amount: '2000.00',
          credit_amount: '0.00',
          debit_amount_base: '2000.00',
          credit_amount_base: '0.00',
          line_number: 1
        },
        {
          journal_id: journal.id,
          account_id: inactiveBankAccount.id,
          description: 'Inactive account entry',
          debit_amount: '1000.00',
          credit_amount: '0.00',
          debit_amount_base: '1000.00',
          credit_amount_base: '0.00',
          line_number: 2
        }
      ])
      .execute();

    const result = await getDashboardBalances();

    // Should only include balance from active account
    const usdResult = result.find(r => r.currency === 'USD');
    expect(usdResult!.balance).toEqual(2000); // Only from active account
  });

  it('should exclude non-bank accounts', async () => {
    // Create prerequisites
    const [user] = await db.insert(usersTable)
      .values({
        email: 'test@example.com',
        name: 'Test User',
        role: 'Admin',
        partner_id: null
      })
      .returning()
      .execute();

    const [period] = await db.insert(periodsTable)
      .values({
        year: 2024,
        month: 1,
        status: 'Open',
        fx_rate_locked: false
      })
      .returning()
      .execute();

    // Create bank and non-bank accounts
    const [bankAccount] = await db.insert(accountsTable)
      .values({
        code: '1001',
        name: 'Bank Account',
        account_type: 'Asset',
        currency: 'USD',
        is_bank: true,
        is_active: true
      })
      .returning()
      .execute();

    const [nonBankAccount] = await db.insert(accountsTable)
      .values({
        code: '1100',
        name: 'Inventory Account',
        account_type: 'Asset',
        currency: 'USD',
        is_bank: false,
        is_active: true
      })
      .returning()
      .execute();

    const [journal] = await db.insert(journalsTable)
      .values({
        reference: 'TEST001',
        description: 'Test',
        journal_date: '2024-01-15',
        period_id: period.id,
        status: 'Draft',
        total_debit: '3000.00',
        total_credit: '3000.00',
        created_by: user.id
      })
      .returning()
      .execute();

    // Add entries to both accounts
    await db.insert(journalLinesTable)
      .values([
        {
          journal_id: journal.id,
          account_id: bankAccount.id,
          description: 'Bank entry',
          debit_amount: '1500.00',
          credit_amount: '0.00',
          debit_amount_base: '1500.00',
          credit_amount_base: '0.00',
          line_number: 1
        },
        {
          journal_id: journal.id,
          account_id: nonBankAccount.id,
          description: 'Non-bank entry',
          debit_amount: '1500.00',
          credit_amount: '0.00',
          debit_amount_base: '1500.00',
          credit_amount_base: '0.00',
          line_number: 2
        }
      ])
      .execute();

    const result = await getDashboardBalances();

    // Should only include balance from bank account
    const usdResult = result.find(r => r.currency === 'USD');
    expect(usdResult!.balance).toEqual(1500); // Only from bank account
  });

  it('should use latest FX rate when multiple rates exist', async () => {
    // Create prerequisites
    const [user] = await db.insert(usersTable)
      .values({
        email: 'test@example.com',
        name: 'Test User',
        role: 'Admin',
        partner_id: null
      })
      .returning()
      .execute();

    // Create multiple FX rates with different dates
    await db.insert(fxRatesTable)
      .values([
        {
          from_currency: 'USD',
          to_currency: 'PKR',
          rate: '280.00',
          effective_date: '2024-01-01',
          is_locked: false,
          created_by: user.id
        },
        {
          from_currency: 'USD',
          to_currency: 'PKR',
          rate: '285.50',
          effective_date: '2024-01-15',
          is_locked: false,
          created_by: user.id
        },
        {
          from_currency: 'USD',
          to_currency: 'PKR',
          rate: '275.00',
          effective_date: '2024-01-10',
          is_locked: false,
          created_by: user.id
        }
      ])
      .execute();

    const result = await getDashboardBalances();

    const usdResult = result.find(r => r.currency === 'USD');
    // Should use rate 285.50 (latest date: 2024-01-15)
    expect(usdResult!.balance_pkr).toEqual(0 * 285.50);
  });
});