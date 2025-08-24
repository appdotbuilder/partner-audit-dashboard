import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { partnersTable, accountsTable } from '../db/schema';
import { type CreatePartnerInput } from '../schema';
import { createPartner } from '../handlers/create_partner';
import { eq } from 'drizzle-orm';

describe('createPartner', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  // Helper function to create test accounts
  const createTestAccount = async (currency: 'USD' | 'PKR', code: string) => {
    const result = await db.insert(accountsTable)
      .values({
        code,
        name: `Test ${currency} Account`,
        account_type: 'Asset',
        currency,
        is_bank: false,
        is_capital: false,
        is_payroll_source: false,
        is_intercompany: false,
        parent_id: null,
        is_active: true
      })
      .returning()
      .execute();
    
    return result[0];
  };

  it('should create a partner with both USD and PKR accounts', async () => {
    // Create test accounts first
    const usdAccount = await createTestAccount('USD', 'USD-001');
    const pkrAccount = await createTestAccount('PKR', 'PKR-001');

    const testInput: CreatePartnerInput = {
      name: 'Test Partner',
      usd_account_id: usdAccount.id,
      pkr_account_id: pkrAccount.id
    };

    const result = await createPartner(testInput);

    // Verify basic fields
    expect(result.name).toEqual('Test Partner');
    expect(result.usd_account_id).toEqual(usdAccount.id);
    expect(result.pkr_account_id).toEqual(pkrAccount.id);
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should create a partner with only USD account', async () => {
    const usdAccount = await createTestAccount('USD', 'USD-002');

    const testInput: CreatePartnerInput = {
      name: 'USD Only Partner',
      usd_account_id: usdAccount.id,
      pkr_account_id: null
    };

    const result = await createPartner(testInput);

    expect(result.name).toEqual('USD Only Partner');
    expect(result.usd_account_id).toEqual(usdAccount.id);
    expect(result.pkr_account_id).toBeNull();
    expect(result.id).toBeDefined();
  });

  it('should create a partner with only PKR account', async () => {
    const pkrAccount = await createTestAccount('PKR', 'PKR-002');

    const testInput: CreatePartnerInput = {
      name: 'PKR Only Partner',
      usd_account_id: null,
      pkr_account_id: pkrAccount.id
    };

    const result = await createPartner(testInput);

    expect(result.name).toEqual('PKR Only Partner');
    expect(result.usd_account_id).toBeNull();
    expect(result.pkr_account_id).toEqual(pkrAccount.id);
    expect(result.id).toBeDefined();
  });

  it('should save partner to database correctly', async () => {
    const usdAccount = await createTestAccount('USD', 'USD-003');
    const pkrAccount = await createTestAccount('PKR', 'PKR-003');

    const testInput: CreatePartnerInput = {
      name: 'Database Test Partner',
      usd_account_id: usdAccount.id,
      pkr_account_id: pkrAccount.id
    };

    const result = await createPartner(testInput);

    // Verify data was saved to database
    const partners = await db.select()
      .from(partnersTable)
      .where(eq(partnersTable.id, result.id))
      .execute();

    expect(partners).toHaveLength(1);
    expect(partners[0].name).toEqual('Database Test Partner');
    expect(partners[0].usd_account_id).toEqual(usdAccount.id);
    expect(partners[0].pkr_account_id).toEqual(pkrAccount.id);
    expect(partners[0].created_at).toBeInstanceOf(Date);
    expect(partners[0].updated_at).toBeInstanceOf(Date);
  });

  it('should throw error when no accounts are provided', async () => {
    const testInput: CreatePartnerInput = {
      name: 'No Accounts Partner',
      usd_account_id: null,
      pkr_account_id: null
    };

    await expect(createPartner(testInput)).rejects.toThrow(/at least one account/i);
  });

  it('should throw error when USD account does not exist', async () => {
    const testInput: CreatePartnerInput = {
      name: 'Invalid USD Partner',
      usd_account_id: 99999, // Non-existent account ID
      pkr_account_id: null
    };

    await expect(createPartner(testInput)).rejects.toThrow(/usd account.*not found/i);
  });

  it('should throw error when PKR account does not exist', async () => {
    const testInput: CreatePartnerInput = {
      name: 'Invalid PKR Partner',
      usd_account_id: null,
      pkr_account_id: 99999 // Non-existent account ID
    };

    await expect(createPartner(testInput)).rejects.toThrow(/pkr account.*not found/i);
  });

  it('should throw error when both accounts do not exist', async () => {
    const testInput: CreatePartnerInput = {
      name: 'Invalid Both Accounts Partner',
      usd_account_id: 99998,
      pkr_account_id: 99999
    };

    // Should fail on the first validation (USD account)
    await expect(createPartner(testInput)).rejects.toThrow(/usd account.*not found/i);
  });

  it('should handle partner with existing valid USD account but invalid PKR account', async () => {
    const usdAccount = await createTestAccount('USD', 'USD-004');

    const testInput: CreatePartnerInput = {
      name: 'Mixed Valid Invalid Partner',
      usd_account_id: usdAccount.id,
      pkr_account_id: 99999 // Invalid PKR account
    };

    await expect(createPartner(testInput)).rejects.toThrow(/pkr account.*not found/i);
  });

  it('should create multiple partners with different accounts', async () => {
    // Create multiple test accounts
    const usdAccount1 = await createTestAccount('USD', 'USD-005');
    const usdAccount2 = await createTestAccount('USD', 'USD-006');
    const pkrAccount1 = await createTestAccount('PKR', 'PKR-005');
    const pkrAccount2 = await createTestAccount('PKR', 'PKR-006');

    const partner1Input: CreatePartnerInput = {
      name: 'First Partner',
      usd_account_id: usdAccount1.id,
      pkr_account_id: pkrAccount1.id
    };

    const partner2Input: CreatePartnerInput = {
      name: 'Second Partner',
      usd_account_id: usdAccount2.id,
      pkr_account_id: pkrAccount2.id
    };

    const result1 = await createPartner(partner1Input);
    const result2 = await createPartner(partner2Input);

    // Verify both partners were created correctly
    expect(result1.id).not.toEqual(result2.id);
    expect(result1.name).toEqual('First Partner');
    expect(result2.name).toEqual('Second Partner');
    expect(result1.usd_account_id).toEqual(usdAccount1.id);
    expect(result2.usd_account_id).toEqual(usdAccount2.id);
    expect(result1.pkr_account_id).toEqual(pkrAccount1.id);
    expect(result2.pkr_account_id).toEqual(pkrAccount2.id);

    // Verify both are in database
    const allPartners = await db.select()
      .from(partnersTable)
      .execute();

    expect(allPartners).toHaveLength(2);
  });
});