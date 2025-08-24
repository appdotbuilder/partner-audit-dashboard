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
import { getGeneralLedgerReport } from '../handlers/get_general_ledger_report';

describe('getGeneralLedgerReport', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  let userId: number;
  let accountId1: number;
  let accountId2: number;
  let periodId: number;
  let journalId1: number;
  let journalId2: number;

  beforeEach(async () => {
    // Create user
    const users = await db.insert(usersTable)
      .values({
        email: 'test@example.com',
        name: 'Test User',
        role: 'Admin',
        partner_id: null
      })
      .returning()
      .execute();
    userId = users[0].id;

    // Create accounts
    const accounts = await db.insert(accountsTable)
      .values([
        {
          code: '1000',
          name: 'Cash Account',
          account_type: 'Asset',
          currency: 'USD',
          is_active: true
        },
        {
          code: '2000',
          name: 'Liability Account',
          account_type: 'Liability',
          currency: 'USD',
          is_active: true
        }
      ])
      .returning()
      .execute();
    accountId1 = accounts[0].id;
    accountId2 = accounts[1].id;

    // Create period
    const periods = await db.insert(periodsTable)
      .values({
        year: 2024,
        month: 1,
        status: 'Open',
        fx_rate_locked: false
      })
      .returning()
      .execute();
    periodId = periods[0].id;

    // Create journals with different dates
    const journals = await db.insert(journalsTable)
      .values([
        {
          reference: 'JNL001',
          description: 'First Journal Entry',
          journal_date: '2024-01-15',
          period_id: periodId,
          status: 'Posted',
          total_debit: '1000.00',
          total_credit: '1000.00',
          created_by: userId
        },
        {
          reference: 'JNL002',
          description: 'Second Journal Entry',
          journal_date: '2024-01-20',
          period_id: periodId,
          status: 'Posted',
          total_debit: '500.00',
          total_credit: '500.00',
          created_by: userId
        }
      ])
      .returning()
      .execute();
    journalId1 = journals[0].id;
    journalId2 = journals[1].id;

    // Create journal lines for running balance calculation
    await db.insert(journalLinesTable)
      .values([
        // Journal 1 lines
        {
          journal_id: journalId1,
          account_id: accountId1,
          description: 'Cash debit entry',
          debit_amount: '1000.00',
          credit_amount: '0.00',
          debit_amount_base: '1000.00',
          credit_amount_base: '0.00',
          line_number: 1
        },
        {
          journal_id: journalId1,
          account_id: accountId2,
          description: 'Liability credit entry',
          debit_amount: '0.00',
          credit_amount: '1000.00',
          debit_amount_base: '0.00',
          credit_amount_base: '1000.00',
          line_number: 2
        },
        // Journal 2 lines
        {
          journal_id: journalId2,
          account_id: accountId1,
          description: 'Cash credit entry',
          debit_amount: '0.00',
          credit_amount: '500.00',
          debit_amount_base: '0.00',
          credit_amount_base: '500.00',
          line_number: 1
        },
        {
          journal_id: journalId2,
          account_id: accountId2,
          description: 'Liability debit entry',
          debit_amount: '500.00',
          credit_amount: '0.00',
          debit_amount_base: '500.00',
          credit_amount_base: '0.00',
          line_number: 2
        }
      ])
      .execute();
  });

  it('should return all entries when no filters applied', async () => {
    const result = await getGeneralLedgerReport();

    expect(result).toHaveLength(4);
    expect(result[0].account_code).toBe('1000');
    expect(result[0].account_name).toBe('Cash Account');
    expect(result[0].journal_reference).toBe('JNL001');
    expect(result[0].debit_amount).toBe(1000);
    expect(result[0].credit_amount).toBe(0);
    expect(typeof result[0].running_balance).toBe('number');
  });

  it('should calculate running balances correctly', async () => {
    const result = await getGeneralLedgerReport(accountId1);

    expect(result).toHaveLength(2);
    
    // First entry: +1000 debit
    expect(result[0].debit_amount).toBe(1000);
    expect(result[0].credit_amount).toBe(0);
    expect(result[0].running_balance).toBe(1000);
    
    // Second entry: -500 credit (running balance should be 500)
    expect(result[1].debit_amount).toBe(0);
    expect(result[1].credit_amount).toBe(500);
    expect(result[1].running_balance).toBe(500);
  });

  it('should filter by account ID correctly', async () => {
    const result = await getGeneralLedgerReport(accountId2);

    expect(result).toHaveLength(2);
    expect(result.every(r => r.account_id === accountId2)).toBe(true);
    expect(result.every(r => r.account_code === '2000')).toBe(true);
    expect(result.every(r => r.account_name === 'Liability Account')).toBe(true);
  });

  it('should filter by date range correctly', async () => {
    const fromDate = new Date('2024-01-18');
    const toDate = new Date('2024-01-25');
    
    const result = await getGeneralLedgerReport(undefined, fromDate, toDate);

    expect(result).toHaveLength(2);
    expect(result.every(r => r.journal_reference === 'JNL002')).toBe(true);
    expect(result.every(r => r.journal_date >= fromDate)).toBe(true);
    expect(result.every(r => r.journal_date <= toDate)).toBe(true);
  });

  it('should filter by from date only', async () => {
    const fromDate = new Date('2024-01-18');
    
    const result = await getGeneralLedgerReport(undefined, fromDate);

    expect(result).toHaveLength(2);
    expect(result.every(r => r.journal_reference === 'JNL002')).toBe(true);
    expect(result.every(r => r.journal_date >= fromDate)).toBe(true);
  });

  it('should filter by to date only', async () => {
    const toDate = new Date('2024-01-16');
    
    const result = await getGeneralLedgerReport(undefined, undefined, toDate);

    expect(result).toHaveLength(2);
    expect(result.every(r => r.journal_reference === 'JNL001')).toBe(true);
    expect(result.every(r => r.journal_date <= toDate)).toBe(true);
  });

  it('should combine account ID and date filters', async () => {
    const fromDate = new Date('2024-01-18');
    
    const result = await getGeneralLedgerReport(accountId1, fromDate);

    expect(result).toHaveLength(1);
    expect(result[0].account_id).toBe(accountId1);
    expect(result[0].journal_reference).toBe('JNL002');
    expect(result[0].journal_date >= fromDate).toBe(true);
  });

  it('should return entries ordered by account, date, and line number', async () => {
    const result = await getGeneralLedgerReport();

    // Should be ordered by account_id first
    expect(result[0].account_id).toBeLessThanOrEqual(result[1].account_id);
    
    // Within same account, should be ordered by date
    const account1Entries = result.filter(r => r.account_id === accountId1);
    if (account1Entries.length > 1) {
      expect(account1Entries[0].journal_date <= account1Entries[1].journal_date).toBe(true);
    }
  });

  it('should return empty array when no matching entries found', async () => {
    const futureDate = new Date('2025-01-01');
    
    const result = await getGeneralLedgerReport(undefined, futureDate);

    expect(result).toHaveLength(0);
  });

  it('should handle numeric conversions correctly', async () => {
    const result = await getGeneralLedgerReport(accountId1);

    expect(typeof result[0].debit_amount).toBe('number');
    expect(typeof result[0].credit_amount).toBe('number');
    expect(typeof result[0].running_balance).toBe('number');
    expect(result[0].debit_amount).toBe(1000);
    expect(result[0].credit_amount).toBe(0);
  });

  it('should include all required report fields', async () => {
    const result = await getGeneralLedgerReport();

    expect(result[0]).toHaveProperty('account_id');
    expect(result[0]).toHaveProperty('account_code');
    expect(result[0]).toHaveProperty('account_name');
    expect(result[0]).toHaveProperty('journal_date');
    expect(result[0]).toHaveProperty('journal_reference');
    expect(result[0]).toHaveProperty('description');
    expect(result[0]).toHaveProperty('debit_amount');
    expect(result[0]).toHaveProperty('credit_amount');
    expect(result[0]).toHaveProperty('running_balance');
    
    expect(result[0].journal_date).toBeInstanceOf(Date);
  });
});