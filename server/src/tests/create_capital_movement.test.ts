import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { capitalMovementsTable, partnersTable, journalsTable, usersTable, periodsTable } from '../db/schema';
import { type CreateCapitalMovementInput } from '../schema';
import { createCapitalMovement } from '../handlers/create_capital_movement';
import { eq } from 'drizzle-orm';

describe('createCapitalMovement', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  let testPartnerId: number;
  let testJournalId: number;
  let testUserId: number;
  let testPeriodId: number;

  beforeEach(async () => {
    // Create test user
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

    // Create test partner
    const partnerResult = await db.insert(partnersTable)
      .values({
        name: 'Test Partner',
        usd_account_id: null,
        pkr_account_id: null
      })
      .returning()
      .execute();
    testPartnerId = partnerResult[0].id;

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

    // Create test journal (Posted)
    const journalResult = await db.insert(journalsTable)
      .values({
        reference: 'JE-001',
        description: 'Test Journal',
        journal_date: '2024-01-15', // Use string for date column
        period_id: testPeriodId,
        status: 'Posted',
        total_debit: '1000.00',
        total_credit: '1000.00',
        fx_rate_id: null,
        created_by: testUserId,
        posted_by: testUserId,
        posted_at: new Date()
      })
      .returning()
      .execute();
    testJournalId = journalResult[0].id;
  });

  it('should create a capital contribution successfully', async () => {
    const testInput: CreateCapitalMovementInput = {
      partner_id: testPartnerId,
      movement_type: 'Contribution',
      amount: 10000,
      currency: 'USD',
      amount_base: 10000,
      journal_id: testJournalId,
      description: 'Capital contribution from partner',
      movement_date: new Date('2024-01-15')
    };

    const result = await createCapitalMovement(testInput);

    // Verify returned values
    expect(result.partner_id).toEqual(testPartnerId);
    expect(result.movement_type).toEqual('Contribution');
    expect(result.amount).toEqual(10000);
    expect(result.currency).toEqual('USD');
    expect(result.amount_base).toEqual(10000);
    expect(result.journal_id).toEqual(testJournalId);
    expect(result.description).toEqual('Capital contribution from partner');
    expect(result.movement_date).toEqual(new Date('2024-01-15'));
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);

    // Verify numeric type conversions
    expect(typeof result.amount).toBe('number');
    expect(typeof result.amount_base).toBe('number');
  });

  it('should create a capital draw successfully', async () => {
    const testInput: CreateCapitalMovementInput = {
      partner_id: testPartnerId,
      movement_type: 'Draw',
      amount: 5000,
      currency: 'PKR',
      amount_base: 5000,
      journal_id: testJournalId,
      description: 'Partner draw for expenses',
      movement_date: new Date('2024-01-20')
    };

    const result = await createCapitalMovement(testInput);

    expect(result.movement_type).toEqual('Draw');
    expect(result.amount).toEqual(5000);
    expect(result.currency).toEqual('PKR');
    expect(result.description).toEqual('Partner draw for expenses');
  });

  it('should save capital movement to database', async () => {
    const testInput: CreateCapitalMovementInput = {
      partner_id: testPartnerId,
      movement_type: 'Contribution',
      amount: 15000,
      currency: 'USD',
      amount_base: 15000,
      journal_id: testJournalId,
      description: 'Initial capital contribution',
      movement_date: new Date('2024-01-10')
    };

    const result = await createCapitalMovement(testInput);

    // Query database to verify record was saved
    const capitalMovements = await db.select()
      .from(capitalMovementsTable)
      .where(eq(capitalMovementsTable.id, result.id))
      .execute();

    expect(capitalMovements).toHaveLength(1);
    expect(capitalMovements[0].partner_id).toEqual(testPartnerId);
    expect(capitalMovements[0].movement_type).toEqual('Contribution');
    expect(parseFloat(capitalMovements[0].amount)).toEqual(15000);
    expect(capitalMovements[0].currency).toEqual('USD');
    expect(parseFloat(capitalMovements[0].amount_base)).toEqual(15000);
    expect(capitalMovements[0].journal_id).toEqual(testJournalId);
    expect(capitalMovements[0].description).toEqual('Initial capital contribution');
    expect(capitalMovements[0].created_at).toBeInstanceOf(Date);
    expect(capitalMovements[0].movement_date).toEqual('2024-01-10'); // Date column returns string
  });

  it('should throw error when partner does not exist', async () => {
    const testInput: CreateCapitalMovementInput = {
      partner_id: 99999, // Non-existent partner
      movement_type: 'Contribution',
      amount: 10000,
      currency: 'USD',
      amount_base: 10000,
      journal_id: testJournalId,
      description: 'Test contribution',
      movement_date: new Date('2024-01-15')
    };

    expect(createCapitalMovement(testInput)).rejects.toThrow(/Partner with ID 99999 not found/i);
  });

  it('should throw error when journal does not exist', async () => {
    const testInput: CreateCapitalMovementInput = {
      partner_id: testPartnerId,
      movement_type: 'Contribution',
      amount: 10000,
      currency: 'USD',
      amount_base: 10000,
      journal_id: 99999, // Non-existent journal
      description: 'Test contribution',
      movement_date: new Date('2024-01-15')
    };

    expect(createCapitalMovement(testInput)).rejects.toThrow(/Journal with ID 99999 not found/i);
  });

  it('should throw error when journal is not posted', async () => {
    // Create draft journal
    const draftJournalResult = await db.insert(journalsTable)
      .values({
        reference: 'JE-DRAFT',
        description: 'Draft Journal',
        journal_date: '2024-01-15', // Use string for date column
        period_id: testPeriodId,
        status: 'Draft', // Not posted
        total_debit: '0.00',
        total_credit: '0.00',
        fx_rate_id: null,
        created_by: testUserId
      })
      .returning()
      .execute();

    const testInput: CreateCapitalMovementInput = {
      partner_id: testPartnerId,
      movement_type: 'Contribution',
      amount: 10000,
      currency: 'USD',
      amount_base: 10000,
      journal_id: draftJournalResult[0].id,
      description: 'Test contribution',
      movement_date: new Date('2024-01-15')
    };

    expect(createCapitalMovement(testInput)).rejects.toThrow(/Journal must be Posted before creating capital movements/i);
  });

  it('should handle decimal amounts correctly', async () => {
    const testInput: CreateCapitalMovementInput = {
      partner_id: testPartnerId,
      movement_type: 'Draw',
      amount: 2500.75,
      currency: 'USD',
      amount_base: 2500.75,
      journal_id: testJournalId,
      description: 'Partial draw with decimals',
      movement_date: new Date('2024-01-25')
    };

    const result = await createCapitalMovement(testInput);

    expect(result.amount).toEqual(2500.75);
    expect(result.amount_base).toEqual(2500.75);
    expect(typeof result.amount).toBe('number');
    expect(typeof result.amount_base).toBe('number');

    // Verify in database
    const saved = await db.select()
      .from(capitalMovementsTable)
      .where(eq(capitalMovementsTable.id, result.id))
      .execute();

    expect(parseFloat(saved[0].amount)).toEqual(2500.75);
    expect(parseFloat(saved[0].amount_base)).toEqual(2500.75);
  });
});