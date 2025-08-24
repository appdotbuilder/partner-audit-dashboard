import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { 
  accountsTable, 
  journalsTable, 
  journalLinesTable, 
  periodsTable, 
  fxRatesTable, 
  usersTable 
} from '../db/schema';
import { getDashboardSalarySplit } from '../handlers/get_dashboard_salary_split';

describe('getDashboardSalarySplit', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return zero values when no payroll accounts exist', async () => {
    const result = await getDashboardSalarySplit();

    expect(result.usd_salaries).toEqual(0);
    expect(result.pkr_salaries).toEqual(0);
    expect(result.total_pkr).toEqual(0);
  });

  it('should calculate salary split correctly with both currencies', async () => {
    // Create test user
    const user = await db.insert(usersTable)
      .values({
        email: 'test@example.com',
        name: 'Test User',
        role: 'Admin',
        partner_id: null
      })
      .returning()
      .execute();

    // Create test period
    const period = await db.insert(periodsTable)
      .values({
        year: new Date().getFullYear(),
        month: 1,
        status: 'Open',
        fx_rate_locked: false
      })
      .returning()
      .execute();

    // Create USD payroll account
    const usdAccount = await db.insert(accountsTable)
      .values({
        code: 'SAL-USD',
        name: 'USD Salaries',
        account_type: 'Expense',
        currency: 'USD',
        is_payroll_source: true,
        is_active: true
      })
      .returning()
      .execute();

    // Create PKR payroll account
    const pkrAccount = await db.insert(accountsTable)
      .values({
        code: 'SAL-PKR',
        name: 'PKR Salaries',
        account_type: 'Expense',
        currency: 'PKR',
        is_payroll_source: true,
        is_active: true
      })
      .returning()
      .execute();

    // Create FX rate for conversion
    const today = new Date().toISOString().split('T')[0];
    await db.insert(fxRatesTable)
      .values({
        from_currency: 'USD',
        to_currency: 'PKR',
        rate: '280.00',
        effective_date: today,
        is_locked: false,
        created_by: user[0].id
      })
      .execute();

    // Create test journal
    const journalDate = new Date().toISOString().split('T')[0];
    const journal = await db.insert(journalsTable)
      .values({
        reference: 'SAL-001',
        description: 'Salary Payment',
        journal_date: journalDate,
        period_id: period[0].id,
        status: 'Posted',
        total_debit: '8000.00',
        total_credit: '8000.00',
        created_by: user[0].id,
        posted_by: user[0].id,
        posted_at: new Date()
      })
      .returning()
      .execute();

    // Create journal lines for USD salary expense
    await db.insert(journalLinesTable)
      .values({
        journal_id: journal[0].id,
        account_id: usdAccount[0].id,
        description: 'USD Salary Expense',
        debit_amount: '3000.00',
        credit_amount: '0.00',
        debit_amount_base: '3000.00',
        credit_amount_base: '0.00',
        line_number: 1
      })
      .execute();

    // Create journal lines for PKR salary expense
    await db.insert(journalLinesTable)
      .values({
        journal_id: journal[0].id,
        account_id: pkrAccount[0].id,
        description: 'PKR Salary Expense',
        debit_amount: '1400000.00',
        credit_amount: '0.00',
        debit_amount_base: '1400000.00',
        credit_amount_base: '0.00',
        line_number: 2
      })
      .execute();

    const result = await getDashboardSalarySplit();

    expect(typeof result.usd_salaries).toBe('number');
    expect(typeof result.pkr_salaries).toBe('number');
    expect(typeof result.total_pkr).toBe('number');
    expect(result.usd_salaries).toEqual(3000);
    expect(result.pkr_salaries).toEqual(1400000);
    expect(result.total_pkr).toEqual(2240000); // 1400000 + (3000 * 280)
  });

  it('should handle only USD salaries correctly', async () => {
    // Create test user
    const user = await db.insert(usersTable)
      .values({
        email: 'test@example.com',
        name: 'Test User',
        role: 'Admin',
        partner_id: null
      })
      .returning()
      .execute();

    // Create test period
    const period = await db.insert(periodsTable)
      .values({
        year: new Date().getFullYear(),
        month: 1,
        status: 'Open',
        fx_rate_locked: false
      })
      .returning()
      .execute();

    // Create USD payroll account
    const usdAccount = await db.insert(accountsTable)
      .values({
        code: 'SAL-USD',
        name: 'USD Salaries',
        account_type: 'Expense',
        currency: 'USD',
        is_payroll_source: true,
        is_active: true
      })
      .returning()
      .execute();

    // Create FX rate
    const fxDate = new Date().toISOString().split('T')[0];
    await db.insert(fxRatesTable)
      .values({
        from_currency: 'USD',
        to_currency: 'PKR',
        rate: '285.50',
        effective_date: fxDate,
        is_locked: false,
        created_by: user[0].id
      })
      .execute();

    // Create test journal
    const journalDate2 = new Date().toISOString().split('T')[0];
    const journal = await db.insert(journalsTable)
      .values({
        reference: 'SAL-002',
        description: 'USD Only Salary',
        journal_date: journalDate2,
        period_id: period[0].id,
        status: 'Posted',
        total_debit: '2500.00',
        total_credit: '2500.00',
        created_by: user[0].id
      })
      .returning()
      .execute();

    // Create journal line for USD salary
    await db.insert(journalLinesTable)
      .values({
        journal_id: journal[0].id,
        account_id: usdAccount[0].id,
        description: 'USD Salary Expense',
        debit_amount: '2500.00',
        credit_amount: '0.00',
        debit_amount_base: '2500.00',
        credit_amount_base: '0.00',
        line_number: 1
      })
      .execute();

    const result = await getDashboardSalarySplit();

    expect(result.usd_salaries).toEqual(2500);
    expect(result.pkr_salaries).toEqual(0);
    expect(result.total_pkr).toEqual(713750); // 2500 * 285.50
  });

  it('should handle only PKR salaries correctly', async () => {
    // Create test user
    const user = await db.insert(usersTable)
      .values({
        email: 'test@example.com',
        name: 'Test User',
        role: 'Admin',
        partner_id: null
      })
      .returning()
      .execute();

    // Create test period
    const period = await db.insert(periodsTable)
      .values({
        year: new Date().getFullYear(),
        month: 1,
        status: 'Open',
        fx_rate_locked: false
      })
      .returning()
      .execute();

    // Create PKR payroll account
    const pkrAccount = await db.insert(accountsTable)
      .values({
        code: 'SAL-PKR',
        name: 'PKR Salaries',
        account_type: 'Expense',
        currency: 'PKR',
        is_payroll_source: true,
        is_active: true
      })
      .returning()
      .execute();

    // Create test journal
    const journalDate3 = new Date().toISOString().split('T')[0];
    const journal = await db.insert(journalsTable)
      .values({
        reference: 'SAL-003',
        description: 'PKR Only Salary',
        journal_date: journalDate3,
        period_id: period[0].id,
        status: 'Posted',
        total_debit: '500000.00',
        total_credit: '500000.00',
        created_by: user[0].id
      })
      .returning()
      .execute();

    // Create journal line for PKR salary
    await db.insert(journalLinesTable)
      .values({
        journal_id: journal[0].id,
        account_id: pkrAccount[0].id,
        description: 'PKR Salary Expense',
        debit_amount: '500000.00',
        credit_amount: '0.00',
        debit_amount_base: '500000.00',
        credit_amount_base: '0.00',
        line_number: 1
      })
      .execute();

    const result = await getDashboardSalarySplit();

    expect(result.usd_salaries).toEqual(0);
    expect(result.pkr_salaries).toEqual(500000);
    expect(result.total_pkr).toEqual(500000);
  });

  it('should handle net amounts correctly (debit minus credit)', async () => {
    // Create test user
    const user = await db.insert(usersTable)
      .values({
        email: 'test@example.com',
        name: 'Test User',
        role: 'Admin',
        partner_id: null
      })
      .returning()
      .execute();

    // Create test period
    const period = await db.insert(periodsTable)
      .values({
        year: new Date().getFullYear(),
        month: 1,
        status: 'Open',
        fx_rate_locked: false
      })
      .returning()
      .execute();

    // Create USD payroll account
    const usdAccount = await db.insert(accountsTable)
      .values({
        code: 'SAL-USD',
        name: 'USD Salaries',
        account_type: 'Expense',
        currency: 'USD',
        is_payroll_source: true,
        is_active: true
      })
      .returning()
      .execute();

    // Create test journal
    const journalDate4 = new Date().toISOString().split('T')[0];
    const journal = await db.insert(journalsTable)
      .values({
        reference: 'SAL-004',
        description: 'Salary with adjustments',
        journal_date: journalDate4,
        period_id: period[0].id,
        status: 'Posted',
        total_debit: '1000.00',
        total_credit: '1000.00',
        created_by: user[0].id
      })
      .returning()
      .execute();

    // Create debit entry
    await db.insert(journalLinesTable)
      .values({
        journal_id: journal[0].id,
        account_id: usdAccount[0].id,
        description: 'Salary Expense',
        debit_amount: '1500.00',
        credit_amount: '0.00',
        debit_amount_base: '1500.00',
        credit_amount_base: '0.00',
        line_number: 1
      })
      .execute();

    // Create credit entry (adjustment)
    await db.insert(journalLinesTable)
      .values({
        journal_id: journal[0].id,
        account_id: usdAccount[0].id,
        description: 'Salary Adjustment',
        debit_amount: '0.00',
        credit_amount: '500.00',
        debit_amount_base: '0.00',
        credit_amount_base: '500.00',
        line_number: 2
      })
      .execute();

    const result = await getDashboardSalarySplit();

    expect(result.usd_salaries).toEqual(1000); // 1500 - 500 = 1000
    expect(result.pkr_salaries).toEqual(0);
    expect(result.total_pkr).toEqual(1000); // No FX rate, defaults to 1:1
  });

  it('should only include current year transactions', async () => {
    // Create test user
    const user = await db.insert(usersTable)
      .values({
        email: 'test@example.com',
        name: 'Test User',
        role: 'Admin',
        partner_id: null
      })
      .returning()
      .execute();

    // Create current year period
    const currentPeriod = await db.insert(periodsTable)
      .values({
        year: new Date().getFullYear(),
        month: 1,
        status: 'Open',
        fx_rate_locked: false
      })
      .returning()
      .execute();

    // Create last year period
    const lastYearPeriod = await db.insert(periodsTable)
      .values({
        year: new Date().getFullYear() - 1,
        month: 12,
        status: 'Locked',
        fx_rate_locked: true
      })
      .returning()
      .execute();

    // Create USD payroll account
    const usdAccount = await db.insert(accountsTable)
      .values({
        code: 'SAL-USD',
        name: 'USD Salaries',
        account_type: 'Expense',
        currency: 'USD',
        is_payroll_source: true,
        is_active: true
      })
      .returning()
      .execute();

    // Create current year journal
    const currentJournalDate = new Date().toISOString().split('T')[0];
    const currentJournal = await db.insert(journalsTable)
      .values({
        reference: 'SAL-CURRENT',
        description: 'Current Year Salary',
        journal_date: currentJournalDate,
        period_id: currentPeriod[0].id,
        status: 'Posted',
        total_debit: '2000.00',
        total_credit: '2000.00',
        created_by: user[0].id
      })
      .returning()
      .execute();

    // Create last year journal
    const lastYearDate = new Date();
    lastYearDate.setFullYear(lastYearDate.getFullYear() - 1);
    const lastYearJournalDate = lastYearDate.toISOString().split('T')[0];
    
    const lastYearJournal = await db.insert(journalsTable)
      .values({
        reference: 'SAL-LAST',
        description: 'Last Year Salary',
        journal_date: lastYearJournalDate,
        period_id: lastYearPeriod[0].id,
        status: 'Posted',
        total_debit: '5000.00',
        total_credit: '5000.00',
        created_by: user[0].id
      })
      .returning()
      .execute();

    // Create current year journal line
    await db.insert(journalLinesTable)
      .values({
        journal_id: currentJournal[0].id,
        account_id: usdAccount[0].id,
        description: 'Current Year Salary',
        debit_amount: '2000.00',
        credit_amount: '0.00',
        debit_amount_base: '2000.00',
        credit_amount_base: '0.00',
        line_number: 1
      })
      .execute();

    // Create last year journal line
    await db.insert(journalLinesTable)
      .values({
        journal_id: lastYearJournal[0].id,
        account_id: usdAccount[0].id,
        description: 'Last Year Salary',
        debit_amount: '5000.00',
        credit_amount: '0.00',
        debit_amount_base: '5000.00',
        credit_amount_base: '0.00',
        line_number: 1
      })
      .execute();

    const result = await getDashboardSalarySplit();

    // Should only include current year (2000), not last year (5000)
    expect(result.usd_salaries).toEqual(2000);
    expect(result.pkr_salaries).toEqual(0);
    expect(result.total_pkr).toEqual(2000);
  });
});