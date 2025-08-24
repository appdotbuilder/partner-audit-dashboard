import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { journalsTable, periodsTable, usersTable, fxRatesTable } from '../db/schema';
import { getJournals, type GetJournalsFilters } from '../handlers/get_journals';

describe('getJournals', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  let testUserId: number;
  let testPeriodId: number;
  let testPeriodId2: number;
  let testFxRateId: number;

  beforeEach(async () => {
    // Create prerequisite data
    const userResult = await db.insert(usersTable)
      .values({
        email: 'test@example.com',
        name: 'Test User',
        role: 'Admin',
        partner_id: null
      })
      .returning()
      .execute();
    testUserId = userResult[0].id;

    const periodResult1 = await db.insert(periodsTable)
      .values({
        year: 2024,
        month: 1,
        status: 'Open',
        fx_rate_locked: false
      })
      .returning()
      .execute();
    testPeriodId = periodResult1[0].id;

    const periodResult2 = await db.insert(periodsTable)
      .values({
        year: 2024,
        month: 2,
        status: 'Open',
        fx_rate_locked: false
      })
      .returning()
      .execute();
    testPeriodId2 = periodResult2[0].id;

    const fxRateResult = await db.insert(fxRatesTable)
      .values({
        from_currency: 'USD',
        to_currency: 'PKR',
        rate: '280.5',
        effective_date: '2024-01-01',
        is_locked: false,
        created_by: testUserId
      })
      .returning()
      .execute();
    testFxRateId = fxRateResult[0].id;
  });

  it('should fetch all journals when no filters provided', async () => {
    // Create test journals
    await db.insert(journalsTable)
      .values([
        {
          reference: 'JV001',
          description: 'First journal',
          journal_date: '2024-01-15',
          period_id: testPeriodId,
          status: 'Draft',
          total_debit: '1000.00',
          total_credit: '1000.00',
          fx_rate_id: testFxRateId,
          created_by: testUserId,
          posted_by: null,
          posted_at: null
        },
        {
          reference: 'JV002',
          description: 'Second journal',
          journal_date: '2024-01-16',
          period_id: testPeriodId,
          status: 'Posted',
          total_debit: '500.00',
          total_credit: '500.00',
          fx_rate_id: null,
          created_by: testUserId,
          posted_by: testUserId,
          posted_at: new Date()
        }
      ])
      .execute();

    const results = await getJournals();

    expect(results).toHaveLength(2);
    expect(results[0].reference).toEqual('JV002'); // Most recent first
    expect(results[1].reference).toEqual('JV001');
    
    // Verify numeric conversions
    expect(typeof results[0].total_debit).toBe('number');
    expect(typeof results[0].total_credit).toBe('number');
    expect(results[0].total_debit).toEqual(500);
    expect(results[0].total_credit).toEqual(500);
  });

  it('should filter journals by period_id', async () => {
    // Create journals in different periods
    await db.insert(journalsTable)
      .values([
        {
          reference: 'JV001',
          description: 'Period 1 journal',
          journal_date: '2024-01-15',
          period_id: testPeriodId,
          status: 'Draft',
          total_debit: '1000.00',
          total_credit: '1000.00',
          fx_rate_id: testFxRateId,
          created_by: testUserId,
          posted_by: null,
          posted_at: null
        },
        {
          reference: 'JV002',
          description: 'Period 2 journal',
          journal_date: '2024-02-15',
          period_id: testPeriodId2,
          status: 'Draft',
          total_debit: '500.00',
          total_credit: '500.00',
          fx_rate_id: null,
          created_by: testUserId,
          posted_by: null,
          posted_at: null
        }
      ])
      .execute();

    const filters: GetJournalsFilters = { period_id: testPeriodId };
    const results = await getJournals(filters);

    expect(results).toHaveLength(1);
    expect(results[0].reference).toEqual('JV001');
    expect(results[0].period_id).toEqual(testPeriodId);
  });

  it('should filter journals by status', async () => {
    // Create journals with different statuses
    await db.insert(journalsTable)
      .values([
        {
          reference: 'JV001',
          description: 'Draft journal',
          journal_date: '2024-01-15',
          period_id: testPeriodId,
          status: 'Draft',
          total_debit: '1000.00',
          total_credit: '1000.00',
          fx_rate_id: testFxRateId,
          created_by: testUserId,
          posted_by: null,
          posted_at: null
        },
        {
          reference: 'JV002',
          description: 'Posted journal',
          journal_date: '2024-01-16',
          period_id: testPeriodId,
          status: 'Posted',
          total_debit: '500.00',
          total_credit: '500.00',
          fx_rate_id: null,
          created_by: testUserId,
          posted_by: testUserId,
          posted_at: new Date()
        }
      ])
      .execute();

    const filters: GetJournalsFilters = { status: 'Posted' };
    const results = await getJournals(filters);

    expect(results).toHaveLength(1);
    expect(results[0].reference).toEqual('JV002');
    expect(results[0].status).toEqual('Posted');
  });

  it('should filter journals by date range', async () => {
    // Create journals with different dates
    await db.insert(journalsTable)
      .values([
        {
          reference: 'JV001',
          description: 'Early journal',
          journal_date: '2024-01-10',
          period_id: testPeriodId,
          status: 'Draft',
          total_debit: '1000.00',
          total_credit: '1000.00',
          fx_rate_id: testFxRateId,
          created_by: testUserId,
          posted_by: null,
          posted_at: null
        },
        {
          reference: 'JV002',
          description: 'Mid journal',
          journal_date: '2024-01-15',
          period_id: testPeriodId,
          status: 'Draft',
          total_debit: '500.00',
          total_credit: '500.00',
          fx_rate_id: null,
          created_by: testUserId,
          posted_by: null,
          posted_at: null
        },
        {
          reference: 'JV003',
          description: 'Late journal',
          journal_date: '2024-01-20',
          period_id: testPeriodId,
          status: 'Draft',
          total_debit: '750.00',
          total_credit: '750.00',
          fx_rate_id: null,
          created_by: testUserId,
          posted_by: null,
          posted_at: null
        }
      ])
      .execute();

    const filters: GetJournalsFilters = {
      date_from: '2024-01-12',
      date_to: '2024-01-18'
    };
    const results = await getJournals(filters);

    expect(results).toHaveLength(1);
    expect(results[0].reference).toEqual('JV002');
    expect(results[0].journal_date).toEqual(new Date('2024-01-15'));
  });

  it('should combine multiple filters correctly', async () => {
    // Create journals with different attributes
    await db.insert(journalsTable)
      .values([
        {
          reference: 'JV001',
          description: 'Match all filters',
          journal_date: '2024-01-15',
          period_id: testPeriodId,
          status: 'Posted',
          total_debit: '1000.00',
          total_credit: '1000.00',
          fx_rate_id: testFxRateId,
          created_by: testUserId,
          posted_by: testUserId,
          posted_at: new Date()
        },
        {
          reference: 'JV002',
          description: 'Wrong status',
          journal_date: '2024-01-15',
          period_id: testPeriodId,
          status: 'Draft',
          total_debit: '500.00',
          total_credit: '500.00',
          fx_rate_id: null,
          created_by: testUserId,
          posted_by: null,
          posted_at: null
        },
        {
          reference: 'JV003',
          description: 'Wrong period',
          journal_date: '2024-01-15',
          period_id: testPeriodId2,
          status: 'Posted',
          total_debit: '750.00',
          total_credit: '750.00',
          fx_rate_id: null,
          created_by: testUserId,
          posted_by: testUserId,
          posted_at: new Date()
        }
      ])
      .execute();

    const filters: GetJournalsFilters = {
      period_id: testPeriodId,
      status: 'Posted',
      date_from: '2024-01-14',
      date_to: '2024-01-16'
    };
    const results = await getJournals(filters);

    expect(results).toHaveLength(1);
    expect(results[0].reference).toEqual('JV001');
  });

  it('should handle pagination correctly', async () => {
    // Create multiple journals
    const journalValues = [];
    for (let i = 1; i <= 5; i++) {
      journalValues.push({
        reference: `JV${i.toString().padStart(3, '0')}`,
        description: `Journal ${i}`,
        journal_date: `2024-01-${10 + i}`,
        period_id: testPeriodId,
        status: 'Draft' as const,
        total_debit: `${i * 100}.00`,
        total_credit: `${i * 100}.00`,
        fx_rate_id: null,
        created_by: testUserId,
        posted_by: null,
        posted_at: null
      });
    }

    await db.insert(journalsTable)
      .values(journalValues)
      .execute();

    // Test first page
    const page1 = await getJournals({ limit: 2, offset: 0 });
    expect(page1).toHaveLength(2);
    expect(page1[0].reference).toEqual('JV005'); // Most recent first
    expect(page1[1].reference).toEqual('JV004');

    // Test second page
    const page2 = await getJournals({ limit: 2, offset: 2 });
    expect(page2).toHaveLength(2);
    expect(page2[0].reference).toEqual('JV003');
    expect(page2[1].reference).toEqual('JV002');

    // Test default limit
    const allJournals = await getJournals();
    expect(allJournals).toHaveLength(5); // All should fit in default limit of 50
  });

  it('should return empty array when no journals match filters', async () => {
    // Create a journal that won't match filters
    await db.insert(journalsTable)
      .values({
        reference: 'JV001',
        description: 'Test journal',
        journal_date: '2024-01-15',
        period_id: testPeriodId,
        status: 'Draft',
        total_debit: '1000.00',
        total_credit: '1000.00',
        fx_rate_id: testFxRateId,
        created_by: testUserId,
        posted_by: null,
        posted_at: null
      })
      .execute();

    const filters: GetJournalsFilters = { status: 'Posted' };
    const results = await getJournals(filters);

    expect(results).toHaveLength(0);
  });

  it('should handle journals with null fx_rate_id and posted_by', async () => {
    await db.insert(journalsTable)
      .values({
        reference: 'JV001',
        description: 'Journal without FX rate',
        journal_date: '2024-01-15',
        period_id: testPeriodId,
        status: 'Draft',
        total_debit: '1000.00',
        total_credit: '1000.00',
        fx_rate_id: null,
        created_by: testUserId,
        posted_by: null,
        posted_at: null
      })
      .execute();

    const results = await getJournals();

    expect(results).toHaveLength(1);
    expect(results[0].fx_rate_id).toBeNull();
    expect(results[0].posted_by).toBeNull();
    expect(results[0].posted_at).toBeNull();
  });
});