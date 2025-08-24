import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { partnersTable, accountsTable, usersTable, periodsTable, journalsTable, journalLinesTable } from '../db/schema';
import { getDashboardPartnerCapital } from '../handlers/get_dashboard_partner_capital';
import { eq } from 'drizzle-orm';

describe('getDashboardPartnerCapital', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return empty array when no partners exist', async () => {
    const result = await getDashboardPartnerCapital();
    expect(result).toEqual([]);
  });

  it('should calculate partner capital with USD and PKR accounts', async () => {
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

    // Create capital accounts
    const usdAccount = await db.insert(accountsTable)
      .values({
        code: 'CAP-USD-001',
        name: 'Partner Capital USD',
        account_type: 'Equity',
        currency: 'USD',
        is_capital: true,
        is_active: true
      })
      .returning()
      .execute();

    const pkrAccount = await db.insert(accountsTable)
      .values({
        code: 'CAP-PKR-001',
        name: 'Partner Capital PKR',
        account_type: 'Equity',
        currency: 'PKR',
        is_capital: true,
        is_active: true
      })
      .returning()
      .execute();

    // Create test partner
    const partner = await db.insert(partnersTable)
      .values({
        name: 'Test Partner',
        usd_account_id: usdAccount[0].id,
        pkr_account_id: pkrAccount[0].id
      })
      .returning()
      .execute();

    // Create test period
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth() + 1;

    const period = await db.insert(periodsTable)
      .values({
        year: currentYear,
        month: currentMonth,
        status: 'Open'
      })
      .returning()
      .execute();

    // Create test journal
    const journal = await db.insert(journalsTable)
      .values({
        reference: 'CAP-001',
        description: 'Capital contribution',
        journal_date: new Date().toISOString().split('T')[0],
        period_id: period[0].id,
        status: 'Posted',
        total_debit: '50000.00',
        total_credit: '50000.00',
        created_by: user[0].id
      })
      .returning()
      .execute();

    // Create journal lines for capital contributions
    await db.insert(journalLinesTable)
      .values([
        {
          journal_id: journal[0].id,
          account_id: usdAccount[0].id,
          description: 'Capital contribution USD',
          debit_amount: '0.00',
          credit_amount: '25000.00',
          debit_amount_base: '0.00',
          credit_amount_base: '25000.00',
          line_number: 1
        },
        {
          journal_id: journal[0].id,
          account_id: pkrAccount[0].id,
          description: 'Capital contribution PKR',
          debit_amount: '0.00',
          credit_amount: '25000.00',
          debit_amount_base: '0.00',
          credit_amount_base: '25000.00',
          line_number: 2
        }
      ])
      .execute();

    const result = await getDashboardPartnerCapital();

    expect(result).toHaveLength(1);
    expect(result[0].partner_id).toEqual(partner[0].id);
    expect(result[0].partner_name).toEqual('Test Partner');
    expect(result[0].capital_usd).toEqual(25000);
    expect(result[0].capital_pkr).toEqual(25000);
    expect(typeof result[0].pl_share_mtd).toBe('number');
    expect(typeof result[0].pl_share_ytd).toBe('number');
  });

  it('should calculate P&L shares correctly with income and expenses', async () => {
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

    // Create test accounts
    const incomeAccount = await db.insert(accountsTable)
      .values({
        code: 'INC-001',
        name: 'Revenue',
        account_type: 'Income',
        currency: 'USD',
        is_active: true
      })
      .returning()
      .execute();

    const expenseAccount = await db.insert(accountsTable)
      .values({
        code: 'EXP-001',
        name: 'Office Expenses',
        account_type: 'Expense',
        currency: 'USD',
        is_active: true
      })
      .returning()
      .execute();

    // Create two test partners for equal split testing
    const partner1 = await db.insert(partnersTable)
      .values({
        name: 'Partner 1',
        usd_account_id: null,
        pkr_account_id: null
      })
      .returning()
      .execute();

    const partner2 = await db.insert(partnersTable)
      .values({
        name: 'Partner 2',
        usd_account_id: null,
        pkr_account_id: null
      })
      .returning()
      .execute();

    // Create test period
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth() + 1;

    const period = await db.insert(periodsTable)
      .values({
        year: currentYear,
        month: currentMonth,
        status: 'Open'
      })
      .returning()
      .execute();

    // Create test journal with P&L transactions
    const journal = await db.insert(journalsTable)
      .values({
        reference: 'PL-001',
        description: 'P&L transactions',
        journal_date: new Date().toISOString().split('T')[0],
        period_id: period[0].id,
        status: 'Posted',
        total_debit: '15000.00',
        total_credit: '15000.00',
        created_by: user[0].id
      })
      .returning()
      .execute();

    // Create journal lines for income and expense
    await db.insert(journalLinesTable)
      .values([
        {
          journal_id: journal[0].id,
          account_id: incomeAccount[0].id,
          description: 'Revenue earned',
          debit_amount: '0.00',
          credit_amount: '10000.00',
          debit_amount_base: '0.00',
          credit_amount_base: '10000.00',
          line_number: 1
        },
        {
          journal_id: journal[0].id,
          account_id: expenseAccount[0].id,
          description: 'Office expense',
          debit_amount: '4000.00',
          credit_amount: '0.00',
          debit_amount_base: '4000.00',
          credit_amount_base: '0.00',
          line_number: 2
        }
      ])
      .execute();

    const result = await getDashboardPartnerCapital();

    expect(result).toHaveLength(2);
    
    // Each partner should get 50% of net profit (10000 - 4000 = 6000, so 3000 each)
    const expectedPLShare = 3000;
    
    expect(result[0].partner_name).toEqual('Partner 1');
    expect(result[0].pl_share_mtd).toEqual(expectedPLShare);
    expect(result[0].pl_share_ytd).toEqual(expectedPLShare);
    
    expect(result[1].partner_name).toEqual('Partner 2');
    expect(result[1].pl_share_mtd).toEqual(expectedPLShare);
    expect(result[1].pl_share_ytd).toEqual(expectedPLShare);
  });

  it('should handle partner with only USD account', async () => {
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

    // Create only USD account
    const usdAccount = await db.insert(accountsTable)
      .values({
        code: 'CAP-USD-001',
        name: 'Partner Capital USD',
        account_type: 'Equity',
        currency: 'USD',
        is_capital: true,
        is_active: true
      })
      .returning()
      .execute();

    // Create test partner with only USD account
    const partner = await db.insert(partnersTable)
      .values({
        name: 'USD Partner',
        usd_account_id: usdAccount[0].id,
        pkr_account_id: null
      })
      .returning()
      .execute();

    const result = await getDashboardPartnerCapital();

    expect(result).toHaveLength(1);
    expect(result[0].partner_name).toEqual('USD Partner');
    expect(result[0].capital_usd).toEqual(0); // No transactions yet
    expect(result[0].capital_pkr).toEqual(0); // No PKR account
  });

  it('should handle partner with only PKR account', async () => {
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

    // Create only PKR account
    const pkrAccount = await db.insert(accountsTable)
      .values({
        code: 'CAP-PKR-001',
        name: 'Partner Capital PKR',
        account_type: 'Equity',
        currency: 'PKR',
        is_capital: true,
        is_active: true
      })
      .returning()
      .execute();

    // Create test partner with only PKR account
    const partner = await db.insert(partnersTable)
      .values({
        name: 'PKR Partner',
        usd_account_id: null,
        pkr_account_id: pkrAccount[0].id
      })
      .returning()
      .execute();

    const result = await getDashboardPartnerCapital();

    expect(result).toHaveLength(1);
    expect(result[0].partner_name).toEqual('PKR Partner');
    expect(result[0].capital_usd).toEqual(0); // No USD account
    expect(result[0].capital_pkr).toEqual(0); // No transactions yet
  });

  it('should only include posted journals in calculations', async () => {
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

    // Create capital account
    const usdAccount = await db.insert(accountsTable)
      .values({
        code: 'CAP-USD-001',
        name: 'Partner Capital USD',
        account_type: 'Equity',
        currency: 'USD',
        is_capital: true,
        is_active: true
      })
      .returning()
      .execute();

    // Create test partner
    const partner = await db.insert(partnersTable)
      .values({
        name: 'Test Partner',
        usd_account_id: usdAccount[0].id,
        pkr_account_id: null
      })
      .returning()
      .execute();

    // Create test period
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth() + 1;

    const period = await db.insert(periodsTable)
      .values({
        year: currentYear,
        month: currentMonth,
        status: 'Open'
      })
      .returning()
      .execute();

    // Create draft journal (should be excluded)
    const draftJournal = await db.insert(journalsTable)
      .values({
        reference: 'DRAFT-001',
        description: 'Draft capital contribution',
        journal_date: new Date().toISOString().split('T')[0],
        period_id: period[0].id,
        status: 'Draft',
        total_debit: '10000.00',
        total_credit: '10000.00',
        created_by: user[0].id
      })
      .returning()
      .execute();

    // Create posted journal (should be included)
    const postedJournal = await db.insert(journalsTable)
      .values({
        reference: 'POSTED-001',
        description: 'Posted capital contribution',
        journal_date: new Date().toISOString().split('T')[0],
        period_id: period[0].id,
        status: 'Posted',
        total_debit: '5000.00',
        total_credit: '5000.00',
        created_by: user[0].id
      })
      .returning()
      .execute();

    // Create journal lines for both journals
    await db.insert(journalLinesTable)
      .values([
        {
          journal_id: draftJournal[0].id,
          account_id: usdAccount[0].id,
          description: 'Draft capital contribution',
          debit_amount: '0.00',
          credit_amount: '10000.00',
          debit_amount_base: '0.00',
          credit_amount_base: '10000.00',
          line_number: 1
        },
        {
          journal_id: postedJournal[0].id,
          account_id: usdAccount[0].id,
          description: 'Posted capital contribution',
          debit_amount: '0.00',
          credit_amount: '5000.00',
          debit_amount_base: '0.00',
          credit_amount_base: '5000.00',
          line_number: 1
        }
      ])
      .execute();

    const result = await getDashboardPartnerCapital();

    expect(result).toHaveLength(1);
    expect(result[0].capital_usd).toEqual(5000); // Only posted journal included
  });

  it('should handle debit and credit amounts correctly', async () => {
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

    // Create capital account
    const usdAccount = await db.insert(accountsTable)
      .values({
        code: 'CAP-USD-001',
        name: 'Partner Capital USD',
        account_type: 'Equity',
        currency: 'USD',
        is_capital: true,
        is_active: true
      })
      .returning()
      .execute();

    // Create test partner
    const partner = await db.insert(partnersTable)
      .values({
        name: 'Test Partner',
        usd_account_id: usdAccount[0].id,
        pkr_account_id: null
      })
      .returning()
      .execute();

    // Create test period
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth() + 1;

    const period = await db.insert(periodsTable)
      .values({
        year: currentYear,
        month: currentMonth,
        status: 'Open'
      })
      .returning()
      .execute();

    // Create journals with both credits and debits
    const journal1 = await db.insert(journalsTable)
      .values({
        reference: 'CAP-CONTRIB-001',
        description: 'Capital contribution',
        journal_date: new Date().toISOString().split('T')[0],
        period_id: period[0].id,
        status: 'Posted',
        total_debit: '10000.00',
        total_credit: '10000.00',
        created_by: user[0].id
      })
      .returning()
      .execute();

    const journal2 = await db.insert(journalsTable)
      .values({
        reference: 'CAP-DRAW-001',
        description: 'Capital draw',
        journal_date: new Date().toISOString().split('T')[0],
        period_id: period[0].id,
        status: 'Posted',
        total_debit: '3000.00',
        total_credit: '3000.00',
        created_by: user[0].id
      })
      .returning()
      .execute();

    // Create journal lines
    await db.insert(journalLinesTable)
      .values([
        {
          journal_id: journal1[0].id,
          account_id: usdAccount[0].id,
          description: 'Capital contribution',
          debit_amount: '0.00',
          credit_amount: '10000.00',
          debit_amount_base: '0.00',
          credit_amount_base: '10000.00',
          line_number: 1
        },
        {
          journal_id: journal2[0].id,
          account_id: usdAccount[0].id,
          description: 'Capital draw',
          debit_amount: '3000.00',
          credit_amount: '0.00',
          debit_amount_base: '3000.00',
          credit_amount_base: '0.00',
          line_number: 1
        }
      ])
      .execute();

    const result = await getDashboardPartnerCapital();

    expect(result).toHaveLength(1);
    // Net capital should be credit - debit = 10000 - 3000 = 7000
    expect(result[0].capital_usd).toEqual(7000);
  });
});