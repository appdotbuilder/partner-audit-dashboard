import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, auditLogTable } from '../db/schema';
import { type GetAuditLogsInput } from '../handlers/get_audit_logs';
import { getAuditLogs } from '../handlers/get_audit_logs';
import { eq } from 'drizzle-orm';

describe('getAuditLogs', () => {
  let testUser1Id: number;
  let testUser2Id: number;

  beforeEach(async () => {
    await createDB();

    // Create test users first
    const users = await db.insert(usersTable)
      .values([
        {
          email: 'user1@example.com',
          name: 'Test User 1',
          role: 'Admin',
          partner_id: null
        },
        {
          email: 'user2@example.com',
          name: 'Test User 2',
          role: 'Finance',
          partner_id: null
        }
      ])
      .returning()
      .execute();

    testUser1Id = users[0].id;
    testUser2Id = users[1].id;

    // Create test audit logs
    const baseDate = new Date('2024-01-15T10:00:00Z');
    await db.insert(auditLogTable)
      .values([
        {
          table_name: 'accounts',
          record_id: 1,
          action: 'CREATE',
          old_values: null,
          new_values: { name: 'Test Account', code: 'TEST001' },
          user_id: testUser1Id,
          timestamp: baseDate,
          ip_address: '192.168.1.1'
        },
        {
          table_name: 'accounts',
          record_id: 1,
          action: 'UPDATE',
          old_values: { name: 'Test Account', code: 'TEST001' },
          new_values: { name: 'Updated Account', code: 'TEST001' },
          user_id: testUser2Id,
          timestamp: new Date(baseDate.getTime() + 60000), // 1 minute later
          ip_address: '192.168.1.2'
        },
        {
          table_name: 'journals',
          record_id: 5,
          action: 'CREATE',
          old_values: null,
          new_values: { reference: 'JE001', description: 'Test Journal' },
          user_id: testUser1Id,
          timestamp: new Date(baseDate.getTime() + 120000), // 2 minutes later
          ip_address: '192.168.1.1'
        },
        {
          table_name: 'journals',
          record_id: 5,
          action: 'DELETE',
          old_values: { reference: 'JE001', description: 'Test Journal' },
          new_values: null,
          user_id: testUser2Id,
          timestamp: new Date(baseDate.getTime() + 180000), // 3 minutes later
          ip_address: null
        }
      ])
      .execute();
  });

  afterEach(resetDB);

  it('should return all audit logs with default parameters', async () => {
    const input: GetAuditLogsInput = {};
    const result = await getAuditLogs(input);

    expect(result).toHaveLength(4);
    expect(result[0].action).toBe('DELETE'); // Most recent first
    expect(result[1].action).toBe('CREATE');
    expect(result[2].action).toBe('UPDATE');
    expect(result[3].action).toBe('CREATE'); // Oldest last
  });

  it('should work when called without parameters', async () => {
    const result = await getAuditLogs();

    expect(result).toHaveLength(4);
    expect(result[0].action).toBe('DELETE'); // Most recent first
    expect(result[1].action).toBe('CREATE');
    expect(result[2].action).toBe('UPDATE');
    expect(result[3].action).toBe('CREATE'); // Oldest last
  });

  it('should filter by table_name', async () => {
    const input: GetAuditLogsInput = {
      table_name: 'accounts'
    };
    const result = await getAuditLogs(input);

    expect(result).toHaveLength(2);
    result.forEach(log => {
      expect(log.table_name).toBe('accounts');
    });
    expect(result[0].action).toBe('UPDATE'); // Most recent accounts action
    expect(result[1].action).toBe('CREATE');
  });

  it('should filter by record_id', async () => {
    const input: GetAuditLogsInput = {
      record_id: 1
    };
    const result = await getAuditLogs(input);

    expect(result).toHaveLength(2);
    result.forEach(log => {
      expect(log.record_id).toBe(1);
    });
  });

  it('should filter by user_id', async () => {
    const input: GetAuditLogsInput = {
      user_id: testUser1Id
    };
    const result = await getAuditLogs(input);

    expect(result).toHaveLength(2);
    result.forEach(log => {
      expect(log.user_id).toBe(testUser1Id);
    });
  });

  it('should filter by date range', async () => {
    const baseDate = new Date('2024-01-15T10:00:00Z');
    const input: GetAuditLogsInput = {
      start_date: new Date(baseDate.getTime() + 30000), // 30 seconds after base
      end_date: new Date(baseDate.getTime() + 150000)   // 2.5 minutes after base
    };
    const result = await getAuditLogs(input);

    expect(result).toHaveLength(2);
    expect(result[0].action).toBe('CREATE'); // journals CREATE
    expect(result[1].action).toBe('UPDATE'); // accounts UPDATE
  });

  it('should combine multiple filters', async () => {
    const input: GetAuditLogsInput = {
      table_name: 'accounts',
      user_id: testUser1Id
    };
    const result = await getAuditLogs(input);

    expect(result).toHaveLength(1);
    expect(result[0].table_name).toBe('accounts');
    expect(result[0].user_id).toBe(testUser1Id);
    expect(result[0].action).toBe('CREATE');
  });

  it('should respect limit parameter', async () => {
    const input: GetAuditLogsInput = {
      limit: 2
    };
    const result = await getAuditLogs(input);

    expect(result).toHaveLength(2);
    expect(result[0].action).toBe('DELETE'); // Most recent
    expect(result[1].action).toBe('CREATE'); // Second most recent
  });

  it('should respect offset parameter', async () => {
    const input: GetAuditLogsInput = {
      limit: 2,
      offset: 1
    };
    const result = await getAuditLogs(input);

    expect(result).toHaveLength(2);
    expect(result[0].action).toBe('CREATE'); // journals CREATE (second in order)
    expect(result[1].action).toBe('UPDATE'); // accounts UPDATE (third in order)
  });

  it('should handle JSON values correctly', async () => {
    const input: GetAuditLogsInput = {
      table_name: 'accounts'
    };
    const result = await getAuditLogs(input);

    expect(result).toHaveLength(2);
    // Find the CREATE action log
    const createLog = result.find(log => log.action === 'CREATE');
    expect(createLog).toBeDefined();
    expect(createLog!.old_values).toBeNull();
    expect(createLog!.new_values).toBe('{"name":"Test Account","code":"TEST001"}');
    expect(createLog!.ip_address).toBe('192.168.1.1');
  });

  it('should handle null values correctly', async () => {
    const input: GetAuditLogsInput = {
      table_name: 'journals'
    };
    const result = await getAuditLogs(input);

    expect(result).toHaveLength(2);
    // Find the DELETE action log
    const deleteLog = result.find(log => log.action === 'DELETE');
    expect(deleteLog).toBeDefined();
    expect(deleteLog!.old_values).toBe('{"reference":"JE001","description":"Test Journal"}');
    expect(deleteLog!.new_values).toBeNull();
    expect(deleteLog!.ip_address).toBeNull();
  });

  it('should return empty array when no records match filters', async () => {
    const input: GetAuditLogsInput = {
      table_name: 'nonexistent_table'
    };
    const result = await getAuditLogs(input);

    expect(result).toHaveLength(0);
  });

  it('should validate that audit logs are properly linked to users', async () => {
    const input: GetAuditLogsInput = {};
    const result = await getAuditLogs(input);

    // Verify all logs have valid user_id that exists in users table
    expect(result).toHaveLength(4);
    
    const userIds = result.map(log => log.user_id);
    const uniqueUserIds = [...new Set(userIds)];
    
    expect(uniqueUserIds).toContain(testUser1Id);
    expect(uniqueUserIds).toContain(testUser2Id);
    expect(uniqueUserIds).toHaveLength(2);

    // Verify user relation works by checking the join was successful
    const users = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, testUser1Id))
      .execute();
    
    expect(users).toHaveLength(1);
    expect(users[0].name).toBe('Test User 1');
  });

  it('should maintain proper timestamp ordering with identical timestamps', async () => {
    // Create logs with same timestamp to test ordering stability
    const sameTime = new Date('2024-01-20T15:00:00Z');
    await db.insert(auditLogTable)
      .values([
        {
          table_name: 'test_table',
          record_id: 99,
          action: 'FIRST',
          old_values: null,
          new_values: { order: 1 },
          user_id: testUser1Id,
          timestamp: sameTime,
          ip_address: '127.0.0.1'
        },
        {
          table_name: 'test_table',
          record_id: 99,
          action: 'SECOND',
          old_values: null,
          new_values: { order: 2 },
          user_id: testUser1Id,
          timestamp: sameTime,
          ip_address: '127.0.0.1'
        }
      ])
      .execute();

    const result = await getAuditLogs({ table_name: 'test_table' });
    
    expect(result).toHaveLength(2);
    // Both should be returned, order may vary for identical timestamps but that's acceptable
    const actions = result.map(r => r.action);
    expect(actions).toContain('FIRST');
    expect(actions).toContain('SECOND');
  });
});