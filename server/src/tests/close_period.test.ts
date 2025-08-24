import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { periodsTable, journalsTable, fxRatesTable, usersTable } from '../db/schema';
import { closePeriod } from '../handlers/close_period';
import { eq } from 'drizzle-orm';

describe('closePeriod', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should close an open period with all validations passed', async () => {
    // Create a test user
    const userResult = await db.insert(usersTable)
      .values({
        email: 'test@example.com',
        name: 'Test User',
        role: 'Admin',
        partner_id: null
      })
      .returning()
      .execute();
    const userId = userResult[0].id;

    // Create an open period
    const periodResult = await db.insert(periodsTable)
      .values({
        year: 2024,
        month: 3,
        status: 'Open',
        fx_rate_locked: true
      })
      .returning()
      .execute();
    const periodId = periodResult[0].id;

    // Create a posted journal for the period
    const journalResult = await db.insert(journalsTable)
      .values({
        reference: 'JE-001',
        description: 'Test journal entry',
        journal_date: '2024-03-15',
        period_id: periodId,
        status: 'Posted',
        total_debit: '1000.00',
        total_credit: '1000.00',
        created_by: userId,
        posted_by: userId,
        posted_at: new Date()
      })
      .returning()
      .execute();

    const result = await closePeriod(periodId, userId);

    // Verify the result
    expect(result.id).toEqual(periodId);
    expect(result.year).toEqual(2024);
    expect(result.month).toEqual(3);
    expect(result.status).toEqual('Locked');
    expect(result.fx_rate_locked).toEqual(true);
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);

    // Verify the period was actually updated in database
    const updatedPeriods = await db.select()
      .from(periodsTable)
      .where(eq(periodsTable.id, periodId))
      .execute();

    expect(updatedPeriods).toHaveLength(1);
    expect(updatedPeriods[0].status).toEqual('Locked');
    expect(updatedPeriods[0].fx_rate_locked).toEqual(true);
  });

  it('should throw error when period does not exist', async () => {
    const userId = 1;
    const nonExistentPeriodId = 999;

    await expect(closePeriod(nonExistentPeriodId, userId))
      .rejects.toThrow(/Period with ID 999 not found/i);
  });

  it('should throw error when period is already locked', async () => {
    // Create a test user
    const userResult = await db.insert(usersTable)
      .values({
        email: 'test@example.com',
        name: 'Test User',
        role: 'Admin',
        partner_id: null
      })
      .returning()
      .execute();
    const userId = userResult[0].id;

    // Create a locked period
    const periodResult = await db.insert(periodsTable)
      .values({
        year: 2024,
        month: 4,
        status: 'Locked',
        fx_rate_locked: true
      })
      .returning()
      .execute();
    const periodId = periodResult[0].id;

    await expect(closePeriod(periodId, userId))
      .rejects.toThrow(/Period 2024-4 is already locked/i);
  });

  it('should throw error when draft journals exist in the period', async () => {
    // Create a test user
    const userResult = await db.insert(usersTable)
      .values({
        email: 'test@example.com',
        name: 'Test User',
        role: 'Admin',
        partner_id: null
      })
      .returning()
      .execute();
    const userId = userResult[0].id;

    // Create an open period
    const periodResult = await db.insert(periodsTable)
      .values({
        year: 2024,
        month: 5,
        status: 'Open',
        fx_rate_locked: true
      })
      .returning()
      .execute();
    const periodId = periodResult[0].id;

    // Create a draft journal for the period
    const journalResult = await db.insert(journalsTable)
      .values({
        reference: 'JE-002',
        description: 'Draft journal entry',
        journal_date: '2024-05-10',
        period_id: periodId,
        status: 'Draft',
        total_debit: '500.00',
        total_credit: '500.00',
        created_by: userId
      })
      .returning()
      .execute();

    await expect(closePeriod(periodId, userId))
      .rejects.toThrow(/Cannot close period: 1 draft journal\(s\) found/i);
  });

  it('should throw error when unlocked FX rates exist in the period', async () => {
    // Create a test user
    const userResult = await db.insert(usersTable)
      .values({
        email: 'test@example.com',
        name: 'Test User',
        role: 'Admin',
        partner_id: null
      })
      .returning()
      .execute();
    const userId = userResult[0].id;

    // Create an open period with fx_rate_locked = false
    const periodResult = await db.insert(periodsTable)
      .values({
        year: 2024,
        month: 6,
        status: 'Open',
        fx_rate_locked: false
      })
      .returning()
      .execute();
    const periodId = periodResult[0].id;

    // Create an unlocked FX rate within the period
    const fxRateResult = await db.insert(fxRatesTable)
      .values({
        from_currency: 'USD',
        to_currency: 'PKR',
        rate: '285.50',
        effective_date: '2024-06-15',
        is_locked: false,
        created_by: userId
      })
      .returning()
      .execute();

    await expect(closePeriod(periodId, userId))
      .rejects.toThrow(/Cannot close period: 1 unlocked FX rate\(s\) found in the period/i);
  });

  it('should close period when fx_rate_locked is already true', async () => {
    // Create a test user
    const userResult = await db.insert(usersTable)
      .values({
        email: 'test@example.com',
        name: 'Test User',
        role: 'Admin',
        partner_id: null
      })
      .returning()
      .execute();
    const userId = userResult[0].id;

    // Create an open period with fx_rate_locked = true
    const periodResult = await db.insert(periodsTable)
      .values({
        year: 2024,
        month: 7,
        status: 'Open',
        fx_rate_locked: true
      })
      .returning()
      .execute();
    const periodId = periodResult[0].id;

    // Create locked FX rates (should not prevent closing)
    const fxRateResult = await db.insert(fxRatesTable)
      .values({
        from_currency: 'USD',
        to_currency: 'PKR',
        rate: '290.75',
        effective_date: '2024-07-20',
        is_locked: true,
        created_by: userId
      })
      .returning()
      .execute();

    const result = await closePeriod(periodId, userId);

    expect(result.status).toEqual('Locked');
    expect(result.fx_rate_locked).toEqual(true);
  });

  it('should handle period with no journals', async () => {
    // Create a test user
    const userResult = await db.insert(usersTable)
      .values({
        email: 'test@example.com',
        name: 'Test User',
        role: 'Admin',
        partner_id: null
      })
      .returning()
      .execute();
    const userId = userResult[0].id;

    // Create an open period with no journals
    const periodResult = await db.insert(periodsTable)
      .values({
        year: 2024,
        month: 8,
        status: 'Open',
        fx_rate_locked: true
      })
      .returning()
      .execute();
    const periodId = periodResult[0].id;

    const result = await closePeriod(periodId, userId);

    expect(result.status).toEqual('Locked');
    expect(result.fx_rate_locked).toEqual(true);
  });

  it('should handle multiple draft journals error message correctly', async () => {
    // Create a test user
    const userResult = await db.insert(usersTable)
      .values({
        email: 'test@example.com',
        name: 'Test User',
        role: 'Admin',
        partner_id: null
      })
      .returning()
      .execute();
    const userId = userResult[0].id;

    // Create an open period
    const periodResult = await db.insert(periodsTable)
      .values({
        year: 2024,
        month: 9,
        status: 'Open',
        fx_rate_locked: true
      })
      .returning()
      .execute();
    const periodId = periodResult[0].id;

    // Create multiple draft journals
    await db.insert(journalsTable)
      .values([
        {
          reference: 'JE-003',
          description: 'Draft journal 1',
          journal_date: '2024-09-05',
          period_id: periodId,
          status: 'Draft',
          total_debit: '100.00',
          total_credit: '100.00',
          created_by: userId
        },
        {
          reference: 'JE-004',
          description: 'Draft journal 2',
          journal_date: '2024-09-10',
          period_id: periodId,
          status: 'Draft',
          total_debit: '200.00',
          total_credit: '200.00',
          created_by: userId
        }
      ])
      .returning()
      .execute();

    await expect(closePeriod(periodId, userId))
      .rejects.toThrow(/Cannot close period: 2 draft journal\(s\) found/i);
  });
});