import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { fxRatesTable, periodsTable, usersTable } from '../db/schema';
import { type CreateFxRateInput } from '../schema';
import { createFxRate } from '../handlers/create_fx_rate';
import { eq, and } from 'drizzle-orm';

// Test data
const testUserId = 1;

const testInput: CreateFxRateInput = {
  from_currency: 'USD',
  to_currency: 'PKR',
  rate: 285.50,
  effective_date: new Date('2024-01-15'),
  is_locked: false
};

describe('createFxRate', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should create an FX rate', async () => {
    // Create prerequisite data - user and period
    await db.insert(usersTable).values({
      email: 'test@example.com',
      name: 'Test User',
      role: 'Admin',
      partner_id: null
    }).execute();

    await db.insert(periodsTable).values({
      year: 2024,
      month: 1,
      status: 'Open',
      fx_rate_locked: false
    }).execute();

    const result = await createFxRate(testInput, testUserId);

    // Basic field validation
    expect(result.from_currency).toEqual('USD');
    expect(result.to_currency).toEqual('PKR');
    expect(result.rate).toEqual(285.50);
    expect(typeof result.rate).toEqual('number');
    expect(result.effective_date).toEqual(testInput.effective_date);
    expect(result.is_locked).toEqual(false);
    expect(result.created_by).toEqual(testUserId);
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should save FX rate to database', async () => {
    // Create prerequisite data
    await db.insert(usersTable).values({
      email: 'test@example.com',
      name: 'Test User',
      role: 'Admin',
      partner_id: null
    }).execute();

    await db.insert(periodsTable).values({
      year: 2024,
      month: 1,
      status: 'Open',
      fx_rate_locked: false
    }).execute();

    const result = await createFxRate(testInput, testUserId);

    // Verify data was saved correctly
    const fxRates = await db.select()
      .from(fxRatesTable)
      .where(eq(fxRatesTable.id, result.id))
      .execute();

    expect(fxRates).toHaveLength(1);
    expect(fxRates[0].from_currency).toEqual('USD');
    expect(fxRates[0].to_currency).toEqual('PKR');
    expect(parseFloat(fxRates[0].rate)).toEqual(285.50);
    expect(new Date(fxRates[0].effective_date)).toEqual(testInput.effective_date);
    expect(fxRates[0].is_locked).toEqual(false);
    expect(fxRates[0].created_by).toEqual(testUserId);
    expect(fxRates[0].created_at).toBeInstanceOf(Date);
  });

  it('should prevent duplicate FX rates for same currency pair and date', async () => {
    // Create prerequisite data
    await db.insert(usersTable).values({
      email: 'test@example.com',
      name: 'Test User',
      role: 'Admin',
      partner_id: null
    }).execute();

    await db.insert(periodsTable).values({
      year: 2024,
      month: 1,
      status: 'Open',
      fx_rate_locked: false
    }).execute();

    // Create first FX rate
    await createFxRate(testInput, testUserId);

    // Try to create duplicate
    const duplicateInput: CreateFxRateInput = {
      ...testInput,
      rate: 290.00 // Different rate but same currency pair and date
    };

    await expect(createFxRate(duplicateInput, testUserId))
      .rejects.toThrow(/fx rate already exists/i);
  });

  it('should reject FX rate for non-existent period', async () => {
    // Create user but no period
    await db.insert(usersTable).values({
      email: 'test@example.com',
      name: 'Test User',
      role: 'Admin',
      partner_id: null
    }).execute();

    // Try to create FX rate for non-existent period
    const invalidDateInput: CreateFxRateInput = {
      ...testInput,
      effective_date: new Date('2025-12-15') // No period exists for 2025-12
    };

    await expect(createFxRate(invalidDateInput, testUserId))
      .rejects.toThrow(/no accounting period found/i);
  });

  it('should reject locked FX rate for locked period', async () => {
    // Create prerequisite data with locked period
    await db.insert(usersTable).values({
      email: 'test@example.com',
      name: 'Test User',
      role: 'Admin',
      partner_id: null
    }).execute();

    await db.insert(periodsTable).values({
      year: 2024,
      month: 1,
      status: 'Locked', // Locked period
      fx_rate_locked: true
    }).execute();

    const lockedInput: CreateFxRateInput = {
      ...testInput,
      is_locked: true // Trying to create locked rate
    };

    await expect(createFxRate(lockedInput, testUserId))
      .rejects.toThrow(/cannot create locked fx rate/i);
  });

  it('should allow unlocked FX rate for locked period', async () => {
    // Create prerequisite data with locked period
    await db.insert(usersTable).values({
      email: 'test@example.com',
      name: 'Test User',
      role: 'Admin',
      partner_id: null
    }).execute();

    await db.insert(periodsTable).values({
      year: 2024,
      month: 1,
      status: 'Locked',
      fx_rate_locked: true
    }).execute();

    const unlockedInput: CreateFxRateInput = {
      ...testInput,
      is_locked: false // Unlocked rate should be allowed
    };

    const result = await createFxRate(unlockedInput, testUserId);

    expect(result.is_locked).toEqual(false);
    expect(result.from_currency).toEqual('USD');
    expect(result.to_currency).toEqual('PKR');
  });

  it('should handle different currency pairs correctly', async () => {
    // Create prerequisite data
    await db.insert(usersTable).values({
      email: 'test@example.com',
      name: 'Test User',
      role: 'Admin',
      partner_id: null
    }).execute();

    await db.insert(periodsTable).values({
      year: 2024,
      month: 1,
      status: 'Open',
      fx_rate_locked: false
    }).execute();

    // Create PKR to USD rate (reverse pair)
    const reverseInput: CreateFxRateInput = {
      from_currency: 'PKR',
      to_currency: 'USD',
      rate: 0.0035,
      effective_date: new Date('2024-01-15'),
      is_locked: false
    };

    const result = await createFxRate(reverseInput, testUserId);

    expect(result.from_currency).toEqual('PKR');
    expect(result.to_currency).toEqual('USD');
    expect(result.rate).toEqual(0.0035);

    // Should also be able to create USD to PKR on same date
    const usdToPkrResult = await createFxRate(testInput, testUserId);

    expect(usdToPkrResult.from_currency).toEqual('USD');
    expect(usdToPkrResult.to_currency).toEqual('PKR');

    // Verify both rates exist
    const allRates = await db.select()
      .from(fxRatesTable)
      .where(eq(fxRatesTable.effective_date, '2024-01-15'))
      .execute();

    expect(allRates).toHaveLength(2);
  });

  it('should handle decimal precision correctly', async () => {
    // Create prerequisite data
    await db.insert(usersTable).values({
      email: 'test@example.com',
      name: 'Test User',
      role: 'Admin',
      partner_id: null
    }).execute();

    await db.insert(periodsTable).values({
      year: 2024,
      month: 1,
      status: 'Open',
      fx_rate_locked: false
    }).execute();

    // Test with high precision rate
    const precisionInput: CreateFxRateInput = {
      from_currency: 'USD',
      to_currency: 'PKR',
      rate: 285.123456,
      effective_date: new Date('2024-01-15'),
      is_locked: false
    };

    const result = await createFxRate(precisionInput, testUserId);

    expect(result.rate).toEqual(285.123456);
    expect(typeof result.rate).toEqual('number');

    // Verify precision is maintained in database
    const savedRate = await db.select()
      .from(fxRatesTable)
      .where(eq(fxRatesTable.id, result.id))
      .execute();

    expect(parseFloat(savedRate[0].rate)).toEqual(285.123456);
  });
});