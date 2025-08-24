import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { partnersTable, accountsTable } from '../db/schema';
import { getPartners } from '../handlers/get_partners';
import { type CreatePartnerInput, type CreateAccountInput } from '../schema';

describe('getPartners', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return empty array when no partners exist', async () => {
    const result = await getPartners();

    expect(result).toEqual([]);
    expect(result).toHaveLength(0);
  });

  it('should return all partners', async () => {
    // Create test accounts first
    const usdAccount = await db.insert(accountsTable)
      .values({
        code: 'ACC-USD-001',
        name: 'USD Capital Account',
        account_type: 'Equity',
        currency: 'USD',
        is_bank: false,
        is_capital: true,
        is_payroll_source: false,
        is_intercompany: false,
        parent_id: null,
        is_active: true
      })
      .returning()
      .execute();

    const pkrAccount = await db.insert(accountsTable)
      .values({
        code: 'ACC-PKR-001',
        name: 'PKR Capital Account',
        account_type: 'Equity',
        currency: 'PKR',
        is_bank: false,
        is_capital: true,
        is_payroll_source: false,
        is_intercompany: false,
        parent_id: null,
        is_active: true
      })
      .returning()
      .execute();

    // Create test partners
    const partner1Input: CreatePartnerInput = {
      name: 'John Doe',
      usd_account_id: usdAccount[0].id,
      pkr_account_id: pkrAccount[0].id
    };

    const partner2Input: CreatePartnerInput = {
      name: 'Jane Smith',
      usd_account_id: null,
      pkr_account_id: null
    };

    await db.insert(partnersTable)
      .values([partner1Input, partner2Input])
      .execute();

    const result = await getPartners();

    expect(result).toHaveLength(2);
    
    // Check first partner
    const johnDoe = result.find(p => p.name === 'John Doe');
    expect(johnDoe).toBeDefined();
    expect(johnDoe!.name).toEqual('John Doe');
    expect(johnDoe!.usd_account_id).toEqual(usdAccount[0].id);
    expect(johnDoe!.pkr_account_id).toEqual(pkrAccount[0].id);
    expect(johnDoe!.id).toBeDefined();
    expect(johnDoe!.created_at).toBeInstanceOf(Date);
    expect(johnDoe!.updated_at).toBeInstanceOf(Date);

    // Check second partner
    const janeSmith = result.find(p => p.name === 'Jane Smith');
    expect(janeSmith).toBeDefined();
    expect(janeSmith!.name).toEqual('Jane Smith');
    expect(janeSmith!.usd_account_id).toBeNull();
    expect(janeSmith!.pkr_account_id).toBeNull();
    expect(janeSmith!.id).toBeDefined();
    expect(janeSmith!.created_at).toBeInstanceOf(Date);
    expect(janeSmith!.updated_at).toBeInstanceOf(Date);
  });

  it('should return partners ordered by creation time', async () => {
    // Create multiple partners
    const partnersData = [
      { name: 'Partner A', usd_account_id: null, pkr_account_id: null },
      { name: 'Partner B', usd_account_id: null, pkr_account_id: null },
      { name: 'Partner C', usd_account_id: null, pkr_account_id: null }
    ];

    // Insert partners one by one to ensure different creation times
    for (const partnerData of partnersData) {
      await db.insert(partnersTable)
        .values(partnerData)
        .execute();
    }

    const result = await getPartners();

    expect(result).toHaveLength(3);
    
    // Verify all partners are returned
    expect(result.map(p => p.name)).toContain('Partner A');
    expect(result.map(p => p.name)).toContain('Partner B');
    expect(result.map(p => p.name)).toContain('Partner C');

    // Verify all have proper structure
    result.forEach(partner => {
      expect(partner.id).toBeDefined();
      expect(partner.name).toBeDefined();
      expect(partner.created_at).toBeInstanceOf(Date);
      expect(partner.updated_at).toBeInstanceOf(Date);
      expect(typeof partner.name).toBe('string');
    });
  });

  it('should handle partners with mixed account configurations', async () => {
    // Create one account for testing
    const testAccount = await db.insert(accountsTable)
      .values({
        code: 'TEST-001',
        name: 'Test Account',
        account_type: 'Asset',
        currency: 'USD',
        is_bank: false,
        is_capital: false,
        is_payroll_source: false,
        is_intercompany: false,
        parent_id: null,
        is_active: true
      })
      .returning()
      .execute();

    // Create partners with different account configurations
    await db.insert(partnersTable)
      .values([
        { name: 'Both Accounts', usd_account_id: testAccount[0].id, pkr_account_id: testAccount[0].id },
        { name: 'USD Only', usd_account_id: testAccount[0].id, pkr_account_id: null },
        { name: 'PKR Only', usd_account_id: null, pkr_account_id: testAccount[0].id },
        { name: 'No Accounts', usd_account_id: null, pkr_account_id: null }
      ])
      .execute();

    const result = await getPartners();

    expect(result).toHaveLength(4);
    
    const bothAccounts = result.find(p => p.name === 'Both Accounts');
    expect(bothAccounts!.usd_account_id).toEqual(testAccount[0].id);
    expect(bothAccounts!.pkr_account_id).toEqual(testAccount[0].id);

    const usdOnly = result.find(p => p.name === 'USD Only');
    expect(usdOnly!.usd_account_id).toEqual(testAccount[0].id);
    expect(usdOnly!.pkr_account_id).toBeNull();

    const pkrOnly = result.find(p => p.name === 'PKR Only');
    expect(pkrOnly!.usd_account_id).toBeNull();
    expect(pkrOnly!.pkr_account_id).toEqual(testAccount[0].id);

    const noAccounts = result.find(p => p.name === 'No Accounts');
    expect(noAccounts!.usd_account_id).toBeNull();
    expect(noAccounts!.pkr_account_id).toBeNull();
  });
});