import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { periodsTable } from '../db/schema';
import { type CreatePeriodInput } from '../schema';
import { getPeriods, type GetPeriodsFilters } from '../handlers/get_periods';
import { eq } from 'drizzle-orm';

// Test periods data
const testPeriods: CreatePeriodInput[] = [
  {
    year: 2024,
    month: 1,
    status: 'Open',
    fx_rate_locked: false
  },
  {
    year: 2024,
    month: 2,
    status: 'Locked',
    fx_rate_locked: true
  },
  {
    year: 2023,
    month: 12,
    status: 'Locked',
    fx_rate_locked: true
  },
  {
    year: 2024,
    month: 3,
    status: 'Open',
    fx_rate_locked: false
  }
];

describe('getPeriods', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should fetch all periods without filters', async () => {
    // Insert test periods
    for (const period of testPeriods) {
      await db.insert(periodsTable).values(period).execute();
    }

    const result = await getPeriods();

    expect(result).toHaveLength(4);
    
    // Verify basic structure
    result.forEach(period => {
      expect(period.id).toBeDefined();
      expect(period.year).toBeDefined();
      expect(period.month).toBeDefined();
      expect(period.status).toBeDefined();
      expect(period.fx_rate_locked).toBeDefined();
      expect(period.created_at).toBeInstanceOf(Date);
      expect(period.updated_at).toBeInstanceOf(Date);
    });

    // Verify descending order by year/month
    expect(result[0].year).toBe(2024);
    expect(result[0].month).toBe(3);
    expect(result[1].year).toBe(2024);
    expect(result[1].month).toBe(2);
    expect(result[2].year).toBe(2024);
    expect(result[2].month).toBe(1);
    expect(result[3].year).toBe(2023);
    expect(result[3].month).toBe(12);
  });

  it('should filter periods by status', async () => {
    // Insert test periods
    for (const period of testPeriods) {
      await db.insert(periodsTable).values(period).execute();
    }

    const filters: GetPeriodsFilters = { status: 'Open' };
    const result = await getPeriods(filters);

    expect(result).toHaveLength(2);
    result.forEach(period => {
      expect(period.status).toBe('Open');
    });

    // Verify ordering is maintained
    expect(result[0].year).toBe(2024);
    expect(result[0].month).toBe(3);
    expect(result[1].year).toBe(2024);
    expect(result[1].month).toBe(1);
  });

  it('should filter periods by year', async () => {
    // Insert test periods
    for (const period of testPeriods) {
      await db.insert(periodsTable).values(period).execute();
    }

    const filters: GetPeriodsFilters = { year: 2024 };
    const result = await getPeriods(filters);

    expect(result).toHaveLength(3);
    result.forEach(period => {
      expect(period.year).toBe(2024);
    });

    // Verify ordering by month descending
    expect(result[0].month).toBe(3);
    expect(result[1].month).toBe(2);
    expect(result[2].month).toBe(1);
  });

  it('should filter periods by both status and year', async () => {
    // Insert test periods
    for (const period of testPeriods) {
      await db.insert(periodsTable).values(period).execute();
    }

    const filters: GetPeriodsFilters = { 
      status: 'Locked', 
      year: 2024 
    };
    const result = await getPeriods(filters);

    expect(result).toHaveLength(1);
    expect(result[0].status).toBe('Locked');
    expect(result[0].year).toBe(2024);
    expect(result[0].month).toBe(2);
  });

  it('should return empty array when no periods match filters', async () => {
    // Insert test periods
    for (const period of testPeriods) {
      await db.insert(periodsTable).values(period).execute();
    }

    const filters: GetPeriodsFilters = { year: 2025 };
    const result = await getPeriods(filters);

    expect(result).toHaveLength(0);
  });

  it('should return empty array when no periods exist', async () => {
    const result = await getPeriods();

    expect(result).toHaveLength(0);
  });

  it('should handle periods saved to database correctly', async () => {
    const testPeriod: CreatePeriodInput = {
      year: 2024,
      month: 6,
      status: 'Open',
      fx_rate_locked: true
    };

    // Insert period directly
    const insertResult = await db.insert(periodsTable)
      .values(testPeriod)
      .returning()
      .execute();

    const result = await getPeriods();

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(insertResult[0].id);
    expect(result[0].year).toBe(2024);
    expect(result[0].month).toBe(6);
    expect(result[0].status).toBe('Open');
    expect(result[0].fx_rate_locked).toBe(true);

    // Verify data persistence by querying directly
    const dbPeriods = await db.select()
      .from(periodsTable)
      .where(eq(periodsTable.id, result[0].id))
      .execute();

    expect(dbPeriods).toHaveLength(1);
    expect(dbPeriods[0].year).toBe(2024);
    expect(dbPeriods[0].month).toBe(6);
    expect(dbPeriods[0].status).toBe('Open');
  });

  it('should handle complex ordering with multiple years', async () => {
    const complexTestData: CreatePeriodInput[] = [
      { year: 2022, month: 12, status: 'Locked', fx_rate_locked: true },
      { year: 2023, month: 1, status: 'Open', fx_rate_locked: false },
      { year: 2024, month: 12, status: 'Open', fx_rate_locked: false },
      { year: 2024, month: 1, status: 'Locked', fx_rate_locked: true },
      { year: 2023, month: 12, status: 'Locked', fx_rate_locked: true }
    ];

    // Insert test periods
    for (const period of complexTestData) {
      await db.insert(periodsTable).values(period).execute();
    }

    const result = await getPeriods();

    expect(result).toHaveLength(5);

    // Verify correct descending order: year DESC, month DESC
    expect(result[0].year).toBe(2024);
    expect(result[0].month).toBe(12);
    
    expect(result[1].year).toBe(2024);
    expect(result[1].month).toBe(1);
    
    expect(result[2].year).toBe(2023);
    expect(result[2].month).toBe(12);
    
    expect(result[3].year).toBe(2023);
    expect(result[3].month).toBe(1);
    
    expect(result[4].year).toBe(2022);
    expect(result[4].month).toBe(12);
  });
});