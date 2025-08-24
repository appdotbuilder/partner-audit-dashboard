import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { 
  usersTable, 
  accountsTable, 
  periodsTable, 
  journalsTable, 
  journalLinesTable 
} from '../db/schema';
import { getDashboardIncomeExpense } from '../handlers/get_dashboard_income_expense';

describe('getDashboardIncomeExpense', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return empty results when no data exists', async () => {
    const result = await getDashboardIncomeExpense();
    
    expect(result).toHaveLength(2); // Should return USD and PKR entries
    expect(result[0].income_mtd).toEqual(0);
    expect(result[0].expense_mtd).toEqual(0);
    expect(result[0].income_ytd).toEqual(0);
    expect(result[0].expense_ytd).toEqual(0);
  });

  it('should calculate income and expense correctly for current month', async () => {
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

    // Create income and expense accounts
    const [incomeAccount] = await db.insert(accountsTable)
      .values({
        code: '4000',
        name: 'Service Revenue',
        account_type: 'Income',
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

    const [expenseAccount] = await db.insert(accountsTable)
      .values({
        code: '5000',
        name: 'Office Expenses',
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

    // Create current period
    const currentDate = new Date();
    const [period] = await db.insert(periodsTable)
      .values({
        year: currentDate.getFullYear(),
        month: currentDate.getMonth() + 1,
        status: 'Open',
        fx_rate_locked: false
      })
      .returning()
      .execute();

    // Create journal for current month
    const [journal] = await db.insert(journalsTable)
      .values({
        reference: 'TEST001',
        description: 'Test Journal',
        journal_date: currentDate.toISOString().split('T')[0], // Convert to YYYY-MM-DD
        period_id: period.id,
        status: 'Posted',
        total_debit: '1500.00',
        total_credit: '1500.00',
        fx_rate_id: null,
        created_by: user.id,
        posted_by: user.id,
        posted_at: currentDate
      })
      .returning()
      .execute();

    // Create journal lines - Income (credit increases income)
    await db.insert(journalLinesTable)
      .values({
        journal_id: journal.id,
        account_id: incomeAccount.id,
        description: 'Service revenue',
        debit_amount: '0.00',
        credit_amount: '1000.00',
        debit_amount_base: '0.00',
        credit_amount_base: '1000.00',
        line_number: 1
      })
      .execute();

    // Create journal lines - Expense (debit increases expense)
    await db.insert(journalLinesTable)
      .values({
        journal_id: journal.id,
        account_id: expenseAccount.id,
        description: 'Office supplies',
        debit_amount: '500.00',
        credit_amount: '0.00',
        debit_amount_base: '500.00',
        credit_amount_base: '0.00',
        line_number: 2
      })
      .execute();

    const result = await getDashboardIncomeExpense();

    // Find USD result
    const usdResult = result.find(r => r.currency === 'USD');
    expect(usdResult).toBeDefined();
    expect(usdResult!.income_mtd).toEqual(1000);
    expect(usdResult!.expense_mtd).toEqual(500);
    expect(usdResult!.income_ytd).toEqual(1000);
    expect(usdResult!.expense_ytd).toEqual(500);
  });

  it('should calculate MTD vs YTD correctly across different months', async () => {
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

    // Create PKR income account
    const [pkrIncomeAccount] = await db.insert(accountsTable)
      .values({
        code: '4100',
        name: 'PKR Revenue',
        account_type: 'Income',
        currency: 'PKR',
        is_bank: false,
        is_capital: false,
        is_payroll_source: false,
        is_intercompany: false,
        parent_id: null,
        is_active: true
      })
      .returning()
      .execute();

    // Create periods for this year
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    
    const [currentPeriod] = await db.insert(periodsTable)
      .values({
        year: currentYear,
        month: currentDate.getMonth() + 1,
        status: 'Open',
        fx_rate_locked: false
      })
      .returning()
      .execute();

    const [previousPeriod] = await db.insert(periodsTable)
      .values({
        year: currentYear,
        month: Math.max(1, currentDate.getMonth()), // Previous month or January
        status: 'Locked',
        fx_rate_locked: true
      })
      .returning()
      .execute();

    // Create journal for current month (should be in MTD and YTD)
    const [currentJournal] = await db.insert(journalsTable)
      .values({
        reference: 'CURRENT001',
        description: 'Current Month Journal',
        journal_date: currentDate.toISOString().split('T')[0], // Convert to YYYY-MM-DD
        period_id: currentPeriod.id,
        status: 'Posted',
        total_debit: '2000.00',
        total_credit: '2000.00',
        fx_rate_id: null,
        created_by: user.id,
        posted_by: user.id,
        posted_at: currentDate
      })
      .returning()
      .execute();

    // Create journal for previous month (should be in YTD only)
    const previousMonthDate = new Date(currentYear, Math.max(0, currentDate.getMonth() - 1), 15);
    const [previousJournal] = await db.insert(journalsTable)
      .values({
        reference: 'PREV001',
        description: 'Previous Month Journal',
        journal_date: previousMonthDate.toISOString().split('T')[0], // Convert to YYYY-MM-DD
        period_id: previousPeriod.id,
        status: 'Posted',
        total_debit: '1500.00',
        total_credit: '1500.00',
        fx_rate_id: null,
        created_by: user.id,
        posted_by: user.id,
        posted_at: previousMonthDate
      })
      .returning()
      .execute();

    // Add income for current month
    await db.insert(journalLinesTable)
      .values({
        journal_id: currentJournal.id,
        account_id: pkrIncomeAccount.id,
        description: 'Current month income',
        debit_amount: '0.00',
        credit_amount: '2000.00',
        debit_amount_base: '0.00',
        credit_amount_base: '2000.00',
        line_number: 1
      })
      .execute();

    // Add income for previous month
    await db.insert(journalLinesTable)
      .values({
        journal_id: previousJournal.id,
        account_id: pkrIncomeAccount.id,
        description: 'Previous month income',
        debit_amount: '0.00',
        credit_amount: '1500.00',
        debit_amount_base: '0.00',
        credit_amount_base: '1500.00',
        line_number: 1
      })
      .execute();

    const result = await getDashboardIncomeExpense();

    // Find PKR result
    const pkrResult = result.find(r => r.currency === 'PKR');
    expect(pkrResult).toBeDefined();
    expect(pkrResult!.income_mtd).toEqual(2000); // Only current month
    expect(pkrResult!.income_ytd).toEqual(3500); // Current + previous month
    expect(pkrResult!.expense_mtd).toEqual(0);
    expect(pkrResult!.expense_ytd).toEqual(0);
  });

  it('should only include posted journals', async () => {
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

    // Create income account
    const [incomeAccount] = await db.insert(accountsTable)
      .values({
        code: '4000',
        name: 'Service Revenue',
        account_type: 'Income',
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

    // Create period
    const currentDate = new Date();
    const [period] = await db.insert(periodsTable)
      .values({
        year: currentDate.getFullYear(),
        month: currentDate.getMonth() + 1,
        status: 'Open',
        fx_rate_locked: false
      })
      .returning()
      .execute();

    // Create draft journal (should be excluded)
    const [draftJournal] = await db.insert(journalsTable)
      .values({
        reference: 'DRAFT001',
        description: 'Draft Journal',
        journal_date: currentDate.toISOString().split('T')[0], // Convert to YYYY-MM-DD
        period_id: period.id,
        status: 'Draft',
        total_debit: '1000.00',
        total_credit: '1000.00',
        fx_rate_id: null,
        created_by: user.id,
        posted_by: null,
        posted_at: null
      })
      .returning()
      .execute();

    // Create posted journal (should be included)
    const [postedJournal] = await db.insert(journalsTable)
      .values({
        reference: 'POSTED001',
        description: 'Posted Journal',
        journal_date: currentDate.toISOString().split('T')[0], // Convert to YYYY-MM-DD
        period_id: period.id,
        status: 'Posted',
        total_debit: '800.00',
        total_credit: '800.00',
        fx_rate_id: null,
        created_by: user.id,
        posted_by: user.id,
        posted_at: currentDate
      })
      .returning()
      .execute();

    // Add lines to both journals
    await db.insert(journalLinesTable)
      .values([
        {
          journal_id: draftJournal.id,
          account_id: incomeAccount.id,
          description: 'Draft income',
          debit_amount: '0.00',
          credit_amount: '1000.00',
          debit_amount_base: '0.00',
          credit_amount_base: '1000.00',
          line_number: 1
        },
        {
          journal_id: postedJournal.id,
          account_id: incomeAccount.id,
          description: 'Posted income',
          debit_amount: '0.00',
          credit_amount: '800.00',
          debit_amount_base: '0.00',
          credit_amount_base: '800.00',
          line_number: 1
        }
      ])
      .execute();

    const result = await getDashboardIncomeExpense();

    // Find USD result - should only include posted journal amount
    const usdResult = result.find(r => r.currency === 'USD');
    expect(usdResult).toBeDefined();
    expect(usdResult!.income_mtd).toEqual(800); // Only posted journal
    expect(usdResult!.income_ytd).toEqual(800);
  });

  it('should handle both currencies correctly', async () => {
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

    // Create accounts for both currencies
    const [usdAccount, pkrAccount] = await db.insert(accountsTable)
      .values([
        {
          code: '4000',
          name: 'USD Revenue',
          account_type: 'Income',
          currency: 'USD',
          is_bank: false,
          is_capital: false,
          is_payroll_source: false,
          is_intercompany: false,
          parent_id: null,
          is_active: true
        },
        {
          code: '4100',
          name: 'PKR Revenue',
          account_type: 'Income',
          currency: 'PKR',
          is_bank: false,
          is_capital: false,
          is_payroll_source: false,
          is_intercompany: false,
          parent_id: null,
          is_active: true
        }
      ])
      .returning()
      .execute();

    // Create period and journal
    const currentDate = new Date();
    const [period] = await db.insert(periodsTable)
      .values({
        year: currentDate.getFullYear(),
        month: currentDate.getMonth() + 1,
        status: 'Open',
        fx_rate_locked: false
      })
      .returning()
      .execute();

    const [journal] = await db.insert(journalsTable)
      .values({
        reference: 'MULTI001',
        description: 'Multi-currency Journal',
        journal_date: currentDate.toISOString().split('T')[0], // Convert to YYYY-MM-DD
        period_id: period.id,
        status: 'Posted',
        total_debit: '0.00',
        total_credit: '1200.00',
        fx_rate_id: null,
        created_by: user.id,
        posted_by: user.id,
        posted_at: currentDate
      })
      .returning()
      .execute();

    // Add income for both currencies
    await db.insert(journalLinesTable)
      .values([
        {
          journal_id: journal.id,
          account_id: usdAccount.id,
          description: 'USD income',
          debit_amount: '0.00',
          credit_amount: '500.00',
          debit_amount_base: '0.00',
          credit_amount_base: '500.00',
          line_number: 1
        },
        {
          journal_id: journal.id,
          account_id: pkrAccount.id,
          description: 'PKR income',
          debit_amount: '0.00',
          credit_amount: '700.00',
          debit_amount_base: '0.00',
          credit_amount_base: '700.00',
          line_number: 2
        }
      ])
      .execute();

    const result = await getDashboardIncomeExpense();

    expect(result).toHaveLength(2);
    
    const usdResult = result.find(r => r.currency === 'USD');
    const pkrResult = result.find(r => r.currency === 'PKR');
    
    expect(usdResult).toBeDefined();
    expect(usdResult!.income_mtd).toEqual(500);
    expect(usdResult!.income_ytd).toEqual(500);
    
    expect(pkrResult).toBeDefined();
    expect(pkrResult!.income_mtd).toEqual(700);
    expect(pkrResult!.income_ytd).toEqual(700);
  });
});