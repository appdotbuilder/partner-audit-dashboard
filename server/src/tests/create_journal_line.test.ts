import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { 
  journalLinesTable, 
  journalsTable, 
  accountsTable, 
  periodsTable, 
  usersTable,
  fxRatesTable
} from '../db/schema';
import { type CreateJournalLineInput } from '../schema';
import { createJournalLine } from '../handlers/create_journal_line';
import { eq } from 'drizzle-orm';

describe('createJournalLine', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  let testUserId: number;
  let testPeriodId: number;
  let testAccountId: number;
  let testJournalId: number;
  let testFxRateId: number;

  beforeEach(async () => {
    // Create test user
    const userResult = await db.insert(usersTable)
      .values({
        email: 'test@example.com',
        name: 'Test User',
        role: 'Finance'
      })
      .returning()
      .execute();
    testUserId = userResult[0].id;

    // Create test period
    const periodResult = await db.insert(periodsTable)
      .values({
        year: 2024,
        month: 1,
        status: 'Open'
      })
      .returning()
      .execute();
    testPeriodId = periodResult[0].id;

    // Create test account
    const accountResult = await db.insert(accountsTable)
      .values({
        code: '1001',
        name: 'Cash USD',
        account_type: 'Asset',
        currency: 'USD',
        is_active: true
      })
      .returning()
      .execute();
    testAccountId = accountResult[0].id;

    // Create test FX rate
    const fxRateResult = await db.insert(fxRatesTable)
      .values({
        from_currency: 'USD',
        to_currency: 'PKR',
        rate: '280.00',
        effective_date: '2024-01-01',
        created_by: testUserId
      })
      .returning()
      .execute();
    testFxRateId = fxRateResult[0].id;

    // Create test journal
    const journalResult = await db.insert(journalsTable)
      .values({
        reference: 'JE-001',
        description: 'Test Journal',
        journal_date: '2024-01-15',
        period_id: testPeriodId,
        status: 'Draft',
        fx_rate_id: testFxRateId,
        created_by: testUserId
      })
      .returning()
      .execute();
    testJournalId = journalResult[0].id;
  });

  const createTestInput = (overrides: Partial<CreateJournalLineInput> = {}): CreateJournalLineInput => ({
    journal_id: testJournalId,
    account_id: testAccountId,
    description: 'Test journal line',
    debit_amount: 1000,
    credit_amount: 0,
    debit_amount_base: 280000,
    credit_amount_base: 0,
    line_number: 1,
    ...overrides
  });

  it('should create a debit journal line', async () => {
    const input = createTestInput();
    const result = await createJournalLine(input);

    expect(result.journal_id).toEqual(testJournalId);
    expect(result.account_id).toEqual(testAccountId);
    expect(result.description).toEqual('Test journal line');
    expect(result.debit_amount).toEqual(1000);
    expect(result.credit_amount).toEqual(0);
    expect(result.debit_amount_base).toEqual(280000);
    expect(result.credit_amount_base).toEqual(0);
    expect(result.line_number).toEqual(1);
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should create a credit journal line', async () => {
    const input = createTestInput({
      debit_amount: 0,
      credit_amount: 500,
      debit_amount_base: 0,
      credit_amount_base: 140000
    });
    const result = await createJournalLine(input);

    expect(result.debit_amount).toEqual(0);
    expect(result.credit_amount).toEqual(500);
    expect(result.debit_amount_base).toEqual(0);
    expect(result.credit_amount_base).toEqual(140000);
  });

  it('should save journal line to database', async () => {
    const input = createTestInput();
    const result = await createJournalLine(input);

    const journalLines = await db.select()
      .from(journalLinesTable)
      .where(eq(journalLinesTable.id, result.id))
      .execute();

    expect(journalLines).toHaveLength(1);
    expect(journalLines[0].journal_id).toEqual(testJournalId);
    expect(journalLines[0].account_id).toEqual(testAccountId);
    expect(journalLines[0].description).toEqual('Test journal line');
    expect(parseFloat(journalLines[0].debit_amount)).toEqual(1000);
    expect(parseFloat(journalLines[0].credit_amount)).toEqual(0);
    expect(parseFloat(journalLines[0].debit_amount_base)).toEqual(280000);
    expect(parseFloat(journalLines[0].credit_amount_base)).toEqual(0);
    expect(journalLines[0].line_number).toEqual(1);
  });

  it('should calculate base currency amounts using FX rate for debit', async () => {
    const input = createTestInput({
      debit_amount: 100,
      credit_amount: 0,
      debit_amount_base: 0, // Will be calculated
      credit_amount_base: 0
    });
    const result = await createJournalLine(input);

    // 100 USD * 280 PKR/USD = 28000 PKR
    expect(result.debit_amount_base).toEqual(28000);
    expect(result.credit_amount_base).toEqual(0);
  });

  it('should calculate base currency amounts using FX rate for credit', async () => {
    const input = createTestInput({
      debit_amount: 0,
      credit_amount: 200,
      debit_amount_base: 0,
      credit_amount_base: 0 // Will be calculated
    });
    const result = await createJournalLine(input);

    // 200 USD * 280 PKR/USD = 56000 PKR
    expect(result.debit_amount_base).toEqual(0);
    expect(result.credit_amount_base).toEqual(56000);
  });

  it('should handle PKR accounts without FX conversion', async () => {
    // Create PKR account
    const pkrAccountResult = await db.insert(accountsTable)
      .values({
        code: '1002',
        name: 'Cash PKR',
        account_type: 'Asset',
        currency: 'PKR',
        is_active: true
      })
      .returning()
      .execute();

    const input = createTestInput({
      account_id: pkrAccountResult[0].id,
      debit_amount: 50000,
      credit_amount: 0,
      debit_amount_base: 0,
      credit_amount_base: 0
    });
    const result = await createJournalLine(input);

    // For PKR accounts, base amount should equal original amount
    expect(result.debit_amount_base).toEqual(50000);
    expect(result.credit_amount_base).toEqual(0);
  });

  it('should reject journal line with both debit and credit amounts', async () => {
    const input = createTestInput({
      debit_amount: 1000,
      credit_amount: 500
    });

    await expect(createJournalLine(input)).rejects.toThrow(/both debit and credit amounts/i);
  });

  it('should reject journal line with zero amounts', async () => {
    const input = createTestInput({
      debit_amount: 0,
      credit_amount: 0
    });

    await expect(createJournalLine(input)).rejects.toThrow(/either debit or credit amount greater than zero/i);
  });

  it('should reject line for non-existent journal', async () => {
    const input = createTestInput({
      journal_id: 99999
    });

    await expect(createJournalLine(input)).rejects.toThrow(/journal not found/i);
  });

  it('should reject line for posted journal', async () => {
    // Update journal to Posted status
    await db.update(journalsTable)
      .set({ status: 'Posted' })
      .where(eq(journalsTable.id, testJournalId))
      .execute();

    const input = createTestInput();

    await expect(createJournalLine(input)).rejects.toThrow(/cannot add lines to a posted journal/i);
  });

  it('should reject line for non-existent account', async () => {
    const input = createTestInput({
      account_id: 99999
    });

    await expect(createJournalLine(input)).rejects.toThrow(/account not found or inactive/i);
  });

  it('should reject line for inactive account', async () => {
    // Create inactive account
    const inactiveAccountResult = await db.insert(accountsTable)
      .values({
        code: '1999',
        name: 'Inactive Account',
        account_type: 'Asset',
        currency: 'USD',
        is_active: false
      })
      .returning()
      .execute();

    const input = createTestInput({
      account_id: inactiveAccountResult[0].id
    });

    await expect(createJournalLine(input)).rejects.toThrow(/account not found or inactive/i);
  });

  it('should handle journal without FX rate', async () => {
    // Create journal without FX rate
    const journalWithoutFxResult = await db.insert(journalsTable)
      .values({
        reference: 'JE-002',
        description: 'Journal without FX',
        journal_date: '2024-01-15',
        period_id: testPeriodId,
        status: 'Draft',
        fx_rate_id: null,
        created_by: testUserId
      })
      .returning()
      .execute();

    const input = createTestInput({
      journal_id: journalWithoutFxResult[0].id,
      debit_amount: 1000,
      credit_amount: 0,
      debit_amount_base: 0,
      credit_amount_base: 0
    });
    const result = await createJournalLine(input);

    // Without FX rate, base amounts should equal original amounts
    expect(result.debit_amount_base).toEqual(1000);
    expect(result.credit_amount_base).toEqual(0);
  });

  it('should handle multiple line numbers correctly', async () => {
    const input1 = createTestInput({ line_number: 1 });
    const input2 = createTestInput({ 
      line_number: 2,
      debit_amount: 0,
      credit_amount: 1000,
      debit_amount_base: 0,
      credit_amount_base: 280000
    });

    const result1 = await createJournalLine(input1);
    const result2 = await createJournalLine(input2);

    expect(result1.line_number).toEqual(1);
    expect(result2.line_number).toEqual(2);
    expect(result1.id).not.toEqual(result2.id);
  });
});