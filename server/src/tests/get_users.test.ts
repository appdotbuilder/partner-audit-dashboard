import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, partnersTable } from '../db/schema';
import { type CreateUserInput } from '../schema';
import { getUsers } from '../handlers/get_users';

describe('getUsers', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return empty array when no users exist', async () => {
    const result = await getUsers();

    expect(result).toEqual([]);
  });

  it('should return all users', async () => {
    // Create test users
    const testUsers = [
      {
        email: 'admin@test.com',
        name: 'Admin User',
        role: 'Admin' as const,
        partner_id: null
      },
      {
        email: 'finance@test.com',
        name: 'Finance User',
        role: 'Finance' as const,
        partner_id: null
      },
      {
        email: 'auditor@test.com',
        name: 'Auditor User',
        role: 'Auditor' as const,
        partner_id: null
      }
    ];

    // Insert test users
    await db.insert(usersTable)
      .values(testUsers)
      .execute();

    const result = await getUsers();

    expect(result).toHaveLength(3);
    expect(result[0].email).toEqual('admin@test.com');
    expect(result[0].name).toEqual('Admin User');
    expect(result[0].role).toEqual('Admin');
    expect(result[0].partner_id).toBeNull();
    expect(result[0].id).toBeDefined();
    expect(result[0].created_at).toBeInstanceOf(Date);
    expect(result[0].updated_at).toBeInstanceOf(Date);

    expect(result[1].email).toEqual('finance@test.com');
    expect(result[1].name).toEqual('Finance User');
    expect(result[1].role).toEqual('Finance');

    expect(result[2].email).toEqual('auditor@test.com');
    expect(result[2].name).toEqual('Auditor User');
    expect(result[2].role).toEqual('Auditor');
  });

  it('should return users with partner associations', async () => {
    // Create test partner first
    const partnerResult = await db.insert(partnersTable)
      .values({
        name: 'Test Partner',
        usd_account_id: null,
        pkr_account_id: null
      })
      .returning()
      .execute();

    const partner = partnerResult[0];

    // Create users with and without partner associations
    const testUsers = [
      {
        email: 'partner@test.com',
        name: 'Partner User',
        role: 'Partner' as const,
        partner_id: partner.id
      },
      {
        email: 'admin@test.com',
        name: 'Admin User',
        role: 'Admin' as const,
        partner_id: null
      }
    ];

    await db.insert(usersTable)
      .values(testUsers)
      .execute();

    const result = await getUsers();

    expect(result).toHaveLength(2);
    
    // Find the partner user
    const partnerUser = result.find(u => u.role === 'Partner');
    const adminUser = result.find(u => u.role === 'Admin');

    expect(partnerUser).toBeDefined();
    expect(partnerUser!.partner_id).toEqual(partner.id);
    expect(partnerUser!.email).toEqual('partner@test.com');
    expect(partnerUser!.name).toEqual('Partner User');

    expect(adminUser).toBeDefined();
    expect(adminUser!.partner_id).toBeNull();
    expect(adminUser!.email).toEqual('admin@test.com');
  });

  it('should return users ordered by creation date', async () => {
    // Create users with slight delay to ensure different timestamps
    await db.insert(usersTable)
      .values({
        email: 'first@test.com',
        name: 'First User',
        role: 'Admin' as const,
        partner_id: null
      })
      .execute();

    // Small delay to ensure different created_at timestamps
    await new Promise(resolve => setTimeout(resolve, 10));

    await db.insert(usersTable)
      .values({
        email: 'second@test.com',
        name: 'Second User',
        role: 'Finance' as const,
        partner_id: null
      })
      .execute();

    const result = await getUsers();

    expect(result).toHaveLength(2);
    expect(result[0].created_at <= result[1].created_at).toBe(true);
  });

  it('should handle all role types', async () => {
    const roles = ['Admin', 'Finance', 'Auditor', 'Partner'] as const;
    
    // Create users with all different roles
    const testUsers = roles.map((role, index) => ({
      email: `${role.toLowerCase()}@test.com`,
      name: `${role} User`,
      role,
      partner_id: null
    }));

    await db.insert(usersTable)
      .values(testUsers)
      .execute();

    const result = await getUsers();

    expect(result).toHaveLength(4);
    
    // Verify all roles are present
    const returnedRoles = result.map(u => u.role).sort();
    expect(returnedRoles).toEqual(['Admin', 'Auditor', 'Finance', 'Partner']);
  });

  it('should return users with all required fields', async () => {
    await db.insert(usersTable)
      .values({
        email: 'test@example.com',
        name: 'Test User',
        role: 'Admin' as const,
        partner_id: null
      })
      .execute();

    const result = await getUsers();

    expect(result).toHaveLength(1);
    const user = result[0];

    // Verify all required User schema fields are present
    expect(typeof user.id).toBe('number');
    expect(typeof user.email).toBe('string');
    expect(typeof user.name).toBe('string');
    expect(['Admin', 'Finance', 'Auditor', 'Partner']).toContain(user.role);
    expect(user.partner_id === null || typeof user.partner_id === 'number').toBe(true);
    expect(user.created_at).toBeInstanceOf(Date);
    expect(user.updated_at).toBeInstanceOf(Date);
  });
});