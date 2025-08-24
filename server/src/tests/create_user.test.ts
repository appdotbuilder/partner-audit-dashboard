import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, partnersTable } from '../db/schema';
import { type CreateUserInput } from '../schema';
import { createUser } from '../handlers/create_user';
import { eq } from 'drizzle-orm';

// Test inputs
const testInput: CreateUserInput = {
  email: 'test@example.com',
  name: 'Test User',
  role: 'Finance',
  partner_id: null
};

const partnerUserInput: CreateUserInput = {
  email: 'partner@example.com',
  name: 'Partner User',
  role: 'Partner',
  partner_id: 1 // Will be set after creating partner
};

describe('createUser', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should create a user with basic fields', async () => {
    const result = await createUser(testInput);

    // Basic field validation
    expect(result.email).toEqual('test@example.com');
    expect(result.name).toEqual('Test User');
    expect(result.role).toEqual('Finance');
    expect(result.partner_id).toBeNull();
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should save user to database', async () => {
    const result = await createUser(testInput);

    // Query using proper drizzle syntax
    const users = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, result.id))
      .execute();

    expect(users).toHaveLength(1);
    expect(users[0].email).toEqual('test@example.com');
    expect(users[0].name).toEqual('Test User');
    expect(users[0].role).toEqual('Finance');
    expect(users[0].partner_id).toBeNull();
    expect(users[0].created_at).toBeInstanceOf(Date);
    expect(users[0].updated_at).toBeInstanceOf(Date);
  });

  it('should create user with valid partner_id', async () => {
    // First create a partner
    const partnerResult = await db.insert(partnersTable)
      .values({
        name: 'Test Partner',
        usd_account_id: null,
        pkr_account_id: null
      })
      .returning()
      .execute();

    const partnerId = partnerResult[0].id;

    // Create user with partner reference
    const userInput: CreateUserInput = {
      ...partnerUserInput,
      partner_id: partnerId
    };

    const result = await createUser(userInput);

    expect(result.partner_id).toEqual(partnerId);
    expect(result.role).toEqual('Partner');
    expect(result.email).toEqual('partner@example.com');
  });

  it('should create Admin user without partner_id', async () => {
    const adminInput: CreateUserInput = {
      email: 'admin@example.com',
      name: 'Admin User',
      role: 'Admin',
      partner_id: null
    };

    const result = await createUser(adminInput);

    expect(result.role).toEqual('Admin');
    expect(result.partner_id).toBeNull();
  });

  it('should create Auditor user without partner_id', async () => {
    const auditorInput: CreateUserInput = {
      email: 'auditor@example.com',
      name: 'Auditor User',
      role: 'Auditor',
      partner_id: null
    };

    const result = await createUser(auditorInput);

    expect(result.role).toEqual('Auditor');
    expect(result.partner_id).toBeNull();
  });

  it('should throw error when partner_id does not exist', async () => {
    const invalidInput: CreateUserInput = {
      ...testInput,
      partner_id: 999 // Non-existent partner
    };

    await expect(createUser(invalidInput)).rejects.toThrow(/Partner with id 999 does not exist/i);
  });

  it('should throw error when Partner role has no partner_id', async () => {
    const invalidPartnerInput: CreateUserInput = {
      email: 'invalid@example.com',
      name: 'Invalid Partner',
      role: 'Partner',
      partner_id: null
    };

    await expect(createUser(invalidPartnerInput)).rejects.toThrow(/Partner role requires a valid partner_id/i);
  });

  it('should enforce unique email constraint', async () => {
    // Create first user
    await createUser(testInput);

    // Try to create second user with same email
    const duplicateInput: CreateUserInput = {
      ...testInput,
      name: 'Another User'
    };

    await expect(createUser(duplicateInput)).rejects.toThrow();
  });

  it('should handle all role types correctly', async () => {
    const roles = ['Admin', 'Finance', 'Auditor'] as const;

    for (const role of roles) {
      const roleInput: CreateUserInput = {
        email: `${role.toLowerCase()}@example.com`,
        name: `${role} User`,
        role: role,
        partner_id: null
      };

      const result = await createUser(roleInput);
      expect(result.role).toEqual(role);
      expect(result.partner_id).toBeNull();
    }
  });

  it('should create user with Finance role and partner_id', async () => {
    // First create a partner
    const partnerResult = await db.insert(partnersTable)
      .values({
        name: 'Finance Partner',
        usd_account_id: null,
        pkr_account_id: null
      })
      .returning()
      .execute();

    const financeInput: CreateUserInput = {
      email: 'finance@example.com',
      name: 'Finance User',
      role: 'Finance',
      partner_id: partnerResult[0].id
    };

    const result = await createUser(financeInput);

    expect(result.role).toEqual('Finance');
    expect(result.partner_id).toEqual(partnerResult[0].id);
  });
});