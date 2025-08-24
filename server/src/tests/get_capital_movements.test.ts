import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { 
  capitalMovementsTable, 
  partnersTable, 
  journalsTable, 
  periodsTable,
  usersTable,
  accountsTable
} from '../db/schema';
import { getCapitalMovements } from '../handlers/get_capital_movements';

// Test data setup
const testUser = {
  email: 'test@example.com',
  name: 'Test User',
  role: 'Admin' as const
};

const testAccount = {
  code: 'TEST001',
  name: 'Test Account',
  account_type: 'Asset' as const,
  currency: 'USD' as const,
  is_active: true
};

const testPartner = {
  name: 'Test Partner'
};

const testPeriod = {
  year: 2024,
  month: 1,
  status: 'Open' as const,
  fx_rate_locked: false
};

describe('getCapitalMovements', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return empty array when no capital movements exist', async () => {
    const result = await getCapitalMovements();
    expect(result).toEqual([]);
  });

  it('should fetch all capital movements with proper numeric conversions', async () => {
    // Create prerequisite records
    const [user] = await db.insert(usersTable).values(testUser).returning().execute();
    const [account] = await db.insert(accountsTable).values(testAccount).returning().execute();
    const [partner] = await db.insert(partnersTable).values(testPartner).returning().execute();
    const [period] = await db.insert(periodsTable).values(testPeriod).returning().execute();
    
    const [journal] = await db.insert(journalsTable).values({
      reference: 'JE-001',
      description: 'Test Journal Entry',
      journal_date: '2024-01-15',
      period_id: period.id,
      status: 'Draft',
      created_by: user.id
    }).returning().execute();

    // Create capital movements
    const movements = [
      {
        partner_id: partner.id,
        movement_type: 'Contribution' as const,
        amount: '1500.75',
        currency: 'USD' as const,
        amount_base: '1500.75',
        journal_id: journal.id,
        description: 'Capital contribution',
        movement_date: '2024-01-15'
      },
      {
        partner_id: partner.id,
        movement_type: 'Draw' as const,
        amount: '500.25',
        currency: 'USD' as const,
        amount_base: '500.25',
        journal_id: journal.id,
        description: 'Capital draw',
        movement_date: '2024-01-20'
      }
    ];

    await db.insert(capitalMovementsTable).values(movements).execute();

    const result = await getCapitalMovements();

    expect(result).toHaveLength(2);
    
    // Should be ordered by movement_date descending
    expect(result[0].movement_type).toBe('Draw');
    expect(result[1].movement_type).toBe('Contribution');
    
    // Test numeric conversions
    expect(typeof result[0].amount).toBe('number');
    expect(typeof result[0].amount_base).toBe('number');
    expect(result[0].amount).toEqual(500.25);
    expect(result[0].amount_base).toEqual(500.25);
    
    expect(result[1].amount).toEqual(1500.75);
    expect(result[1].amount_base).toEqual(1500.75);
    
    // Test all fields are present and properly typed
    expect(result[0].id).toBeDefined();
    expect(result[0].partner_id).toBe(partner.id);
    expect(result[0].journal_id).toBe(journal.id);
    expect(result[0].description).toBe('Capital draw');
    expect(result[0].currency).toBe('USD');
    expect(result[0].movement_date).toBeInstanceOf(Date);
    expect(result[0].created_at).toBeInstanceOf(Date);
    expect(result[0].updated_at).toBeInstanceOf(Date);
    
    // Verify date values
    expect(result[0].movement_date.toISOString().split('T')[0]).toBe('2024-01-20');
    expect(result[1].movement_date.toISOString().split('T')[0]).toBe('2024-01-15');
  });

  it('should filter by partner_id', async () => {
    // Create prerequisite records
    const [user] = await db.insert(usersTable).values(testUser).returning().execute();
    const [account] = await db.insert(accountsTable).values(testAccount).returning().execute();
    const [partner1] = await db.insert(partnersTable).values({ name: 'Partner 1' }).returning().execute();
    const [partner2] = await db.insert(partnersTable).values({ name: 'Partner 2' }).returning().execute();
    const [period] = await db.insert(periodsTable).values(testPeriod).returning().execute();
    
    const [journal] = await db.insert(journalsTable).values({
      reference: 'JE-001',
      description: 'Test Journal Entry',
      journal_date: '2024-01-15',
      period_id: period.id,
      status: 'Draft',
      created_by: user.id
    }).returning().execute();

    // Create movements for different partners
    await db.insert(capitalMovementsTable).values([
      {
        partner_id: partner1.id,
        movement_type: 'Contribution',
        amount: '1000.00',
        currency: 'USD',
        amount_base: '1000.00',
        journal_id: journal.id,
        description: 'Partner 1 contribution',
        movement_date: '2024-01-15'
      },
      {
        partner_id: partner2.id,
        movement_type: 'Contribution',
        amount: '2000.00',
        currency: 'USD',
        amount_base: '2000.00',
        journal_id: journal.id,
        description: 'Partner 2 contribution',
        movement_date: '2024-01-15'
      }
    ]).execute();

    const result = await getCapitalMovements({ partner_id: partner1.id });

    expect(result).toHaveLength(1);
    expect(result[0].partner_id).toBe(partner1.id);
    expect(result[0].description).toBe('Partner 1 contribution');
    expect(result[0].amount).toEqual(1000.00);
  });

  it('should filter by date range', async () => {
    // Create prerequisite records
    const [user] = await db.insert(usersTable).values(testUser).returning().execute();
    const [account] = await db.insert(accountsTable).values(testAccount).returning().execute();
    const [partner] = await db.insert(partnersTable).values(testPartner).returning().execute();
    const [period] = await db.insert(periodsTable).values(testPeriod).returning().execute();
    
    const [journal] = await db.insert(journalsTable).values({
      reference: 'JE-001',
      description: 'Test Journal Entry',
      journal_date: '2024-01-15',
      period_id: period.id,
      status: 'Draft',
      created_by: user.id
    }).returning().execute();

    // Create movements with different dates
    await db.insert(capitalMovementsTable).values([
      {
        partner_id: partner.id,
        movement_type: 'Contribution',
        amount: '1000.00',
        currency: 'USD',
        amount_base: '1000.00',
        journal_id: journal.id,
        description: 'Early movement',
        movement_date: '2024-01-05'
      },
      {
        partner_id: partner.id,
        movement_type: 'Contribution',
        amount: '1500.00',
        currency: 'USD',
        amount_base: '1500.00',
        journal_id: journal.id,
        description: 'Mid movement',
        movement_date: '2024-01-15'
      },
      {
        partner_id: partner.id,
        movement_type: 'Draw',
        amount: '500.00',
        currency: 'USD',
        amount_base: '500.00',
        journal_id: journal.id,
        description: 'Late movement',
        movement_date: '2024-01-25'
      }
    ]).execute();

    // Filter by date range
    const startDate = new Date('2024-01-10');
    const endDate = new Date('2024-01-20');
    
    const result = await getCapitalMovements({ 
      start_date: startDate, 
      end_date: endDate 
    });

    expect(result).toHaveLength(1);
    expect(result[0].description).toBe('Mid movement');
    expect(result[0].movement_date).toBeInstanceOf(Date);
    expect(result[0].movement_date.toISOString().split('T')[0]).toEqual('2024-01-15');
    expect(result[0].amount).toEqual(1500.00);
  });

  it('should filter by movement_type', async () => {
    // Create prerequisite records
    const [user] = await db.insert(usersTable).values(testUser).returning().execute();
    const [account] = await db.insert(accountsTable).values(testAccount).returning().execute();
    const [partner] = await db.insert(partnersTable).values(testPartner).returning().execute();
    const [period] = await db.insert(periodsTable).values(testPeriod).returning().execute();
    
    const [journal] = await db.insert(journalsTable).values({
      reference: 'JE-001',
      description: 'Test Journal Entry',
      journal_date: '2024-01-15',
      period_id: period.id,
      status: 'Draft',
      created_by: user.id
    }).returning().execute();

    // Create movements with different types
    await db.insert(capitalMovementsTable).values([
      {
        partner_id: partner.id,
        movement_type: 'Contribution',
        amount: '1000.00',
        currency: 'USD',
        amount_base: '1000.00',
        journal_id: journal.id,
        description: 'Capital contribution',
        movement_date: '2024-01-15'
      },
      {
        partner_id: partner.id,
        movement_type: 'Draw',
        amount: '500.00',
        currency: 'USD',
        amount_base: '500.00',
        journal_id: journal.id,
        description: 'Capital draw',
        movement_date: '2024-01-20'
      }
    ]).execute();

    const contributionResult = await getCapitalMovements({ movement_type: 'Contribution' });
    expect(contributionResult).toHaveLength(1);
    expect(contributionResult[0].movement_type).toBe('Contribution');
    expect(contributionResult[0].amount).toEqual(1000.00);

    const drawResult = await getCapitalMovements({ movement_type: 'Draw' });
    expect(drawResult).toHaveLength(1);
    expect(drawResult[0].movement_type).toBe('Draw');
    expect(drawResult[0].amount).toEqual(500.00);
  });

  it('should combine multiple filters', async () => {
    // Create prerequisite records
    const [user] = await db.insert(usersTable).values(testUser).returning().execute();
    const [account] = await db.insert(accountsTable).values(testAccount).returning().execute();
    const [partner1] = await db.insert(partnersTable).values({ name: 'Partner 1' }).returning().execute();
    const [partner2] = await db.insert(partnersTable).values({ name: 'Partner 2' }).returning().execute();
    const [period] = await db.insert(periodsTable).values(testPeriod).returning().execute();
    
    const [journal] = await db.insert(journalsTable).values({
      reference: 'JE-001',
      description: 'Test Journal Entry',
      journal_date: '2024-01-15',
      period_id: period.id,
      status: 'Draft',
      created_by: user.id
    }).returning().execute();

    // Create multiple movements
    await db.insert(capitalMovementsTable).values([
      {
        partner_id: partner1.id,
        movement_type: 'Contribution',
        amount: '1000.00',
        currency: 'USD',
        amount_base: '1000.00',
        journal_id: journal.id,
        description: 'P1 contribution',
        movement_date: '2024-01-15'
      },
      {
        partner_id: partner1.id,
        movement_type: 'Draw',
        amount: '300.00',
        currency: 'USD',
        amount_base: '300.00',
        journal_id: journal.id,
        description: 'P1 draw',
        movement_date: '2024-01-20'
      },
      {
        partner_id: partner2.id,
        movement_type: 'Contribution',
        amount: '2000.00',
        currency: 'USD',
        amount_base: '2000.00',
        journal_id: journal.id,
        description: 'P2 contribution',
        movement_date: '2024-01-15'
      }
    ]).execute();

    // Filter by partner and movement type
    const result = await getCapitalMovements({ 
      partner_id: partner1.id,
      movement_type: 'Contribution'
    });

    expect(result).toHaveLength(1);
    expect(result[0].partner_id).toBe(partner1.id);
    expect(result[0].movement_type).toBe('Contribution');
    expect(result[0].description).toBe('P1 contribution');
    expect(result[0].amount).toEqual(1000.00);
  });

  it('should handle edge case with start_date only', async () => {
    // Create prerequisite records
    const [user] = await db.insert(usersTable).values(testUser).returning().execute();
    const [account] = await db.insert(accountsTable).values(testAccount).returning().execute();
    const [partner] = await db.insert(partnersTable).values(testPartner).returning().execute();
    const [period] = await db.insert(periodsTable).values(testPeriod).returning().execute();
    
    const [journal] = await db.insert(journalsTable).values({
      reference: 'JE-001',
      description: 'Test Journal Entry',
      journal_date: '2024-01-15',
      period_id: period.id,
      status: 'Draft',
      created_by: user.id
    }).returning().execute();

    await db.insert(capitalMovementsTable).values([
      {
        partner_id: partner.id,
        movement_type: 'Contribution',
        amount: '1000.00',
        currency: 'USD',
        amount_base: '1000.00',
        journal_id: journal.id,
        description: 'Before filter',
        movement_date: '2024-01-10'
      },
      {
        partner_id: partner.id,
        movement_type: 'Contribution',
        amount: '1500.00',
        currency: 'USD',
        amount_base: '1500.00',
        journal_id: journal.id,
        description: 'After filter',
        movement_date: '2024-01-20'
      }
    ]).execute();

    const result = await getCapitalMovements({ start_date: new Date('2024-01-15') });

    expect(result).toHaveLength(1);
    expect(result[0].description).toBe('After filter');
    expect(result[0].amount).toEqual(1500.00);
  });
});