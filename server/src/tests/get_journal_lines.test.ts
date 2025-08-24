import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { 
  usersTable, 
  periodsTable, 
  accountsTable, 
  journalsTable, 
  journalLinesTable 
} from '../db/schema';
import { getJournalLines } from '../handlers/get_journal_lines';

describe('getJournalLines', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should fetch journal lines for a journal ordered by line number', async () => {
    // Create prerequisite data
    const userResult = await db.insert(usersTable).values({
      email: 'test@example.com',
      name: 'Test User',
      role: 'Admin',
      partner_id: null
    }).returning().execute();

    const periodResult = await db.insert(periodsTable).values({
      year: 2024,
      month: 1,
      status: 'Open',
      fx_rate_locked: false
    }).returning().execute();

    const accountResults = await db.insert(accountsTable).values([
      {
        code: 'CASH001',
        name: 'Cash Account',
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
        code: 'REV001',
        name: 'Revenue Account',
        account_type: 'Income',
        currency: 'USD',
        is_bank: false,
        is_capital: false,
        is_payroll_source: false,
        is_intercompany: false,
        parent_id: null,
        is_active: true
      }
    ]).returning().execute();

    const journalResult = await db.insert(journalsTable).values({
      reference: 'JE001',
      description: 'Test Journal Entry',
      journal_date: '2024-01-15',
      period_id: periodResult[0].id,
      status: 'Draft',
      total_debit: '1000.00',
      total_credit: '1000.00',
      fx_rate_id: null,
      created_by: userResult[0].id,
      posted_by: null,
      posted_at: null
    }).returning().execute();

    // Create journal lines with different line numbers
    await db.insert(journalLinesTable).values([
      {
        journal_id: journalResult[0].id,
        account_id: accountResults[1].id, // Revenue account
        description: 'Revenue line',
        debit_amount: '0.00',
        credit_amount: '1000.00',
        debit_amount_base: '0.00',
        credit_amount_base: '1000.00',
        line_number: 2
      },
      {
        journal_id: journalResult[0].id,
        account_id: accountResults[0].id, // Cash account
        description: 'Cash line',
        debit_amount: '1000.00',
        credit_amount: '0.00',
        debit_amount_base: '1000.00',
        credit_amount_base: '0.00',
        line_number: 1
      }
    ]).execute();

    const result = await getJournalLines(journalResult[0].id);

    expect(result).toHaveLength(2);
    
    // Should be ordered by line_number (1, then 2)
    expect(result[0].line_number).toBe(1);
    expect(result[0].description).toBe('Cash line');
    expect(result[0].debit_amount).toBe(1000.00);
    expect(result[0].credit_amount).toBe(0.00);
    expect(typeof result[0].debit_amount).toBe('number');
    expect(typeof result[0].credit_amount).toBe('number');
    
    expect(result[1].line_number).toBe(2);
    expect(result[1].description).toBe('Revenue line');
    expect(result[1].debit_amount).toBe(0.00);
    expect(result[1].credit_amount).toBe(1000.00);
    expect(typeof result[1].debit_amount).toBe('number');
    expect(typeof result[1].credit_amount).toBe('number');

    // Verify all numeric fields are properly converted
    expect(typeof result[0].debit_amount_base).toBe('number');
    expect(typeof result[0].credit_amount_base).toBe('number');
    expect(typeof result[1].debit_amount_base).toBe('number');
    expect(typeof result[1].credit_amount_base).toBe('number');
  });

  it('should return empty array when journal has no lines', async () => {
    // Create prerequisite data
    const userResult = await db.insert(usersTable).values({
      email: 'test@example.com',
      name: 'Test User',
      role: 'Admin',
      partner_id: null
    }).returning().execute();

    const periodResult = await db.insert(periodsTable).values({
      year: 2024,
      month: 1,
      status: 'Open',
      fx_rate_locked: false
    }).returning().execute();

    const journalResult = await db.insert(journalsTable).values({
      reference: 'JE002',
      description: 'Empty Journal',
      journal_date: '2024-01-15',
      period_id: periodResult[0].id,
      status: 'Draft',
      total_debit: '0.00',
      total_credit: '0.00',
      fx_rate_id: null,
      created_by: userResult[0].id,
      posted_by: null,
      posted_at: null
    }).returning().execute();

    const result = await getJournalLines(journalResult[0].id);

    expect(result).toHaveLength(0);
  });

  it('should return empty array for non-existent journal', async () => {
    const result = await getJournalLines(999999);

    expect(result).toHaveLength(0);
  });

  it('should handle journal lines with decimal amounts correctly', async () => {
    // Create prerequisite data
    const userResult = await db.insert(usersTable).values({
      email: 'test@example.com',
      name: 'Test User',
      role: 'Admin',
      partner_id: null
    }).returning().execute();

    const periodResult = await db.insert(periodsTable).values({
      year: 2024,
      month: 1,
      status: 'Open',
      fx_rate_locked: false
    }).returning().execute();

    const accountResult = await db.insert(accountsTable).values({
      code: 'CASH001',
      name: 'Cash Account',
      account_type: 'Asset',
      currency: 'USD',
      is_bank: true,
      is_capital: false,
      is_payroll_source: false,
      is_intercompany: false,
      parent_id: null,
      is_active: true
    }).returning().execute();

    const journalResult = await db.insert(journalsTable).values({
      reference: 'JE003',
      description: 'Decimal Test Journal',
      journal_date: '2024-01-15',
      period_id: periodResult[0].id,
      status: 'Draft',
      total_debit: '123.45',
      total_credit: '123.45',
      fx_rate_id: null,
      created_by: userResult[0].id,
      posted_by: null,
      posted_at: null
    }).returning().execute();

    await db.insert(journalLinesTable).values({
      journal_id: journalResult[0].id,
      account_id: accountResult[0].id,
      description: 'Decimal amount line',
      debit_amount: '123.45',
      credit_amount: '0.00',
      debit_amount_base: '456.78',
      credit_amount_base: '0.00',
      line_number: 1
    }).execute();

    const result = await getJournalLines(journalResult[0].id);

    expect(result).toHaveLength(1);
    expect(result[0].debit_amount).toBe(123.45);
    expect(result[0].credit_amount).toBe(0.00);
    expect(result[0].debit_amount_base).toBe(456.78);
    expect(result[0].credit_amount_base).toBe(0.00);
  });

  it('should handle multiple journal lines with complex ordering', async () => {
    // Create prerequisite data
    const userResult = await db.insert(usersTable).values({
      email: 'test@example.com',
      name: 'Test User',
      role: 'Admin',
      partner_id: null
    }).returning().execute();

    const periodResult = await db.insert(periodsTable).values({
      year: 2024,
      month: 1,
      status: 'Open',
      fx_rate_locked: false
    }).returning().execute();

    const accountResults = await db.insert(accountsTable).values([
      {
        code: 'CASH001',
        name: 'Cash Account',
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
        code: 'EXP001',
        name: 'Expense Account',
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
        code: 'REV001',
        name: 'Revenue Account',
        account_type: 'Income',
        currency: 'USD',
        is_bank: false,
        is_capital: false,
        is_payroll_source: false,
        is_intercompany: false,
        parent_id: null,
        is_active: true
      }
    ]).returning().execute();

    const journalResult = await db.insert(journalsTable).values({
      reference: 'JE004',
      description: 'Complex Journal Entry',
      journal_date: '2024-01-15',
      period_id: periodResult[0].id,
      status: 'Draft',
      total_debit: '1500.00',
      total_credit: '1500.00',
      fx_rate_id: null,
      created_by: userResult[0].id,
      posted_by: null,
      posted_at: null
    }).returning().execute();

    // Insert lines in non-sequential order to test ordering
    await db.insert(journalLinesTable).values([
      {
        journal_id: journalResult[0].id,
        account_id: accountResults[1].id, // Expense
        description: 'Expense line',
        debit_amount: '500.00',
        credit_amount: '0.00',
        debit_amount_base: '500.00',
        credit_amount_base: '0.00',
        line_number: 3
      },
      {
        journal_id: journalResult[0].id,
        account_id: accountResults[0].id, // Cash
        description: 'Cash line',
        debit_amount: '1000.00',
        credit_amount: '0.00',
        debit_amount_base: '1000.00',
        credit_amount_base: '0.00',
        line_number: 1
      },
      {
        journal_id: journalResult[0].id,
        account_id: accountResults[2].id, // Revenue
        description: 'Revenue line',
        debit_amount: '0.00',
        credit_amount: '1500.00',
        debit_amount_base: '0.00',
        credit_amount_base: '1500.00',
        line_number: 2
      }
    ]).execute();

    const result = await getJournalLines(journalResult[0].id);

    expect(result).toHaveLength(3);
    
    // Should be ordered by line_number (1, 2, 3)
    expect(result[0].line_number).toBe(1);
    expect(result[0].description).toBe('Cash line');
    expect(result[0].account_id).toBe(accountResults[0].id);
    
    expect(result[1].line_number).toBe(2);
    expect(result[1].description).toBe('Revenue line');
    expect(result[1].account_id).toBe(accountResults[2].id);
    
    expect(result[2].line_number).toBe(3);
    expect(result[2].description).toBe('Expense line');
    expect(result[2].account_id).toBe(accountResults[1].id);

    // Verify all returned data has correct types
    result.forEach(line => {
      expect(typeof line.id).toBe('number');
      expect(typeof line.journal_id).toBe('number');
      expect(typeof line.account_id).toBe('number');
      expect(typeof line.description).toBe('string');
      expect(typeof line.debit_amount).toBe('number');
      expect(typeof line.credit_amount).toBe('number');
      expect(typeof line.debit_amount_base).toBe('number');
      expect(typeof line.credit_amount_base).toBe('number');
      expect(typeof line.line_number).toBe('number');
      expect(line.created_at).toBeInstanceOf(Date);
      expect(line.updated_at).toBeInstanceOf(Date);
    });
  });
});