import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { fxRatesTable, usersTable } from '../db/schema';
import { type Currency } from '../schema';
import { getFxRates, type GetFxRatesFilters } from '../handlers/get_fx_rates';
import { eq } from 'drizzle-orm';

describe('getFxRates', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  // Test helper to create a user (required for FX rate foreign key)
  const createTestUser = async () => {
    const result = await db.insert(usersTable)
      .values({
        email: 'test@example.com',
        name: 'Test User',
        role: 'Admin',
        partner_id: null
      })
      .returning()
      .execute();
    return result[0];
  };

  // Test helper to create FX rate
  const createFxRate = async (input: {
    from_currency?: Currency;
    to_currency?: Currency;
    rate?: number;
    effective_date?: string;
    is_locked?: boolean;
    created_by: number;
  }) => {
    const result = await db.insert(fxRatesTable)
      .values({
        from_currency: input.from_currency || 'USD',
        to_currency: input.to_currency || 'PKR',
        rate: input.rate?.toString() || '280.50',
        effective_date: input.effective_date || '2024-01-15',
        is_locked: input.is_locked || false,
        created_by: input.created_by
      })
      .returning()
      .execute();
    
    return {
      ...result[0],
      rate: parseFloat(result[0].rate),
      effective_date: new Date(result[0].effective_date)
    };
  };

  it('should fetch all FX rates when no filters provided', async () => {
    const user = await createTestUser();
    
    // Create test FX rates
    await createFxRate({
      from_currency: 'USD',
      to_currency: 'PKR',
      rate: 280.50,
      effective_date: '2024-01-15',
      is_locked: false,
      created_by: user.id
    });

    await createFxRate({
      from_currency: 'PKR',
      to_currency: 'USD',
      rate: 0.00357,
      effective_date: '2024-01-20',
      is_locked: true,
      created_by: user.id
    });

    const result = await getFxRates();

    expect(result).toHaveLength(2);
    expect(typeof result[0].rate).toBe('number');
    expect(result[0].created_at).toBeInstanceOf(Date);
    expect(result[0].updated_at).toBeInstanceOf(Date);
    expect(result[0].effective_date).toBeInstanceOf(Date);
    
    // Should be ordered by effective_date descending
    expect(result[0].effective_date >= result[1].effective_date).toBe(true);
  });

  it('should filter by from_currency', async () => {
    const user = await createTestUser();
    
    await createFxRate({
      from_currency: 'USD',
      to_currency: 'PKR',
      rate: 280.50,
      effective_date: '2024-01-15',
      created_by: user.id
    });

    await createFxRate({
      from_currency: 'PKR',
      to_currency: 'USD',
      rate: 0.00357,
      effective_date: '2024-01-20',
      created_by: user.id
    });

    const filters: GetFxRatesFilters = {
      from_currency: 'USD' as Currency
    };

    const result = await getFxRates(filters);

    expect(result).toHaveLength(1);
    expect(result[0].from_currency).toEqual('USD');
    expect(result[0].to_currency).toEqual('PKR');
    expect(result[0].rate).toEqual(280.50);
  });

  it('should filter by to_currency', async () => {
    const user = await createTestUser();
    
    await createFxRate({
      from_currency: 'USD',
      to_currency: 'PKR',
      rate: 280.50,
      effective_date: '2024-01-15',
      created_by: user.id
    });

    await createFxRate({
      from_currency: 'PKR',
      to_currency: 'USD',
      rate: 0.00357,
      effective_date: '2024-01-20',
      created_by: user.id
    });

    const filters: GetFxRatesFilters = {
      to_currency: 'USD' as Currency
    };

    const result = await getFxRates(filters);

    expect(result).toHaveLength(1);
    expect(result[0].from_currency).toEqual('PKR');
    expect(result[0].to_currency).toEqual('USD');
    expect(result[0].rate).toEqual(0.00357);
  });

  it('should filter by currency pair', async () => {
    const user = await createTestUser();
    
    await createFxRate({
      from_currency: 'USD',
      to_currency: 'PKR',
      rate: 280.50,
      effective_date: '2024-01-15',
      created_by: user.id
    });

    await createFxRate({
      from_currency: 'PKR',
      to_currency: 'USD',
      rate: 0.00357,
      effective_date: '2024-01-20',
      created_by: user.id
    });

    const filters: GetFxRatesFilters = {
      from_currency: 'USD' as Currency,
      to_currency: 'PKR' as Currency
    };

    const result = await getFxRates(filters);

    expect(result).toHaveLength(1);
    expect(result[0].from_currency).toEqual('USD');
    expect(result[0].to_currency).toEqual('PKR');
  });

  it('should filter by date range', async () => {
    const user = await createTestUser();
    
    // Create rates on different dates
    await createFxRate({
      from_currency: 'USD',
      to_currency: 'PKR',
      rate: 280.00,
      effective_date: '2024-01-10',
      created_by: user.id
    });

    await createFxRate({
      from_currency: 'USD',
      to_currency: 'PKR',
      rate: 280.50,
      effective_date: '2024-01-15',
      created_by: user.id
    });

    await createFxRate({
      from_currency: 'USD',
      to_currency: 'PKR',
      rate: 281.00,
      effective_date: '2024-01-25',
      created_by: user.id
    });

    const filters: GetFxRatesFilters = {
      from_date: '2024-01-12',
      to_date: '2024-01-20'
    };

    const result = await getFxRates(filters);

    expect(result).toHaveLength(1);
    expect(result[0].rate).toEqual(280.50);
    expect(result[0].effective_date).toEqual(new Date('2024-01-15'));
  });

  it('should filter by locked status', async () => {
    const user = await createTestUser();
    
    await createFxRate({
      from_currency: 'USD',
      to_currency: 'PKR',
      rate: 280.50,
      effective_date: '2024-01-15',
      is_locked: true,
      created_by: user.id
    });

    await createFxRate({
      from_currency: 'USD',
      to_currency: 'PKR',
      rate: 281.00,
      effective_date: '2024-01-20',
      is_locked: false,
      created_by: user.id
    });

    const filters: GetFxRatesFilters = {
      is_locked: true
    };

    const result = await getFxRates(filters);

    expect(result).toHaveLength(1);
    expect(result[0].is_locked).toBe(true);
    expect(result[0].rate).toEqual(280.50);
  });

  it('should filter by unlocked status', async () => {
    const user = await createTestUser();
    
    await createFxRate({
      from_currency: 'USD',
      to_currency: 'PKR',
      rate: 280.50,
      effective_date: '2024-01-15',
      is_locked: true,
      created_by: user.id
    });

    await createFxRate({
      from_currency: 'USD',
      to_currency: 'PKR',
      rate: 281.00,
      effective_date: '2024-01-20',
      is_locked: false,
      created_by: user.id
    });

    const filters: GetFxRatesFilters = {
      is_locked: false
    };

    const result = await getFxRates(filters);

    expect(result).toHaveLength(1);
    expect(result[0].is_locked).toBe(false);
    expect(result[0].rate).toEqual(281.00);
  });

  it('should combine multiple filters', async () => {
    const user = await createTestUser();
    
    // Create various rates
    await createFxRate({
      from_currency: 'USD',
      to_currency: 'PKR',
      rate: 280.00,
      effective_date: '2024-01-10',
      is_locked: false,
      created_by: user.id
    });

    await createFxRate({
      from_currency: 'USD',
      to_currency: 'PKR',
      rate: 280.50,
      effective_date: '2024-01-15',
      is_locked: true,
      created_by: user.id
    });

    await createFxRate({
      from_currency: 'PKR',
      to_currency: 'USD',
      rate: 0.00357,
      effective_date: '2024-01-15',
      is_locked: true,
      created_by: user.id
    });

    const filters: GetFxRatesFilters = {
      from_currency: 'USD' as Currency,
      to_currency: 'PKR' as Currency,
      from_date: '2024-01-12',
      is_locked: true
    };

    const result = await getFxRates(filters);

    expect(result).toHaveLength(1);
    expect(result[0].from_currency).toEqual('USD');
    expect(result[0].to_currency).toEqual('PKR');
    expect(result[0].is_locked).toBe(true);
    expect(result[0].rate).toEqual(280.50);
  });

  it('should return empty array when no matches found', async () => {
    const user = await createTestUser();
    
    await createFxRate({
      from_currency: 'USD',
      to_currency: 'PKR',
      rate: 280.50,
      effective_date: '2024-01-15',
      created_by: user.id
    });

    const filters: GetFxRatesFilters = {
      from_currency: 'PKR' as Currency,
      to_currency: 'USD' as Currency
    };

    const result = await getFxRates(filters);

    expect(result).toHaveLength(0);
  });

  it('should return rates ordered by effective_date descending', async () => {
    const user = await createTestUser();
    
    // Create rates in random order
    await createFxRate({
      from_currency: 'USD',
      to_currency: 'PKR',
      rate: 280.50,
      effective_date: '2024-01-15',
      created_by: user.id
    });

    await createFxRate({
      from_currency: 'USD',
      to_currency: 'PKR',
      rate: 281.00,
      effective_date: '2024-01-25',
      created_by: user.id
    });

    await createFxRate({
      from_currency: 'USD',
      to_currency: 'PKR',
      rate: 280.00,
      effective_date: '2024-01-10',
      created_by: user.id
    });

    const result = await getFxRates();

    expect(result).toHaveLength(3);
    
    // Should be in descending order by effective_date
    expect(result[0].effective_date).toEqual(new Date('2024-01-25'));
    expect(result[1].effective_date).toEqual(new Date('2024-01-15'));
    expect(result[2].effective_date).toEqual(new Date('2024-01-10'));
    
    expect(result[0].rate).toEqual(281.00);
    expect(result[1].rate).toEqual(280.50);
    expect(result[2].rate).toEqual(280.00);
  });

  it('should save FX rate correctly to database', async () => {
    const user = await createTestUser();
    
    const createdRate = await createFxRate({
      from_currency: 'USD',
      to_currency: 'PKR',
      rate: 280.75,
      effective_date: '2024-01-15',
      is_locked: true,
      created_by: user.id
    });

    const result = await getFxRates();

    expect(result).toHaveLength(1);
    
    // Verify database query results match our created rate
    const dbRate = await db.select()
      .from(fxRatesTable)
      .where(eq(fxRatesTable.id, createdRate.id))
      .execute();

    expect(dbRate).toHaveLength(1);
    expect(parseFloat(dbRate[0].rate)).toEqual(280.75);
    expect(dbRate[0].from_currency).toEqual('USD');
    expect(dbRate[0].to_currency).toEqual('PKR');
    expect(dbRate[0].is_locked).toBe(true);
    expect(dbRate[0].created_by).toEqual(user.id);
    expect(dbRate[0].effective_date).toEqual('2024-01-15');
  });
});