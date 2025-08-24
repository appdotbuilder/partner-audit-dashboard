import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { 
  periodsTable, 
  accountsTable, 
  usersTable, 
  journalsTable,
  journalLinesTable
} from '../db/schema';
import { getTrialBalanceReport } from '../handlers/get_trial_balance_report';

describe('getTrialBalanceReport', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return empty array when no periods exist', async () => {
    const result = await getTrialBalanceReport();
    expect(result).toEqual([]);
  });

  it('should return empty array when period has no posted journals', async () => {
    // Create test period
    const [period] = await db.insert(periodsTable)
      .values({
        year: 2024,
        month: 1,
        status: 'Open',
        fx_rate_locked: false
      })
      .returning()
      .execute();

    const result = await getTrialBalanceReport(period.id);
    expect(result).toEqual([]);
  });

  it('should generate trial balance for posted journals only', async () => {
    // Create test user
    const [user] = await db.insert(usersTable)
      .values({
        email: 'test@example.com',
        name: 'Test User',
        role: 'Admin',
        partner_id: null
      })
      .returning()
      .execute();

    // Create test period
    const [period] = await db.insert(periodsTable)
      .values({
        year: 2024,
        month: 1,
        status: 'Open',
        fx_rate_locked: false
      })
      .returning()
      .execute();

    // Create test accounts
    const [assetAccount] = await db.insert(accountsTable)
      .values({
        code: '1001',
        name: 'Cash USD',
        account_type: 'Asset',
        currency: 'USD',
        is_bank: true,
        is_capital: false,
        is_payroll_source: false,
        is_intercompany: false,
        parent_id: null,
        is_active: true
      })
      .returning()
      .execute();

    const [liabilityAccount] = await db.insert(accountsTable)
      .values({
        code: '2001',
        name: 'Accounts Payable',
        account_type: 'Liability',
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

    // Create posted journal
    const [postedJournal] = await db.insert(journalsTable)
      .values({
        reference: 'JE001',
        description: 'Test Journal Entry',
        journal_date: '2024-01-15',
        period_id: period.id,
        status: 'Posted',
        total_debit: '1000.00',
        total_credit: '1000.00',
        fx_rate_id: null,
        created_by: user.id,
        posted_by: user.id,
        posted_at: new Date()
      })
      .returning()
      .execute();

    // Create draft journal (should be excluded)
    const [draftJournal] = await db.insert(journalsTable)
      .values({
        reference: 'JE002',
        description: 'Draft Journal Entry',
        journal_date: '2024-01-16',
        period_id: period.id,
        status: 'Draft',
        total_debit: '500.00',
        total_credit: '500.00',
        fx_rate_id: null,
        created_by: user.id,
        posted_by: null,
        posted_at: null
      })
      .returning()
      .execute();

    // Create journal lines for posted journal
    await db.insert(journalLinesTable)
      .values([
        {
          journal_id: postedJournal.id,
          account_id: assetAccount.id,
          description: 'Cash receipt',
          debit_amount: '1000.00',
          credit_amount: '0.00',
          debit_amount_base: '280000.00', // PKR equivalent
          credit_amount_base: '0.00',
          line_number: 1
        },
        {
          journal_id: postedJournal.id,
          account_id: liabilityAccount.id,
          description: 'AP increase',
          debit_amount: '0.00',
          credit_amount: '1000.00',
          debit_amount_base: '0.00',
          credit_amount_base: '280000.00', // PKR equivalent
          line_number: 2
        }
      ])
      .execute();

    // Create journal lines for draft journal (should be excluded)
    await db.insert(journalLinesTable)
      .values([
        {
          journal_id: draftJournal.id,
          account_id: assetAccount.id,
          description: 'Draft entry',
          debit_amount: '500.00',
          credit_amount: '0.00',
          debit_amount_base: '140000.00',
          credit_amount_base: '0.00',
          line_number: 1
        },
        {
          journal_id: draftJournal.id,
          account_id: liabilityAccount.id,
          description: 'Draft entry',
          debit_amount: '0.00',
          credit_amount: '500.00',
          debit_amount_base: '0.00',
          credit_amount_base: '140000.00',
          line_number: 2
        }
      ])
      .execute();

    const result = await getTrialBalanceReport(period.id);

    expect(result).toHaveLength(2);

    // Find accounts in result
    const assetResult = result.find(r => r.account_code === '1001');
    const liabilityResult = result.find(r => r.account_code === '2001');

    expect(assetResult).toBeDefined();
    expect(assetResult!.account_name).toEqual('Cash USD');
    expect(assetResult!.account_type).toEqual('Asset');
    expect(assetResult!.currency).toEqual('USD');
    expect(assetResult!.debit_balance).toEqual(1000);
    expect(assetResult!.credit_balance).toEqual(0);
    expect(assetResult!.debit_balance_base).toEqual(280000);
    expect(assetResult!.credit_balance_base).toEqual(0);

    expect(liabilityResult).toBeDefined();
    expect(liabilityResult!.account_name).toEqual('Accounts Payable');
    expect(liabilityResult!.account_type).toEqual('Liability');
    expect(liabilityResult!.currency).toEqual('USD');
    expect(liabilityResult!.debit_balance).toEqual(0);
    expect(liabilityResult!.credit_balance).toEqual(1000);
    expect(liabilityResult!.debit_balance_base).toEqual(0);
    expect(liabilityResult!.credit_balance_base).toEqual(280000);
  });

  it('should aggregate multiple journal lines for same account', async () => {
    // Create test user
    const [user] = await db.insert(usersTable)
      .values({
        email: 'test@example.com',
        name: 'Test User',
        role: 'Admin',
        partner_id: null
      })
      .returning()
      .execute();

    // Create test period
    const [period] = await db.insert(periodsTable)
      .values({
        year: 2024,
        month: 1,
        status: 'Open',
        fx_rate_locked: false
      })
      .returning()
      .execute();

    // Create test account
    const [cashAccount] = await db.insert(accountsTable)
      .values({
        code: '1001',
        name: 'Cash USD',
        account_type: 'Asset',
        currency: 'USD',
        is_bank: true,
        is_capital: false,
        is_payroll_source: false,
        is_intercompany: false,
        parent_id: null,
        is_active: true
      })
      .returning()
      .execute();

    const [expenseAccount] = await db.insert(accountsTable)
      .values({
        code: '5001',
        name: 'Office Expense',
        account_type: 'Expense',
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

    // Create multiple journals affecting same account
    const [journal1] = await db.insert(journalsTable)
      .values({
        reference: 'JE001',
        description: 'First Journal',
        journal_date: '2024-01-15',
        period_id: period.id,
        status: 'Posted',
        total_debit: '1000.00',
        total_credit: '1000.00',
        fx_rate_id: null,
        created_by: user.id,
        posted_by: user.id,
        posted_at: new Date()
      })
      .returning()
      .execute();

    const [journal2] = await db.insert(journalsTable)
      .values({
        reference: 'JE002',
        description: 'Second Journal',
        journal_date: '2024-01-16',
        period_id: period.id,
        status: 'Posted',
        total_debit: '500.00',
        total_credit: '500.00',
        fx_rate_id: null,
        created_by: user.id,
        posted_by: user.id,
        posted_at: new Date()
      })
      .returning()
      .execute();

    // Create journal lines - cash account has both debit and credit
    await db.insert(journalLinesTable)
      .values([
        // Journal 1: Cash debit
        {
          journal_id: journal1.id,
          account_id: cashAccount.id,
          description: 'Cash receipt',
          debit_amount: '1000.00',
          credit_amount: '0.00',
          debit_amount_base: '280000.00',
          credit_amount_base: '0.00',
          line_number: 1
        },
        {
          journal_id: journal1.id,
          account_id: expenseAccount.id,
          description: 'Expense reduction',
          debit_amount: '0.00',
          credit_amount: '1000.00',
          debit_amount_base: '0.00',
          credit_amount_base: '280000.00',
          line_number: 2
        },
        // Journal 2: Cash credit
        {
          journal_id: journal2.id,
          account_id: cashAccount.id,
          description: 'Cash payment',
          debit_amount: '0.00',
          credit_amount: '300.00',
          debit_amount_base: '0.00',
          credit_amount_base: '84000.00',
          line_number: 1
        },
        {
          journal_id: journal2.id,
          account_id: expenseAccount.id,
          description: 'Expense',
          debit_amount: '300.00',
          credit_amount: '0.00',
          debit_amount_base: '84000.00',
          credit_amount_base: '0.00',
          line_number: 2
        }
      ])
      .execute();

    const result = await getTrialBalanceReport(period.id);

    expect(result).toHaveLength(2);

    // Find cash account result
    const cashResult = result.find(r => r.account_code === '1001');
    expect(cashResult).toBeDefined();
    expect(cashResult!.debit_balance).toEqual(700); // 1000 - 300
    expect(cashResult!.credit_balance).toEqual(0);
    expect(cashResult!.debit_balance_base).toEqual(196000); // 280000 - 84000
    expect(cashResult!.credit_balance_base).toEqual(0);

    // Find expense account result  
    const expenseResult = result.find(r => r.account_code === '5001');
    expect(expenseResult).toBeDefined();
    expect(expenseResult!.debit_balance).toEqual(0);
    expect(expenseResult!.credit_balance).toEqual(700); // 1000 - 300
    expect(expenseResult!.debit_balance_base).toEqual(0);
    expect(expenseResult!.credit_balance_base).toEqual(196000);
  });

  it('should use latest period when periodId not provided', async () => {
    // Create test user
    const [user] = await db.insert(usersTable)
      .values({
        email: 'test@example.com',
        name: 'Test User',
        role: 'Admin',
        partner_id: null
      })
      .returning()
      .execute();

    // Create multiple periods
    const [period1] = await db.insert(periodsTable)
      .values({
        year: 2023,
        month: 12,
        status: 'Open',
        fx_rate_locked: false
      })
      .returning()
      .execute();

    const [period2] = await db.insert(periodsTable)
      .values({
        year: 2024,
        month: 1,
        status: 'Open',
        fx_rate_locked: false
      })
      .returning()
      .execute();

    // Create test account
    const [cashAccount] = await db.insert(accountsTable)
      .values({
        code: '1001',
        name: 'Cash USD',
        account_type: 'Asset',
        currency: 'USD',
        is_bank: true,
        is_capital: false,
        is_payroll_source: false,
        is_intercompany: false,
        parent_id: null,
        is_active: true
      })
      .returning()
      .execute();

    const [expenseAccount] = await db.insert(accountsTable)
      .values({
        code: '5001',
        name: 'Office Expense',
        account_type: 'Expense',
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

    // Create journal in older period
    const [oldJournal] = await db.insert(journalsTable)
      .values({
        reference: 'JE001',
        description: 'Old Journal',
        journal_date: '2023-12-15',
        period_id: period1.id,
        status: 'Posted',
        total_debit: '500.00',
        total_credit: '500.00',
        fx_rate_id: null,
        created_by: user.id,
        posted_by: user.id,
        posted_at: new Date()
      })
      .returning()
      .execute();

    // Create journal in newer period  
    const [newJournal] = await db.insert(journalsTable)
      .values({
        reference: 'JE002',
        description: 'New Journal',
        journal_date: '2024-01-15',
        period_id: period2.id,
        status: 'Posted',
        total_debit: '1000.00',
        total_credit: '1000.00',
        fx_rate_id: null,
        created_by: user.id,
        posted_by: user.id,
        posted_at: new Date()
      })
      .returning()
      .execute();

    // Create journal lines
    await db.insert(journalLinesTable)
      .values([
        // Old period
        {
          journal_id: oldJournal.id,
          account_id: cashAccount.id,
          description: 'Old entry',
          debit_amount: '500.00',
          credit_amount: '0.00',
          debit_amount_base: '140000.00',
          credit_amount_base: '0.00',
          line_number: 1
        },
        {
          journal_id: oldJournal.id,
          account_id: expenseAccount.id,
          description: 'Old entry',
          debit_amount: '0.00',
          credit_amount: '500.00',
          debit_amount_base: '0.00',
          credit_amount_base: '140000.00',
          line_number: 2
        },
        // New period
        {
          journal_id: newJournal.id,
          account_id: cashAccount.id,
          description: 'New entry',
          debit_amount: '1000.00',
          credit_amount: '0.00',
          debit_amount_base: '280000.00',
          credit_amount_base: '0.00',
          line_number: 1
        },
        {
          journal_id: newJournal.id,
          account_id: expenseAccount.id,
          description: 'New entry',
          debit_amount: '0.00',
          credit_amount: '1000.00',
          debit_amount_base: '0.00',
          credit_amount_base: '280000.00',
          line_number: 2
        }
      ])
      .execute();

    // Should use latest period (2024-01) when no period specified
    const result = await getTrialBalanceReport();

    expect(result).toHaveLength(2);

    const cashResult = result.find(r => r.account_code === '1001');
    expect(cashResult).toBeDefined();
    expect(cashResult!.debit_balance).toEqual(1000); // Only from new period
    expect(cashResult!.debit_balance_base).toEqual(280000);
  });

  it('should return results ordered by account code', async () => {
    // Create test user
    const [user] = await db.insert(usersTable)
      .values({
        email: 'test@example.com',
        name: 'Test User',
        role: 'Admin',
        partner_id: null
      })
      .returning()
      .execute();

    // Create test period
    const [period] = await db.insert(periodsTable)
      .values({
        year: 2024,
        month: 1,
        status: 'Open',
        fx_rate_locked: false
      })
      .returning()
      .execute();

    // Create accounts in non-alphabetical order
    const accounts = await db.insert(accountsTable)
      .values([
        {
          code: '5001',
          name: 'Office Expense',
          account_type: 'Expense',
          currency: 'USD',
          is_bank: false,
          is_capital: false,
          is_payroll_source: false,
          is_intercompany: false,
          parent_id: null,
          is_active: true
        },
        {
          code: '1001',
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
          code: '3001',
          name: 'Equity',
          account_type: 'Equity',
          currency: 'USD',
          is_bank: false,
          is_capital: true,
          is_payroll_source: false,
          is_intercompany: false,
          parent_id: null,
          is_active: true
        }
      ])
      .returning()
      .execute();

    // Create journal with lines for all accounts
    const [journal] = await db.insert(journalsTable)
      .values({
        reference: 'JE001',
        description: 'Test Journal',
        journal_date: '2024-01-15',
        period_id: period.id,
        status: 'Posted',
        total_debit: '1500.00',
        total_credit: '1500.00',
        fx_rate_id: null,
        created_by: user.id,
        posted_by: user.id,
        posted_at: new Date()
      })
      .returning()
      .execute();

    await db.insert(journalLinesTable)
      .values([
        {
          journal_id: journal.id,
          account_id: accounts[0].id, // 5001
          description: 'Expense',
          debit_amount: '500.00',
          credit_amount: '0.00',
          debit_amount_base: '140000.00',
          credit_amount_base: '0.00',
          line_number: 1
        },
        {
          journal_id: journal.id,
          account_id: accounts[1].id, // 1001
          description: 'Cash payment',
          debit_amount: '0.00',
          credit_amount: '1000.00',
          debit_amount_base: '0.00',
          credit_amount_base: '280000.00',
          line_number: 2
        },
        {
          journal_id: journal.id,
          account_id: accounts[2].id, // 3001
          description: 'Equity contribution',
          debit_amount: '0.00',
          credit_amount: '500.00',
          debit_amount_base: '0.00',
          credit_amount_base: '140000.00',
          line_number: 3
        },
        {
          journal_id: journal.id,
          account_id: accounts[1].id, // 1001 again
          description: 'Cash receipt',
          debit_amount: '1500.00',
          credit_amount: '0.00',
          debit_amount_base: '420000.00',
          credit_amount_base: '0.00',
          line_number: 4
        }
      ])
      .execute();

    const result = await getTrialBalanceReport(period.id);

    expect(result).toHaveLength(3);

    // Should be ordered by account code: 1001, 3001, 5001
    expect(result[0].account_code).toEqual('1001');
    expect(result[1].account_code).toEqual('3001');
    expect(result[2].account_code).toEqual('5001');
  });
});