import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { journalsTable, periodsTable, usersTable, fxRatesTable } from '../db/schema';
import { type CreateJournalInput } from '../schema';
import { createJournal } from '../handlers/create_journal';
import { eq, and } from 'drizzle-orm';

describe('createJournal', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  let testUserId: number;
  let testPeriodId: number;
  let testFxRateId: number;

  beforeEach(async () => {
    // Create test user
    const userResult = await db.insert(usersTable)
      .values({
        email: 'test@example.com',
        name: 'Test User',
        role: 'Finance',
        partner_id: null
      })
      .returning()
      .execute();
    testUserId = userResult[0].id;

    // Create test period
    const periodResult = await db.insert(periodsTable)
      .values({
        year: 2024,
        month: 1,
        status: 'Open',
        fx_rate_locked: false
      })
      .returning()
      .execute();
    testPeriodId = periodResult[0].id;

    // Create test FX rate
    const fxRateResult = await db.insert(fxRatesTable)
      .values({
        from_currency: 'USD',
        to_currency: 'PKR',
        rate: '280.50',
        effective_date: '2024-01-15', // Use string format for date column
        is_locked: false,
        created_by: testUserId
      })
      .returning()
      .execute();
    testFxRateId = fxRateResult[0].id;
  });

  const testInput: CreateJournalInput = {
    reference: 'JE-2024-001',
    description: 'Test journal entry',
    journal_date: new Date('2024-01-15'),
    period_id: 0, // Will be set in test
    fx_rate_id: null
  };

  it('should create a journal entry', async () => {
    const input = { ...testInput, period_id: testPeriodId };
    const result = await createJournal(input, testUserId);

    // Basic field validation
    expect(result.reference).toEqual('JE-2024-001');
    expect(result.description).toEqual('Test journal entry');
    expect(result.journal_date).toEqual(new Date('2024-01-15'));
    expect(result.period_id).toEqual(testPeriodId);
    expect(result.status).toEqual('Draft');
    expect(result.total_debit).toEqual(0);
    expect(result.total_credit).toEqual(0);
    expect(result.fx_rate_id).toBeNull();
    expect(result.created_by).toEqual(testUserId);
    expect(result.posted_by).toBeNull();
    expect(result.posted_at).toBeNull();
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should save journal to database', async () => {
    const input = { ...testInput, period_id: testPeriodId };
    const result = await createJournal(input, testUserId);

    const journals = await db.select()
      .from(journalsTable)
      .where(eq(journalsTable.id, result.id))
      .execute();

    expect(journals).toHaveLength(1);
    expect(journals[0].reference).toEqual('JE-2024-001');
    expect(journals[0].description).toEqual('Test journal entry');
    expect(journals[0].period_id).toEqual(testPeriodId);
    expect(journals[0].status).toEqual('Draft');
    expect(parseFloat(journals[0].total_debit)).toEqual(0);
    expect(parseFloat(journals[0].total_credit)).toEqual(0);
    expect(journals[0].created_by).toEqual(testUserId);
    expect(journals[0].journal_date).toEqual('2024-01-15'); // Database stores as string
  });

  it('should create journal with FX rate', async () => {
    const input = { 
      ...testInput, 
      period_id: testPeriodId, 
      fx_rate_id: testFxRateId 
    };
    const result = await createJournal(input, testUserId);

    expect(result.fx_rate_id).toEqual(testFxRateId);

    const journals = await db.select()
      .from(journalsTable)
      .where(eq(journalsTable.id, result.id))
      .execute();

    expect(journals[0].fx_rate_id).toEqual(testFxRateId);
  });

  it('should validate numeric conversions are correct', async () => {
    const input = { ...testInput, period_id: testPeriodId };
    const result = await createJournal(input, testUserId);

    // Check that numeric fields are returned as numbers
    expect(typeof result.total_debit).toEqual('number');
    expect(typeof result.total_credit).toEqual('number');
    expect(result.total_debit).toEqual(0);
    expect(result.total_credit).toEqual(0);
  });

  it('should throw error for non-existent period', async () => {
    const input = { ...testInput, period_id: 99999 };

    await expect(createJournal(input, testUserId)).rejects.toThrow(/period not found/i);
  });

  it('should throw error for locked period', async () => {
    // Create locked period
    const lockedPeriodResult = await db.insert(periodsTable)
      .values({
        year: 2024,
        month: 2,
        status: 'Locked',
        fx_rate_locked: false
      })
      .returning()
      .execute();

    const input = { ...testInput, period_id: lockedPeriodResult[0].id };

    await expect(createJournal(input, testUserId)).rejects.toThrow(/cannot create journal entry in locked period/i);
  });

  it('should throw error for non-existent FX rate', async () => {
    const input = { 
      ...testInput, 
      period_id: testPeriodId, 
      fx_rate_id: 99999 
    };

    await expect(createJournal(input, testUserId)).rejects.toThrow(/fx rate not found/i);
  });

  it('should enforce reference uniqueness within period', async () => {
    const input = { ...testInput, period_id: testPeriodId };
    
    // Create first journal
    await createJournal(input, testUserId);

    // Try to create second journal with same reference in same period
    await expect(createJournal(input, testUserId)).rejects.toThrow(/journal reference must be unique within the period/i);
  });

  it('should allow same reference in different periods', async () => {
    // Create second period
    const period2Result = await db.insert(periodsTable)
      .values({
        year: 2024,
        month: 2,
        status: 'Open',
        fx_rate_locked: false
      })
      .returning()
      .execute();

    const input1 = { ...testInput, period_id: testPeriodId };
    const input2 = { ...testInput, period_id: period2Result[0].id };

    // Create journal in first period
    const result1 = await createJournal(input1, testUserId);
    
    // Create journal with same reference in second period - should succeed
    const result2 = await createJournal(input2, testUserId);

    expect(result1.reference).toEqual(result2.reference);
    expect(result1.period_id).not.toEqual(result2.period_id);
    expect(result1.id).not.toEqual(result2.id);
  });

  it('should query journals by period correctly', async () => {
    // Create journals in different periods
    const period2Result = await db.insert(periodsTable)
      .values({
        year: 2024,
        month: 2,
        status: 'Open',
        fx_rate_locked: false
      })
      .returning()
      .execute();

    const input1 = { ...testInput, reference: 'JE-2024-001', period_id: testPeriodId };
    const input2 = { ...testInput, reference: 'JE-2024-002', period_id: period2Result[0].id };

    await createJournal(input1, testUserId);
    await createJournal(input2, testUserId);

    // Query journals by specific period
    const period1Journals = await db.select()
      .from(journalsTable)
      .where(eq(journalsTable.period_id, testPeriodId))
      .execute();

    const period2Journals = await db.select()
      .from(journalsTable)
      .where(eq(journalsTable.period_id, period2Result[0].id))
      .execute();

    expect(period1Journals).toHaveLength(1);
    expect(period2Journals).toHaveLength(1);
    expect(period1Journals[0].reference).toEqual('JE-2024-001');
    expect(period2Journals[0].reference).toEqual('JE-2024-002');
  });
});