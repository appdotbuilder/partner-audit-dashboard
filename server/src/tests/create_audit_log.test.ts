import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { auditLogTable, usersTable } from '../db/schema';
import { type CreateAuditLogInput } from '../schema';
import { createAuditLog } from '../handlers/create_audit_log';
import { eq } from 'drizzle-orm';

// Test user for audit log entries
const testUserId = 1;

// Create test user before running audit log tests
const createTestUser = async () => {
  await db.insert(usersTable)
    .values({
      id: testUserId,
      email: 'test@example.com',
      name: 'Test User',
      role: 'Admin',
      partner_id: null
    })
    .execute();
};

// Basic audit log input
const testInput: CreateAuditLogInput = {
  table_name: 'users',
  record_id: 123,
  action: 'UPDATE',
  old_values: JSON.stringify({ name: 'Old Name', email: 'old@example.com' }),
  new_values: JSON.stringify({ name: 'New Name', email: 'new@example.com' }),
  ip_address: '192.168.1.100'
};

describe('createAuditLog', () => {
  beforeEach(async () => {
    await createDB();
    await createTestUser();
  });
  afterEach(resetDB);

  it('should create an audit log entry', async () => {
    const result = await createAuditLog(testInput, testUserId);

    // Basic field validation
    expect(result.table_name).toEqual('users');
    expect(result.record_id).toEqual(123);
    expect(result.action).toEqual('UPDATE');
    expect(result.old_values).toEqual(testInput.old_values);
    expect(result.new_values).toEqual(testInput.new_values);
    expect(result.user_id).toEqual(testUserId);
    expect(result.ip_address).toEqual('192.168.1.100');
    expect(result.id).toBeDefined();
    expect(result.timestamp).toBeInstanceOf(Date);
  });

  it('should save audit log to database', async () => {
    const result = await createAuditLog(testInput, testUserId);

    // Query database to verify entry was saved
    const auditLogs = await db.select()
      .from(auditLogTable)
      .where(eq(auditLogTable.id, result.id))
      .execute();

    expect(auditLogs).toHaveLength(1);
    const savedLog = auditLogs[0];
    expect(savedLog.table_name).toEqual('users');
    expect(savedLog.record_id).toEqual(123);
    expect(savedLog.action).toEqual('UPDATE');
    expect(savedLog.user_id).toEqual(testUserId);
    expect(savedLog.ip_address).toEqual('192.168.1.100');
    expect(savedLog.timestamp).toBeInstanceOf(Date);
  });

  it('should handle CREATE action', async () => {
    const createInput: CreateAuditLogInput = {
      table_name: 'accounts',
      record_id: 456,
      action: 'CREATE',
      old_values: null,
      new_values: JSON.stringify({ name: 'New Account', code: '1001' }),
      ip_address: '10.0.0.1'
    };

    const result = await createAuditLog(createInput, testUserId);

    expect(result.action).toEqual('CREATE');
    expect(result.old_values).toBeNull();
    expect(result.new_values).toEqual(createInput.new_values);
    expect(result.table_name).toEqual('accounts');
    expect(result.record_id).toEqual(456);
  });

  it('should handle DELETE action', async () => {
    const deleteInput: CreateAuditLogInput = {
      table_name: 'partners',
      record_id: 789,
      action: 'DELETE',
      old_values: JSON.stringify({ name: 'Deleted Partner', id: 789 }),
      new_values: null,
      ip_address: '172.16.0.1'
    };

    const result = await createAuditLog(deleteInput, testUserId);

    expect(result.action).toEqual('DELETE');
    expect(result.old_values).toEqual(deleteInput.old_values);
    expect(result.new_values).toBeNull();
    expect(result.table_name).toEqual('partners');
    expect(result.record_id).toEqual(789);
  });

  it('should handle null IP address', async () => {
    const inputNoIp: CreateAuditLogInput = {
      table_name: 'journals',
      record_id: 999,
      action: 'UPDATE',
      old_values: JSON.stringify({ status: 'Draft' }),
      new_values: JSON.stringify({ status: 'Posted' }),
      ip_address: null
    };

    const result = await createAuditLog(inputNoIp, testUserId);

    expect(result.ip_address).toBeNull();
    expect(result.action).toEqual('UPDATE');
    expect(result.table_name).toEqual('journals');
  });

  it('should handle complex JSON values', async () => {
    const complexInput: CreateAuditLogInput = {
      table_name: 'journal_lines',
      record_id: 555,
      action: 'UPDATE',
      old_values: JSON.stringify({
        debit_amount: '100.00',
        credit_amount: '0.00',
        account_id: 1001,
        nested_object: { key: 'value', number: 42 }
      }),
      new_values: JSON.stringify({
        debit_amount: '150.00',
        credit_amount: '0.00',
        account_id: 1002,
        nested_object: { key: 'updated_value', number: 84 }
      }),
      ip_address: '203.0.113.1'
    };

    const result = await createAuditLog(complexInput, testUserId);

    expect(result.old_values).toEqual(complexInput.old_values);
    expect(result.new_values).toEqual(complexInput.new_values);
    
    // Verify JSON can be parsed back
    const oldValues = JSON.parse(result.old_values!);
    const newValues = JSON.parse(result.new_values!);
    expect(oldValues.nested_object.key).toEqual('value');
    expect(newValues.nested_object.key).toEqual('updated_value');
  });

  it('should create multiple audit log entries', async () => {
    const input1: CreateAuditLogInput = {
      table_name: 'users',
      record_id: 100,
      action: 'CREATE',
      old_values: null,
      new_values: JSON.stringify({ name: 'User 1' }),
      ip_address: '192.168.1.1'
    };

    const input2: CreateAuditLogInput = {
      table_name: 'users',
      record_id: 101,
      action: 'CREATE',
      old_values: null,
      new_values: JSON.stringify({ name: 'User 2' }),
      ip_address: '192.168.1.2'
    };

    const result1 = await createAuditLog(input1, testUserId);
    const result2 = await createAuditLog(input2, testUserId);

    expect(result1.id).not.toEqual(result2.id);
    expect(result1.record_id).toEqual(100);
    expect(result2.record_id).toEqual(101);

    // Verify both entries exist in database
    const allLogs = await db.select()
      .from(auditLogTable)
      .execute();

    expect(allLogs.length).toBeGreaterThanOrEqual(2);
    
    const logIds = allLogs.map(log => log.id);
    expect(logIds).toContain(result1.id);
    expect(logIds).toContain(result2.id);
  });

  it('should track timestamp correctly', async () => {
    const beforeTime = new Date();
    
    const result = await createAuditLog(testInput, testUserId);
    
    const afterTime = new Date();

    expect(result.timestamp).toBeInstanceOf(Date);
    expect(result.timestamp.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
    expect(result.timestamp.getTime()).toBeLessThanOrEqual(afterTime.getTime());
  });
});