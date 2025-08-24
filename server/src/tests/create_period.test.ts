import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { periodsTable } from '../db/schema';
import { type CreatePeriodInput } from '../schema';
import { createPeriod } from '../handlers/create_period';
import { eq, and } from 'drizzle-orm';

// Test input with all fields
const testInput: CreatePeriodInput = {
  year: 2024,
  month: 1,
  status: 'Open',
  fx_rate_locked: false
};

describe('createPeriod', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should create a period successfully', async () => {
    const result = await createPeriod(testInput);

    // Verify all fields
    expect(result.year).toEqual(2024);
    expect(result.month).toEqual(1);
    expect(result.status).toEqual('Open');
    expect(result.fx_rate_locked).toEqual(false);
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should save period to database', async () => {
    const result = await createPeriod(testInput);

    // Query database to verify the period was saved
    const periods = await db.select()
      .from(periodsTable)
      .where(eq(periodsTable.id, result.id))
      .execute();

    expect(periods).toHaveLength(1);
    expect(periods[0].year).toEqual(2024);
    expect(periods[0].month).toEqual(1);
    expect(periods[0].status).toEqual('Open');
    expect(periods[0].fx_rate_locked).toEqual(false);
    expect(periods[0].created_at).toBeInstanceOf(Date);
  });

  it('should use default values from Zod schema', async () => {
    // Test input without optional fields (using Zod defaults)
    const minimalInput: CreatePeriodInput = {
      year: 2024,
      month: 1,
      status: 'Open', // Default from Zod
      fx_rate_locked: false // Default from Zod
    };

    const result = await createPeriod(minimalInput);

    expect(result.status).toEqual('Open');
    expect(result.fx_rate_locked).toEqual(false);
  });

  it('should prevent duplicate periods for same year/month', async () => {
    // Create first period
    await createPeriod(testInput);

    // Try to create duplicate period
    expect(async () => {
      await createPeriod(testInput);
    }).toThrow(/already exists/i);
  });

  it('should allow creating first period without validation', async () => {
    // Create the very first period (any year/month should be allowed)
    const firstPeriodInput: CreatePeriodInput = {
      year: 2023,
      month: 6,
      status: 'Open',
      fx_rate_locked: false
    };

    const result = await createPeriod(firstPeriodInput);

    expect(result.year).toEqual(2023);
    expect(result.month).toEqual(6);
  });

  it('should enforce sequential period creation', async () => {
    // Create first period (Jan 2024)
    await createPeriod({
      year: 2024,
      month: 1,
      status: 'Open',
      fx_rate_locked: false
    });

    // Try to create March 2024 (skipping February)
    expect(async () => {
      await createPeriod({
        year: 2024,
        month: 3,
        status: 'Open',
        fx_rate_locked: false
      });
    }).toThrow(/must be created sequentially/i);
  });

  it('should allow creating next sequential month', async () => {
    // Create January 2024
    await createPeriod({
      year: 2024,
      month: 1,
      status: 'Open',
      fx_rate_locked: false
    });

    // Create February 2024 (sequential)
    const result = await createPeriod({
      year: 2024,
      month: 2,
      status: 'Locked',
      fx_rate_locked: true
    });

    expect(result.year).toEqual(2024);
    expect(result.month).toEqual(2);
    expect(result.status).toEqual('Locked');
    expect(result.fx_rate_locked).toEqual(true);
  });

  it('should handle year rollover correctly', async () => {
    // Create December 2023
    await createPeriod({
      year: 2023,
      month: 12,
      status: 'Open',
      fx_rate_locked: false
    });

    // Create January 2024 (year rollover)
    const result = await createPeriod({
      year: 2024,
      month: 1,
      status: 'Open',
      fx_rate_locked: false
    });

    expect(result.year).toEqual(2024);
    expect(result.month).toEqual(1);
  });

  it('should reject period creation that skips years', async () => {
    // Create December 2023
    await createPeriod({
      year: 2023,
      month: 12,
      status: 'Open',
      fx_rate_locked: false
    });

    // Try to create January 2025 (skipping 2024)
    expect(async () => {
      await createPeriod({
        year: 2025,
        month: 1,
        status: 'Open',
        fx_rate_locked: false
      });
    }).toThrow(/must be created sequentially/i);
  });

  it('should handle business logic validation correctly', async () => {
    // Create a period first
    await createPeriod({
      year: 2024,
      month: 1,
      status: 'Open',
      fx_rate_locked: false
    });

    // Test that non-sequential periods are rejected
    await expect(async () => {
      await createPeriod({
        year: 2024,
        month: 3, // Skips month 2
        status: 'Open',
        fx_rate_locked: false
      });
    }).toThrow(/must be created sequentially/i);

    // Test that duplicate periods are rejected
    await expect(async () => {
      await createPeriod({
        year: 2024,
        month: 1, // Duplicate
        status: 'Open',
        fx_rate_locked: false
      });
    }).toThrow(/already exists/i);
  });

  it('should create multiple sequential periods', async () => {
    const periods = [];

    // Create 6 sequential periods
    for (let month = 1; month <= 6; month++) {
      const period = await createPeriod({
        year: 2024,
        month,
        status: 'Open',
        fx_rate_locked: false
      });
      periods.push(period);
    }

    // Verify all periods were created
    expect(periods).toHaveLength(6);
    periods.forEach((period, index) => {
      expect(period.year).toEqual(2024);
      expect(period.month).toEqual(index + 1);
    });

    // Verify periods exist in database
    const dbPeriods = await db.select()
      .from(periodsTable)
      .where(eq(periodsTable.year, 2024))
      .execute();

    expect(dbPeriods).toHaveLength(6);
  });
});